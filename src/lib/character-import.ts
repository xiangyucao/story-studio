export type ImportedCharacter = {
  name: string;
  role: string;
  description: string;
  goal: string;
  fear: string;
  secret: string;
  voice: string;
};

export type ImportedRelationship = {
  sourceName: string;
  targetName: string;
  type: string;
  description: string;
};

export type CharacterImportData = {
  characters: ImportedCharacter[];
  relationships: ImportedRelationship[];
};

export const normalizeCharacterName = (name: string) => name.trim().toLocaleLowerCase();

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是对象`);
  return value as Record<string, unknown>;
}

function textField(record: Record<string, unknown>, key: string, label: string, required = false) {
  const value = record[key];
  if (value == null) {
    if (required) throw new Error(`${label}不能为空`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${label}必须是文本`);
  const text = value.trim();
  if (required && !text) throw new Error(`${label}不能为空`);
  return text;
}

export function normalizeCharacterImportData(value: unknown): CharacterImportData {
  const root = objectValue(value, "JSON 根节点");
  if (!Array.isArray(root.characters)) throw new Error("JSON 必须包含 characters 数组");
  if (root.relationships != null && !Array.isArray(root.relationships)) throw new Error("relationships 必须是数组");

  const characters = root.characters.map((value, index) => {
    const record = objectValue(value, `第 ${index + 1} 个人物`);
    return {
      name: textField(record, "name", `第 ${index + 1} 个人物的 name`, true),
      role: textField(record, "role", `人物“${String(record.name || index + 1)}”的 role`),
      description: textField(record, "description", `人物“${String(record.name || index + 1)}”的 description`),
      goal: textField(record, "goal", `人物“${String(record.name || index + 1)}”的 goal`),
      fear: textField(record, "fear", `人物“${String(record.name || index + 1)}”的 fear`),
      secret: textField(record, "secret", `人物“${String(record.name || index + 1)}”的 secret`),
      voice: textField(record, "voice", `人物“${String(record.name || index + 1)}”的 voice`),
    };
  });

  const seenCharacters = new Set<string>();
  characters.forEach((character) => {
    const key = normalizeCharacterName(character.name);
    if (seenCharacters.has(key)) throw new Error(`JSON 中的人物“${character.name}”重复出现`);
    seenCharacters.add(key);
  });

  const relationships = (root.relationships || []).map((value, index) => {
    const record = objectValue(value, `第 ${index + 1} 条关系`);
    const relationship = {
      sourceName: textField(record, "sourceName", `第 ${index + 1} 条关系的 sourceName`, true),
      targetName: textField(record, "targetName", `第 ${index + 1} 条关系的 targetName`, true),
      type: textField(record, "type", `第 ${index + 1} 条关系的 type`, true),
      description: textField(record, "description", `第 ${index + 1} 条关系的 description`),
    };
    if (normalizeCharacterName(relationship.sourceName) === normalizeCharacterName(relationship.targetName)) {
      throw new Error(`第 ${index + 1} 条关系不能连接同一个人物`);
    }
    return relationship;
  });

  const seenRelationships = new Set<string>();
  relationships.forEach((relationship) => {
    const key = `${normalizeCharacterName(relationship.sourceName)}\u0000${normalizeCharacterName(relationship.targetName)}\u0000${relationship.type.toLocaleLowerCase()}`;
    if (seenRelationships.has(key)) throw new Error(`关系“${relationship.sourceName} → ${relationship.targetName}：${relationship.type}”重复出现`);
    seenRelationships.add(key);
  });

  if (!characters.length && !relationships.length) throw new Error("JSON 中没有可导入的人物或关系");
  return { characters, relationships };
}

export function parseCharacterImportJson(text: string) {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("文件不是有效的 JSON，请检查逗号、引号和括号");
  }
  return normalizeCharacterImportData(value);
}
