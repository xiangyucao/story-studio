import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ModelSettings } from "./types";

export const outlineProposalSchema = z.object({
  rationale: z.string(),
  nodes: z.array(z.object({
    type: z.literal("volume"),
    title: z.string(),
    summary: z.string(),
  })).min(1).max(20),
});

export const volumeExpansionSchema = z.object({
  rationale: z.string(),
  nodes: z.array(z.object({
    type: z.enum(["chapter", "scene"]),
    title: z.string(),
    summary: z.string(),
  })).min(1).max(60),
});

export const outlineNodeProposalSchema = z.object({
  rationale: z.string(),
  title: z.string(),
  summary: z.string(),
});

function clientFor(settings: ModelSettings) {
  if (settings.provider === "manual") throw new Error("当前选择的是外部手动模型，请复制提示词并粘贴返回结果");
  if (settings.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("尚未配置 OPENAI_API_KEY。请复制 .env.example 为 .env.local 并填入密钥。");
    return new OpenAI({ apiKey });
  }
  return new OpenAI({
    apiKey: process.env.LOCAL_MODEL_API_KEY || "local",
    baseURL: settings.baseUrl || process.env.LOCAL_MODEL_BASE_URL || "http://127.0.0.1:11434/v1",
  });
}

export async function generateText(settings: ModelSettings, system: string, prompt: string, maxOutputTokens?: number) {
  const client = clientFor(settings);
  if (settings.provider === "openai") {
    const response = await client.responses.create({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input: prompt,
      ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
    });
    return response.output_text;
  }
  const response = await client.chat.completions.create({
    model: settings.model || process.env.LOCAL_MODEL || "qwen3:8b",
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  });
  return response.choices[0]?.message.content ?? "";
}

export async function generateOutline(settings: ModelSettings, context: string, instruction: string, volumeCount = 7) {
  const client = clientFor(settings);
  const system = `你是长篇小说总纲编辑。严格尊重已有硬设定和事件因果。只规划全书的卷级结构，不规划章和场景，不写正文。必须恰好输出 ${volumeCount} 个 volume 节点，每卷都要有明确标题和介绍，依次覆盖故事的推进、转折与结局。`;
  const input = `${context}\n\n用户要求：${instruction}\n\n再次确认：只输出 ${volumeCount} 卷，不要输出章或场景。`;
  if (settings.provider === "openai") {
    const response = await client.responses.parse({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input,
      text: { format: zodTextFormat(outlineProposalSchema, "outline_proposal") },
    });
    if (!response.output_parsed) throw new Error("模型没有返回可解析的大纲");
    if (response.output_parsed.nodes.length !== volumeCount) throw new Error(`模型返回了 ${response.output_parsed.nodes.length} 卷，但要求是 ${volumeCount} 卷，请重新生成`);
    return response.output_parsed;
  }
  const raw = await generateText(settings, `${system} 必须只返回 JSON，格式为 {"rationale":"...","nodes":[{"type":"volume","title":"第一卷：...","summary":"本卷介绍..."}]}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 大纲");
  const parsed = outlineProposalSchema.parse(JSON.parse(match[0]));
  if (parsed.nodes.length !== volumeCount) throw new Error(`本地模型返回了 ${parsed.nodes.length} 卷，但要求是 ${volumeCount} 卷，请重新生成`);
  return parsed;
}

export async function generateVolumeExpansion(settings: ModelSettings, context: string, currentVolume: string, instruction: string, chapterCount = 7) {
  const client = clientFor(settings);
  const system = `你是长篇小说分卷策划编辑。把用户指定的一卷细化为恰好 ${chapterCount} 个可写作的章，可在每章后附场景。每一章必须有明确标题，并用 summary 提供可直接指导写作的章节介绍。严格尊重全书人物、关系、硬设定和事件因果。只规划这一卷，不修改或重复其他卷，不写正文。章标题必须使用“第X章”或具体情节名称，绝不能使用“第X卷”。每个场景必须紧跟在所属章之后。`;
  const input = `${context}\n\n待展开的卷：\n${currentVolume}\n\n用户要求：${instruction}\n\n再次确认：恰好生成 ${chapterCount} 章，不得把其他卷当成章。`;
  if (settings.provider === "openai") {
    const response = await client.responses.parse({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input,
      text: { format: zodTextFormat(volumeExpansionSchema, "volume_expansion") },
    });
    if (!response.output_parsed) throw new Error("模型没有返回可解析的分卷章节");
    const chapters = response.output_parsed.nodes.filter((node) => node.type === "chapter");
    if (chapters.length !== chapterCount) throw new Error(`模型返回了 ${chapters.length} 章，但要求是 ${chapterCount} 章，请重新生成`);
    return response.output_parsed;
  }
  const raw = await generateText(settings, `${system} 必须只返回 JSON，格式为 {"rationale":"...","nodes":[{"type":"chapter","title":"...","summary":"..."},{"type":"scene","title":"...","summary":"..."}]}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 分卷章节");
  const parsed = volumeExpansionSchema.parse(JSON.parse(match[0]));
  const chapters = parsed.nodes.filter((node) => node.type === "chapter");
  if (chapters.length !== chapterCount) throw new Error(`本地模型返回了 ${chapters.length} 章，但要求是 ${chapterCount} 章，请重新生成`);
  return parsed;
}

export async function generateOutlineNode(settings: ModelSettings, context: string, currentNode: string, instruction: string) {
  const client = clientFor(settings);
  const system = "你是长篇小说结构编辑。只修改用户指定的一个大纲节点，尊重全书已有硬设定、人物动机和因果链。不要扩写正文，也不要修改其他节点。";
  const input = `${context}\n\n当前节点：\n${currentNode}\n\n用户修改要求：${instruction}`;
  if (settings.provider === "openai") {
    const response = await client.responses.parse({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input,
      text: { format: zodTextFormat(outlineNodeProposalSchema, "outline_node_proposal") },
    });
    if (!response.output_parsed) throw new Error("模型没有返回可解析的节点提案");
    return response.output_parsed;
  }
  const raw = await generateText(settings, `${system} 必须只返回 JSON，格式为 {"rationale":"...","title":"...","summary":"..."}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 节点提案");
  return outlineNodeProposalSchema.parse(JSON.parse(match[0]));
}
