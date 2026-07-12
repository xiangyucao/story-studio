export type ImportedTimelineEvent = {
  title: string;
  storyTime: string;
  description: string;
  causes: string;
  consequences: string;
};

export type TimelineImportData = { events: ImportedTimelineEvent[] };

export const timelineImportExample: TimelineImportData = {
  events: [
    {
      title: "古董钟表发生时间跳跃",
      storyTime: "第一卷 · 深夜",
      description: "林弦修复古董钟表后，发现秒针会跳过特定刻度。",
      causes: "林弦的意识裂缝与模拟系统坏道产生共振。",
      consequences: "林弦开始记录城市异常坐标，并怀疑现实并不真实。",
    },
    {
      title: "402室邻居被系统抹除",
      storyTime: "第三卷 · 次日清晨",
      description: "邻居和房间被系统重置，其他居民的相关记忆也被修改。",
      causes: "402室邻居接触了正在扩大的逻辑漏洞。",
      consequences: "林弦确认系统能够删除居民并重写集体记忆。",
    },
  ],
};

export const normalizeTimelineEventTitle = (title: string) => title.trim().toLocaleLowerCase();

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是对象`);
  return value as Record<string, unknown>;
}

function optionalText(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${label}必须是文本`);
  return value.trim();
}

export function normalizeTimelineImportData(value: unknown): TimelineImportData {
  const root = objectValue(value, "JSON 根节点");
  if (!Array.isArray(root.events)) throw new Error("JSON 必须包含 events 数组");
  const events = root.events.map((value, index) => {
    const record = objectValue(value, `第 ${index + 1} 个时间线事件`);
    const title = optionalText(record, "title", `第 ${index + 1} 个事件的 title`);
    if (!title) throw new Error(`第 ${index + 1} 个事件的 title 不能为空`);
    return {
      title,
      storyTime: optionalText(record, "storyTime", `事件“${title}”的 storyTime`),
      description: optionalText(record, "description", `事件“${title}”的 description`),
      causes: optionalText(record, "causes", `事件“${title}”的 causes`),
      consequences: optionalText(record, "consequences", `事件“${title}”的 consequences`),
    };
  });
  if (!events.length) throw new Error("JSON 中没有可导入的时间线事件");
  const seen = new Set<string>();
  events.forEach((event) => {
    const key = normalizeTimelineEventTitle(event.title);
    if (seen.has(key)) throw new Error(`JSON 中的事件“${event.title}”重复出现`);
    seen.add(key);
  });
  return { events };
}

export function parseTimelineImportJson(text: string) {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("文件不是有效的 JSON，请检查逗号、引号和括号");
  }
  return normalizeTimelineImportData(value);
}
