import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CompatibleModel = { id?: string; model?: string; name?: string };

const defaultLocalUrls = [
  process.env.LOCAL_MODEL_BASE_URL,
  "http://127.0.0.1:18080/v1",
  "http://127.0.0.1:8080/v1",
  "http://127.0.0.1:11434/v1",
].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Base URL 必须使用 http 或 https");
  return url.toString().replace(/\/$/, "");
}

async function inspect(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  const response = await fetch(`${normalized}/models`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}`);
  const payload = await response.json() as { data?: CompatibleModel[]; models?: CompatibleModel[] };
  const entries = payload.data?.length ? payload.data : payload.models;
  const models = (entries || []).map((item) => item.id || item.model || item.name).filter((id): id is string => Boolean(id));
  if (!models.length) throw new Error("服务在线，但没有报告可用模型");
  return { baseUrl: normalized, models };
}

export async function GET() {
  for (const baseUrl of defaultLocalUrls) {
    try {
      const result = await inspect(baseUrl);
      return NextResponse.json({ found: true, ...result });
    } catch {
      // 继续尝试下一个常见的本地推理端口。
    }
  }
  return NextResponse.json({ found: false, error: "没有在常见端口发现 OpenAI-compatible 本地模型" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { baseUrl?: string };
    if (!body.baseUrl?.trim()) return NextResponse.json({ error: "请输入 Base URL" }, { status: 400 });
    return NextResponse.json({ found: true, ...await inspect(body.baseUrl) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "连接模型失败" }, { status: 500 });
  }
}
