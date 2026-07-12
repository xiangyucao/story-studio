import type { OutlineNode, Workspace } from "./types";

export type OutlineJsonNode = {
  id?: string;
  type: "volume" | "chapter" | "scene";
  title: string;
  summary: string;
  status: string;
  children: OutlineJsonNode[];
};
export type OutlineJsonData = { version: 1; title?: string; outline: OutlineJsonNode[] };

const nodeTypes = new Set(["volume", "chapter", "scene"]);

function parseNode(value: unknown, parentType?: OutlineJsonNode["type"]): OutlineJsonNode {
  if (!value || typeof value !== "object") throw new Error("大纲节点必须是对象");
  const row = value as Record<string, unknown>;
  const type = String(row.type || "") as OutlineJsonNode["type"];
  const title = String(row.title || "").trim();
  if (!nodeTypes.has(type)) throw new Error(`节点“${title || "未命名"}”的 type 必须是 volume、chapter 或 scene`);
  if (!title) throw new Error("每个大纲节点都必须填写 title");
  if (parentType === "scene" || (parentType === "chapter" && type !== "scene") || (parentType === "volume" && type !== "chapter")) {
    throw new Error(`节点层级无效：${parentType} 下不能放置 ${type}`);
  }
  const children = row.children === undefined ? [] : row.children;
  if (!Array.isArray(children)) throw new Error(`节点“${title}”的 children 必须是数组`);
  return { id: row.id ? String(row.id) : undefined, type, title, summary: String(row.summary || ""), status: String(row.status || "planned"), children: children.map((child) => parseNode(child, type)) };
}

export function parseOutlineJson(text: string): OutlineJsonData {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("JSON 格式无效，请检查逗号、引号和括号"); }
  if (!raw || typeof raw !== "object") throw new Error("JSON 根节点必须是对象");
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.outline)) throw new Error("JSON 必须包含 outline 数组");
  return { version: 1, title: data.title ? String(data.title) : undefined, outline: data.outline.map((node) => parseNode(node)) };
}

export function exportOutlineJson(workspace: Workspace): OutlineJsonData {
  const children = new Map<string | null, OutlineNode[]>();
  workspace.outline.forEach((node) => children.set(node.parentId, [...(children.get(node.parentId) || []), node]));
  const build = (node: OutlineNode): OutlineJsonNode => ({ id: node.id, type: node.type, title: node.title, summary: node.summary, status: node.status, children: (children.get(node.id) || []).map(build) });
  return { version: 1, title: workspace.project.title, outline: (children.get(null) || []).map(build) };
}

export function findChangedWrittenChapters(workspace: Workspace, data: OutlineJsonData) {
  const imported = new Map<string, OutlineJsonNode>();
  const visit = (nodes: OutlineJsonNode[]) => nodes.forEach((node) => { if (node.id) imported.set(node.id, node); visit(node.children); });
  visit(data.outline);
  return workspace.chapters.filter((chapter) => {
    if (!chapter.content.trim() || !chapter.outlineNodeId) return false;
    const current = workspace.outline.find((node) => node.id === chapter.outlineNodeId);
    const next = imported.get(chapter.outlineNodeId);
    return Boolean(current && next && (current.title !== next.title || current.summary !== next.summary));
  });
}

export const outlineJsonExample: OutlineJsonData = { version: 1, title: "示例作品", outline: [{ type: "volume", title: "第一卷：觉醒", summary: "主角发现世界存在异常。", status: "planned", children: [{ type: "chapter", title: "第1章：裂缝", summary: "主角第一次观察到无法解释的现象。", status: "planned", children: [{ type: "scene", title: "广场异常", summary: "影子的方向与太阳矛盾。", status: "planned", children: [] }] }] }] };
