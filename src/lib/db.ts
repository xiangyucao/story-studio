import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Chapter,
  Character,
  Illustration,
  OutlineNode,
  Project,
  Relationship,
  Revision,
  StoryEvent,
  Workspace,
  WorldEntry,
} from "./types";

const dataDir = process.env.STORY_STUDIO_DATA_DIR
  ? path.resolve(process.env.STORY_STUDIO_DATA_DIR)
  : path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "story-studio.db");
const db = new Database(dbPath);
db.pragma("busy_timeout = 10000");
if (db.pragma("journal_mode", { simple: true }) !== "wal") {
  db.pragma("journal_mode = WAL");
}
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    genre TEXT NOT NULL DEFAULT '',
    premise TEXT NOT NULL DEFAULT '',
    style_guide TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outline_nodes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES outline_nodes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('volume','chapter','scene')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned'
  );
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    outline_node_id TEXT REFERENCES outline_nodes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    position INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    fear TEXT NOT NULL DEFAULT '',
    secret TEXT NOT NULL DEFAULT '',
    voice TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    target_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS world_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT '背景',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_canon INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS story_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    story_time TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    causes TEXT NOT NULL DEFAULT '',
    consequences TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_content TEXT NOT NULL DEFAULT '',
    after_content TEXT NOT NULL DEFAULT '',
    instruction TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS illustrations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id, position);
  CREATE INDEX IF NOT EXISTS idx_outline_project ON outline_nodes(project_id, position);
  CREATE INDEX IF NOT EXISTS idx_events_project ON story_events(project_id);
