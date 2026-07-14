import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ModelSettings } from "./types";
import { buildReferenceCandidates, selectReferenceCandidates } from "./reference-extraction";
import { aiPromptLocales } from "./ai-prompt-i18n";
import type { ResolvedWritingLanguage } from "./writing-language";

function localServerRoot(baseUrl?: string) {
  const url = new URL(baseUrl || process.env.LOCAL_MODEL_BASE_URL || "http://127.0.0.1:11434/v1");
  url.pathname = url.pathname.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function clearLocalModelContext(settings: ModelSettings) {
  if (settings.provider !== "openai-compatible") return { supported: false, clearedSlots: 0, erasedTokens: 0, error: "not-local-model" };
  const root = localServerRoot(settings.baseUrl);
  try {
    const slotsResponse = await fetch(`${root}/slots`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!slotsResponse.ok) return { supported: false, clearedSlots: 0, erasedTokens: 0, error: `slots-http-${slotsResponse.status}` };
    const raw = await slotsResponse.json() as unknown;
    const slots = (Array.isArray(raw) ? raw : [raw]) as Array<{ id?: number; is_processing?: boolean; n_prompt_tokens?: number }>;
    const idle = slots.filter((slot) => Number.isInteger(slot.id) && !slot.is_processing && Number(slot.n_prompt_tokens || 0) > 0);
    let clearedSlots = 0;
    let erasedTokens = 0;
    let error = "";
    for (const slot of idle) {
      const response = await fetch(`${root}/slots/${slot.id}?action=erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        error = `erase-http-${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`;
        continue;
      }
      const result = await response.json() as { n_erased?: number };
      clearedSlots += 1;
      erasedTokens += Number(result.n_erased || slot.n_prompt_tokens || 0);
    }
    return { supported: idle.length === 0 || clearedSlots > 0, clearedSlots, erasedTokens, error: error || undefined };
  } catch (cause) {
    return { supported: false, clearedSlots: 0, erasedTokens: 0, error: cause instanceof Error ? cause.message : "context-clear-failed" };
  }
}

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

export async function generateOutline(settings: ModelSettings, context: string, instruction: string, volumeCount = 7, language: ResolvedWritingLanguage = "zh-CN") {
  const client = clientFor(settings);
  const locale = aiPromptLocales[language];
  const system = locale.outlineSystem(volumeCount);
  const input = locale.outlineInput(context, instruction, volumeCount);
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
  const raw = await generateText(settings, `${system} ${locale.jsonOutline}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 大纲");
  const parsed = outlineProposalSchema.parse(JSON.parse(match[0]));
  if (parsed.nodes.length !== volumeCount) throw new Error(`本地模型返回了 ${parsed.nodes.length} 卷，但要求是 ${volumeCount} 卷，请重新生成`);
  return parsed;
}

export async function generateVolumeExpansion(settings: ModelSettings, context: string, currentVolume: string, instruction: string, chapterCount = 7, language: ResolvedWritingLanguage = "zh-CN") {
  const client = clientFor(settings);
  const locale = aiPromptLocales[language];
  const system = locale.volumeSystem(chapterCount);
  const input = locale.volumeInput(context, currentVolume, instruction, chapterCount);
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
  const raw = await generateText(settings, `${system} ${locale.jsonVolume}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 分卷章节");
  const parsed = volumeExpansionSchema.parse(JSON.parse(match[0]));
  const chapters = parsed.nodes.filter((node) => node.type === "chapter");
  if (chapters.length !== chapterCount) throw new Error(`本地模型返回了 ${chapters.length} 章，但要求是 ${chapterCount} 章，请重新生成`);
  return parsed;
}

export async function generateOutlineNode(settings: ModelSettings, context: string, currentNode: string, instruction: string, language: ResolvedWritingLanguage = "zh-CN") {
  const client = clientFor(settings);
  const locale = aiPromptLocales[language];
  const system = locale.nodeSystem;
  const input = locale.nodeInput(context, currentNode, instruction);
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
  const raw = await generateText(settings, `${system} ${locale.jsonNode}`, input);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("本地模型没有返回 JSON 节点提案");
  return outlineNodeProposalSchema.parse(JSON.parse(match[0]));
}

export async function generateReferenceSample(settings: ModelSettings, referenceText: string, targetLength = 10000) {
  const length = Math.max(1000, Math.min(50000, Math.round(targetLength || 10000)));
  const candidates = buildReferenceCandidates(referenceText);
  const system = "你是文学样本编辑。用户会提供带编号的原文段落。请选择最能代表其叙事视角、句式、节奏、氛围、对话和描写方式的段落编号。不要机械地选择开头、中段和结尾，要根据文体代表性判断。";
  const prompt = `目标：选择总计约 ${length} 个中文字的代表性段落。只返回 JSON：{"selectedIds":["R0001","R0007"]}。编号按原文顺序排列，不要返回原文、解释或其他字段。\n\n【候选原文段落】\n${candidates.map((candidate) => `[${candidate.id}]（${candidate.text.replace(/\s/g, "").length} 字）\n${candidate.text}`).join("\n\n")}`;
  const response = (await generateText(settings, system, prompt)).trim();
  return selectReferenceCandidates(response, candidates, length);
}
