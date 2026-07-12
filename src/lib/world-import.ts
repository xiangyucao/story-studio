export type ImportedWorldEntry = {
  name: string;
  category: string;
  description: string;
  isHardSetting: boolean | null;
};

export type WorldImportData = { worldEntries: ImportedWorldEntry[] };

export const worldImportExample: WorldImportData = {
  worldEntries: [
    {
      name: "翡翠城",
      category: "地点 / 表层世界",
      description: "秩序井然的近未来城市，实际上是覆盖在模拟系统上的视觉贴图。",
      isHardSetting: true,
    },
    {
      name: "零号冷库",
      category: "地点 / 真实世界",
      description: "位于南极地下、保存人类意识服务器阵列的设施。",
      isHardSetting: true,
    },
  ],
};

export const normalizeWorldEntryName = (name: string) => name.trim().toLocaleLowerCase();

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

export function normalizeWorldImportData(value: unknown): WorldImportData {
  const root = objectValue(value, "JSON 根节点");
  if (!Array.isArray(root.worldEntries)) throw new Error("JSON 必须包含 worldEntries 数组");
  const worldEntries = root.worldEntries.map((value, index) => {
    const record = objectValue(value, `第 ${index + 1} 条世界观设定`);
    const name = optionalText(record, "name", `第 ${index + 1} 条设定的 name`);
    if (!name) throw new Error(`第 ${index + 1} 条设定的 name 不能为空`);
    const legacyIsCanon = record.isCanon;
    const isHardSetting = record.isHardSetting == null ? (legacyIsCanon == null ? null : legacyIsCanon) : record.isHardSetting;
    if (isHardSetting !== null && typeof isHardSetting !== "boolean") throw new Error(`设定“${name}”的 isHardSetting 必须是 true 或 false`);
    return {
      name,
      category: optionalText(record, "category", `设定“${name}”的 category`),
      description: optionalText(record, "description", `设定“${name}”的 description`),
      isHardSetting,
    };
  });
  if (!worldEntries.length) throw new Error("JSON 中没有可导入的世界观设定");
  const seen = new Set<string>();
  worldEntries.forEach((entry) => {
    const key = normalizeWorldEntryName(entry.name);
    if (seen.has(key)) throw new Error(`JSON 中的设定“${entry.name}”重复出现`);
    seen.add(key);
  });
  return { worldEntries };
}

export function parseWorldImportJson(text: string) {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("文件不是有效的 JSON，请检查逗号、引号和括号");
  }
  return normalizeWorldImportData(value);
}