`);

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const id = () => randomUUID();

function projectFrom(row: Row): Project {
  return {
    id: String(row.id), title: String(row.title), genre: String(row.genre),
    premise: String(row.premise), styleGuide: String(row.style_guide),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number };
  if (count.count > 0) return;
  const projectId = id();
  const chapter1 = id();
  const chapter2 = id();
  const lin = id();
  const chen = id();
  const created = now();
  const seed = db.transaction(() => {
    db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      projectId, "雾港来信（示例项目）", "悬疑 / 家族秘密",
      "离乡十年的林月收到失踪父亲寄出的信，回到终年起雾的海港寻找真相。",
      "克制、具象；避免全知视角；重要揭示必须有前置伏笔。", created, created,
    );
    const addOutline = db.prepare("INSERT INTO outline_nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const volume = id();
    addOutline.run(volume, projectId, null, "volume", "第一卷：归港", "回归、试探与第一条无法解释的线索。", 0, "planned");
    addOutline.run(id(), projectId, volume, "chapter", "第一章：迟到十年的信", "林月收到父亲刚刚寄出的信。", 0, "drafted");
    addOutline.run(id(), projectId, volume, "chapter", "第二章：仓库钥匙", "陈叔交出一把来历不明的旧钥匙。", 1, "planned");
    const addChapter = db.prepare("INSERT INTO chapters VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const content = "雨从凌晨一直落到傍晚。\n\n林月拆开那封信时，先看见了信封右下角晕开的蓝墨水。那是父亲的字。十年前，他也是用同样的墨水写下最后一张便条：出去一趟。\n\n邮戳却是昨天。";
    addChapter.run(chapter1, projectId, null, "第一章：迟到十年的信", content, "林月收到不可能来自父亲的信。", "draft", 0, content.length, created);
    addChapter.run(chapter2, projectId, null, "第二章：仓库钥匙", "", "林月回到雾港，陈叔交给她仓库钥匙。", "planned", 1, 0, created);
    const addCharacter = db.prepare("INSERT INTO characters VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    addCharacter.run(lin, projectId, "林月", "主角", "三十二岁，调查记者，习惯把情绪变成问题。", "确认父亲失踪的真相", "自己记错了童年最关键的一晚", "十年前曾偷偷进入过旧仓库", "短句、追问，很少直接表达感受", "active");
    addCharacter.run(chen, projectId, "陈叔", "引路人 / 嫌疑人", "父亲旧友，经营港口修理铺。", "阻止旧案再次伤害林家", "林月发现他参与销毁证据", "替林父保管仓库钥匙", "说话绕弯，常用天气转移话题", "active");
    db.prepare("INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?)").run(id(), projectId, lin, chen, "不完全信任", "陈叔照顾过林月，却持续隐瞒失踪当晚的行踪。");
    db.prepare("INSERT INTO world_entries VALUES (?, ?, ?, ?, ?, ?)").run(id(), projectId, "地点", "七号旧仓库", "港区封存建筑。地下层在官方图纸上不存在。", 1);
    db.prepare("INSERT INTO world_entries VALUES (?, ?, ?, ?, ?, ?)").run(id(), projectId, "规则", "雾港潮汐", "每月最低潮时，旧防波堤下的通道会露出约四十分钟。", 1);
    db.prepare("INSERT INTO story_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id(), projectId, chapter1, "收到父亲来信", "故事第1天傍晚", "林月收到带有昨日邮戳的父亲亲笔信。", "有人取得父亲旧信纸与钢笔，或父亲仍然活着。", "林月决定返回雾港。" );
    db.prepare("INSERT INTO story_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id(), projectId, chapter2, "取得仓库钥匙", "故事第2天上午", "陈叔将七号仓库钥匙交给林月。", "陈叔受林父委托保管钥匙。", "林月可以进入七号仓库调查。" );
  });
  seed();
}

seedIfEmpty();

export function listProjects(): Project[] {
  return (db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Row[]).map(projectFrom);
}

export function getWorkspace(projectId?: string): Workspace {
  const projects = listProjects();
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  if (!project) throw new Error("没有可用项目");
  const outline = (db.prepare("SELECT * FROM outline_nodes WHERE project_id = ? ORDER BY position, rowid").all(project.id) as Row[]).map((r): OutlineNode => ({
    id: String(r.id), projectId: String(r.project_id), parentId: r.parent_id ? String(r.parent_id) : null,
    type: r.type as OutlineNode["type"], title: String(r.title), summary: String(r.summary), position: Number(r.position), status: String(r.status),
  }));
  const chapters = (db.prepare("SELECT * FROM chapters WHERE project_id = ? ORDER BY position, rowid").all(project.id) as Row[]).map((r): Chapter => ({
    id: String(r.id), projectId: String(r.project_id), outlineNodeId: r.outline_node_id ? String(r.outline_node_id) : null,
    title: String(r.title), content: String(r.content), summary: String(r.summary), status: String(r.status),
    position: Number(r.position), wordCount: Number(r.word_count), updatedAt: String(r.updated_at),
  }));
  const characters = (db.prepare("SELECT * FROM characters WHERE project_id = ? ORDER BY rowid").all(project.id) as Row[]).map((r): Character => ({
    id: String(r.id), projectId: String(r.project_id), name: String(r.name), role: String(r.role), description: String(r.description),
    goal: String(r.goal), fear: String(r.fear), secret: String(r.secret), voice: String(r.voice), status: String(r.status),
  }));
  const relationships = (db.prepare(`SELECT r.*, s.name source_name, t.name target_name FROM relationships r
    JOIN characters s ON s.id = r.source_character_id JOIN characters t ON t.id = r.target_character_id
    WHERE r.project_id = ? ORDER BY r.rowid`).all(project.id) as Row[]).map((r): Relationship => ({
      id: String(r.id), projectId: String(r.project_id), sourceCharacterId: String(r.source_character_id), targetCharacterId: String(r.target_character_id),
      sourceName: String(r.source_name), targetName: String(r.target_name), type: String(r.type), description: String(r.description),
    }));
  const worldEntries = (db.prepare("SELECT * FROM world_entries WHERE project_id = ? ORDER BY category, rowid").all(project.id) as Row[]).map((r): WorldEntry => ({
    id: String(r.id), projectId: String(r.project_id), category: String(r.category), name: String(r.name), description: String(r.description), isCanon: Boolean(r.is_canon),
  }));
  const events = (db.prepare(`SELECT e.*, c.title chapter_title FROM story_events e LEFT JOIN chapters c ON c.id = e.chapter_id
    WHERE e.project_id = ? ORDER BY e.story_time, e.rowid`).all(project.id) as Row[]).map((r): StoryEvent => ({
      id: String(r.id), projectId: String(r.project_id), chapterId: r.chapter_id ? String(r.chapter_id) : null,
      chapterTitle: r.chapter_title ? String(r.chapter_title) : null, title: String(r.title), storyTime: String(r.story_time),
      description: String(r.description), causes: String(r.causes), consequences: String(r.consequences),
    }));
  const illustrations = (db.prepare("SELECT * FROM illustrations WHERE project_id = ? ORDER BY chapter_id, position, created_at").all(project.id) as Row[]).map((r): Illustration => ({
    id: String(r.id), projectId: String(r.project_id), chapterId: String(r.chapter_id), fileName: String(r.file_name),
    mimeType: String(r.mime_type), caption: String(r.caption), position: Number(r.position), createdAt: String(r.created_at),
  }));
  const revisions = (db.prepare("SELECT * FROM revisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 30").all(project.id) as Row[]).map((r): Revision => ({
    id: String(r.id), entityType: String(r.entity_type), entityId: String(r.entity_id), beforeContent: String(r.before_content),
    afterContent: String(r.after_content), instruction: String(r.instruction), createdAt: String(r.created_at),
  }));
  return { projects, project, outline, chapters, characters, relationships, worldEntries, events, illustrations, revisions };
}

export function createProject(title: string) {
  const projectId = id();
  const timestamp = now();
  db.transaction(() => {
    db.prepare("INSERT INTO projects VALUES (?, ?, '', '', '', ?, ?)").run(projectId, title || "未命名作品", timestamp, timestamp);
    const outlineId = id();
    db.prepare("INSERT INTO outline_nodes VALUES (?, ?, NULL, 'chapter', '第一章', '', 0, 'planned')").run(outlineId, projectId);
    db.prepare("INSERT INTO chapters VALUES (?, ?, ?, '第一章', '', '', 'draft', 0, 0, ?)").run(id(), projectId, outlineId, timestamp);
  })();
  return projectId;
}

export function createIllustration(input: { projectId: string; chapterId: string; fileName: string; storedName: string; mimeType: string; caption: string }) {
  const illustrationId = id();
  const max = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM illustrations WHERE chapter_id=?").get(input.chapterId) as { p: number };
  db.prepare("INSERT INTO illustrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    illustrationId, input.projectId, input.chapterId, input.fileName, input.storedName, input.mimeType, input.caption, max.p + 1, now(),
  );
  return illustrationId;
}

export function getIllustrationAsset(illustrationId: string) {
  return db.prepare("SELECT stored_name, file_name, mime_type FROM illustrations WHERE id=?").get(illustrationId) as { stored_name: string; file_name: string; mime_type: string } | undefined;
}

export function mutateWorkspace(action: string, payload: Record<string, unknown>) {
  const timestamp = now();
  switch (action) {
    case "save-project":
      db.prepare("UPDATE projects SET title=?, genre=?, premise=?, style_guide=?, updated_at=? WHERE id=?").run(payload.title, payload.genre, payload.premise, payload.styleGuide, timestamp, payload.id);
      return payload.id;
    case "create-chapter": {
      const chapterId = id();
      const max = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM chapters WHERE project_id=?").get(payload.projectId) as { p: number };
      db.prepare("INSERT INTO chapters VALUES (?, ?, NULL, ?, '', '', 'draft', ?, 0, ?)").run(chapterId, payload.projectId, payload.title || "新章节", max.p + 1, timestamp);
      return chapterId;
    }
    case "save-chapter": {
      const previous = db.prepare("SELECT content, project_id FROM chapters WHERE id=?").get(payload.id) as { content: string; project_id: string };
      const content = String(payload.content ?? "");
      db.prepare("UPDATE chapters SET title=?, content=?, summary=?, status=?, word_count=?, updated_at=? WHERE id=?").run(payload.title, content, payload.summary ?? "", payload.status ?? "draft", content.replace(/\s/g, "").length, timestamp, payload.id);
      if (payload.instruction && previous && previous.content !== content) {
        db.prepare("INSERT INTO revisions VALUES (?, ?, 'chapter', ?, ?, ?, ?, ?)").run(id(), previous.project_id, payload.id, previous.content, content, payload.instruction, timestamp);
      }
      return payload.id;
    }
    case "create-character": {
      const characterId = id();
      db.prepare("INSERT INTO characters VALUES (?, ?, ?, '', '', '', '', '', '', 'active')").run(characterId, payload.projectId, payload.name || "新人物");
      return characterId;
    }
    case "save-character":
      db.prepare("UPDATE characters SET name=?, role=?, description=?, goal=?, fear=?, secret=?, voice=?, status=? WHERE id=?").run(payload.name, payload.role, payload.description, payload.goal, payload.fear, payload.secret, payload.voice, payload.status ?? "active", payload.id);
      return payload.id;
    case "create-world": {
      const entryId = id();
      db.prepare("INSERT INTO world_entries VALUES (?, ?, ?, ?, ?, ?)").run(entryId, payload.projectId, payload.category || "背景", payload.name || "新设定", payload.description || "", payload.isCanon === false ? 0 : 1);
      return entryId;
    }
    case "create-event": {
      const eventId = id();
      db.prepare("INSERT INTO story_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(eventId, payload.projectId, payload.chapterId || null, payload.title || "新事件", payload.storyTime || "", payload.description || "", payload.causes || "", payload.consequences || "");
      return eventId;
    }
    case "create-relationship": {
      const relationId = id();
      db.prepare("INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?)").run(relationId, payload.projectId, payload.sourceCharacterId, payload.targetCharacterId, payload.type || "关系", payload.description || "");
      return relationId;
    }
    case "apply-outline": {
      const nodes = Array.isArray(payload.nodes) ? payload.nodes as Array<Record<string, unknown>> : [];
      const insert = db.prepare("INSERT INTO outline_nodes VALUES (?, ?, NULL, ?, ?, ?, ?, 'planned')");
      const max = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM outline_nodes WHERE project_id=?").get(payload.projectId) as { p: number };
      db.transaction(() => nodes.forEach((node, index) => insert.run(id(), payload.projectId, node.type || "chapter", node.title || `节点 ${index + 1}`, node.summary || "", max.p + index + 1)))();
      return payload.projectId;
    }
    default:
      throw new Error(`不支持的操作：${action}`);
  }
}

export function searchLogic(projectId: string, query: string) {
  const workspace = getWorkspace(projectId);
  const normalized = query.toLowerCase().replace(/[，。？！、：；,.?!:;]/g, " ");
  const chunks = normalized
    .split(/\s+|为什么|怎么|如何|可以|能够|是否|进入|关于|哪些|什么|以及|因为|所以|的|了/)
    .filter((term) => term.length > 1);
  const terms = [...new Set(chunks.flatMap((chunk) => {
    if (chunk.length <= 2) return [chunk];
    const grams = [chunk];
    for (let index = 0; index < chunk.length - 1; index += 1) grams.push(chunk.slice(index, index + 2));
    return grams;
  }))];
  const score = (text: string) => terms.reduce((total, term) => total + (text.toLowerCase().includes(term) ? Math.min(term.length, 4) : 0), 0);
  const eventHits = workspace.events
    .map((event) => ({ event, score: score(`${event.title} ${event.description} ${event.causes} ${event.consequences} ${event.storyTime}`) }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map((item) => item.event);
  const characterHits = workspace.characters.filter((c) => score(`${c.name} ${c.role} ${c.goal} ${c.fear} ${c.secret} ${c.description}`) > 0).slice(0, 6);
  const worldHits = workspace.worldEntries.filter((w) => score(`${w.name} ${w.category} ${w.description}`) > 0).slice(0, 6);
  return { eventHits, characterHits, worldHits };
}

export { dataDir, dbPath };
