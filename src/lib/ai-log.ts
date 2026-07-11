import "server-only";
import fs from "node:fs";
import path from "node:path";

export const aiLogPath = process.env.STORY_STUDIO_AI_LOG
  ? path.resolve(process.env.STORY_STUDIO_AI_LOG)
  : path.join(process.env.STORY_STUDIO_DATA_DIR ? path.resolve(process.env.STORY_STUDIO_DATA_DIR) : path.join(process.cwd(), "data"), "ai-requests.jsonl");

export function writeAiLog(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(path.dirname(aiLogPath), { recursive: true });
    fs.appendFileSync(aiLogPath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, "utf8");
  } catch (error) {
    console.error("Story Studio AI log write failed", error);
  }
}
