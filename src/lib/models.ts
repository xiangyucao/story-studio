import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ModelSettings } from "./types";

export const outlineProposalSchema = z.object({
  rationale: z.string(),
  nodes: z.array(z.object({
    type: z.enum(["volume", "chapter", "scene"]),
    title: z.string(),
    summary: z.string(),
  })).min(1).max(30),
});

export const volumeExpansionSchema = z.object({
  rationale: z.string(),
  nodes: z.array(z.object({
    type: z.enum(["chapter", "scene"]),
    title: z.string(),
    summary: z.string(),
  })).min(1).max(30),
});

export const outlineNodeProposalSchema = z.object({
  rationale: z.string(),
  title: z.string(),
  summary: z.string(),
});

const volumeLikeTitle = /^第[0-9一二三四五六七八九十百]+卷(?:[：:\s]|$)/;

function normalizeOverallVolumes(proposal: z.infer<typeof outlineProposalSchema>) {
  return {
    ...proposal,
    nodes: proposal.nodes.map((node) => node.type === "chapter" && volumeLikeTitle.test(node.title)
      ? { ...node, type: "volume" as const }
      : node),
  };
}

function clientFor(settings: ModelSettings) {
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

export async function generateText(settings: ModelSettings, system: string, prompt: string) {
  const client = clientFor(settings);
  if (settings.provider === "openai") {
    const response = await client.responses.create({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input: prompt,
    });
    return response.output_text;
  }
  const response = await client.chat.completions.create({
    model: settings.model || process.env.LOCAL_MODEL || "qwen3:8b",
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  return response.choices[0]?.message.content ?? "";
}

export async function generateOutline(settings: ModelSettings, context: string, instruction: string) {
  const client = clientFor(settings);
  const system = "你是长篇小说策划编辑。严格尊重已有硬设定和事件因果。只提出可执行的大纲节点，不写正文。";
  if (settings.provider === "openai") {
    const response = await client.responses.parse({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input: `${context}\n\n用户要求：${instruction}`,
      text: { format: zodTextFormat(outlineProposalSchema, "outline_proposal") },
    });
    if (!response.output_parsed) throw new Error("模型没有返回可解析的大纲");
    return normalizeOverallVolumes(response.output_parsed);
  }
  const raw = await generateText(settings, `${system} 必须只返回 JSON，格式为 {"rationale":"...","nodes":[{"type":"chapter","title":"...","summary":"..."}]}`, `${context}\n\n用户要求：${instruction}`);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 大纲");
  return normalizeOverallVolumes(outlineProposalSchema.parse(JSON.parse(match[0])));
}

export async function generateVolumeExpansion(settings: ModelSettings, context: string, currentVolume: string, instruction: string) {
  const client = clientFor(settings);
  const system = "你是长篇小说分卷策划编辑。把用户指定的一卷细化为可写作的章和场景，严格尊重全书人物、关系、硬设定和事件因果。只规划这一卷，不修改其他卷，不写正文。每个场景必须紧跟在所属章之后。";
  const input = `${context}\n\n待展开的卷：\n${currentVolume}\n\n用户要求：${instruction}`;
  if (settings.provider === "openai") {
    const response = await client.responses.parse({
      model: settings.model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: system,
      input,
      text: { format: zodTextFormat(volumeExpansionSchema, "volume_expansion") },
    });
    if (!response.output_parsed) throw new Error("模型没有返回可解析的分卷章节");
    return response.output_parsed;
  }
  const raw = await generateText(settings, `${system} 必须只返回 JSON，格式为 {"rationale":"...","nodes":[{"type":"chapter","title":"...","summary":"..."},{"type":"scene","title":"...","summary":"..."}]}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 分卷章节");
  return volumeExpansionSchema.parse(JSON.parse(match[0]));
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
