"use client";
/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle, BookOpen, Bot, BrainCircuit, Check, ChevronDown, ChevronRight, CirclePlus, Clock3,
  Download, FileText, FileType2, GitBranch, History, ImagePlus, LoaderCircle,
  Network, Printer, Save, Search, Settings, Sparkles, Users, WandSparkles, X,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chapter, Character, ModelSettings, Project, Relationship, StoryEvent, Workspace, WorldEntry } from "@/lib/types";
import { normalizeCharacterName, parseCharacterImportJson, type CharacterImportData } from "@/lib/character-import";

type Tab = "write" | "outline" | "characters" | "world" | "logic" | "history";
type AiAction = "outline" | "outline-volume" | "outline-node" | "expand" | "revise" | "logic";
type NodeCreateDraft = { type: "volume" | "chapter" | "scene"; parentId: string | null; afterId: string | null; title: string; summary: string; heading: string };
type RelationshipDraft = { sourceCharacterId: string; targetCharacterId: string; type: string; description: string };
type CharacterImportPreview = { fileName: string; data: CharacterImportData; missingNames: string[] };
type AiProposal = { type: "text"; result: string; targetChapterId?: string; requestId?: string } | {
  type: "outline";
  proposal: { rationale: string; nodes: Array<{ type: "volume" | "chapter" | "scene"; title: string; summary: string }> };
} | {
  type: "outline-volume";
  proposal: { rationale: string; nodes: Array<{ type: "chapter" | "scene"; title: string; summary: string }> };
} | { type: "outline-node"; proposal: { rationale: string; title: string; summary: string } };

const navItems: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
  { id: "outline", label: "大纲", icon: GitBranch },
  { id: "write", label: "写作", icon: FileText },
  { id: "characters", label: "人物", icon: Users },
  { id: "world", label: "世界观", icon: BookOpen },
  { id: "logic", label: "逻辑链", icon: Network },
  { id: "history", label: "版本", icon: History },
];

const defaultSettings: ModelSettings = {
  provider: "openai",
  model: "gpt-5.4-mini",
  baseUrl: "http://127.0.0.1:18080/v1",
};

type ModelDiscovery = { found: boolean; baseUrl: string; models: string[] };

const isVolumeLikeNode = (node: Workspace["outline"][number]) => node.type === "volume" || (node.type === "chapter" && /^第[0-9一二三四五六七八九十百]+卷(?:[：:\s]|$)/.test(node.title));

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(`${data.error || "请求失败"}${data.requestId ? `（日志编号：${data.requestId}）` : ""}`);
  return data as T;
}

export function StoryStudio() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("outline");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [selectedOutlineId, setSelectedOutlineId] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [chapterDraft, setChapterDraft] = useState<Chapter | null>(null);
  const [characterDraft, setCharacterDraft] = useState<Character | null>(null);
  const [relationshipEditDraft, setRelationshipEditDraft] = useState<Relationship | null>(null);
  const [outlineDraft, setOutlineDraft] = useState<Workspace["outline"][number] | null>(null);
  const [worldDraft, setWorldDraft] = useState<WorldEntry | null>(null);
  const [eventDraft, setEventDraft] = useState<StoryEvent | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelCheckBusy, setModelCheckBusy] = useState(false);
  const [modelCheckMessage, setModelCheckMessage] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [overallOutlineOpen, setOverallOutlineOpen] = useState(false);
  const [nodeCreateDraft, setNodeCreateDraft] = useState<NodeCreateDraft | null>(null);
  const [deleteOutlineOpen, setDeleteOutlineOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft | null>(null);
  const [characterImportPreview, setCharacterImportPreview] = useState<CharacterImportPreview | null>(null);
  const characterImportInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<ModelSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    const saved = localStorage.getItem("story-studio-model-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiAction, setAiAction] = useState<AiAction>("revise");
  const [outlineVolumeCount, setOutlineVolumeCount] = useState(7);
  const [volumeChapterCount, setVolumeChapterCount] = useState(7);
  const [proposalAction, setProposalAction] = useState<AiAction>("revise");
  const [outlineAiInstruction, setOutlineAiInstruction] = useState("");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [aiError, setAiError] = useState("");
  const [logicQuery, setLogicQuery] = useState("");
  const [logicAnswer, setLogicAnswer] = useState("");
  const [collapsedWritingVolumes, setCollapsedWritingVolumes] = useState<Set<string>>(() => new Set());
  const [collapsedOutlineVolumes, setCollapsedOutlineVolumes] = useState<Set<string>>(() => new Set());

  const loadWorkspace = useCallback(async (projectId?: string, preferredOutlineId?: string) => {
    setBusy(true);
    try {
      const data = await jsonFetch<Workspace>(`/api/workspace${projectId ? `?projectId=${projectId}` : ""}`);
      setWorkspace(data);
      setProjectDraft({ ...data.project });
      const chapter = data.chapters.find((item) => item.id === selectedChapterId) ?? data.chapters[0] ?? null;
      const character = data.characters.find((item) => item.id === selectedCharacterId) ?? data.characters[0] ?? null;
      const relationship = data.relationships.find((item) => item.id === selectedRelationshipId) ?? data.relationships[0] ?? null;
      const outlineNode = data.outline.find((item) => item.id === (preferredOutlineId || selectedOutlineId)) ?? data.outline[0] ?? null;
      const worldEntry = data.worldEntries.find((item) => item.id === selectedWorldId) ?? data.worldEntries[0] ?? null;
      const storyEvent = data.events.find((item) => item.id === selectedEventId) ?? data.events[0] ?? null;
      setSelectedChapterId(chapter?.id || "");
      setChapterDraft(chapter);
      setSelectedCharacterId(character?.id || "");
      setCharacterDraft(character);
      setSelectedRelationshipId(relationship?.id || "");
      setRelationshipEditDraft(relationship ? { ...relationship } : null);
      setSelectedOutlineId(outlineNode?.id || "");
      setOutlineDraft(outlineNode ? { ...outlineNode } : null);
      setSelectedWorldId(worldEntry?.id || "");
      setWorldDraft(worldEntry ? { ...worldEntry } : null);
      setSelectedEventId(storyEvent?.id || "");
      setEventDraft(storyEvent ? { ...storyEvent } : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }, [selectedChapterId, selectedCharacterId, selectedRelationshipId, selectedOutlineId, selectedWorldId, selectedEventId]);

  useEffect(() => {
    // 首次挂载后从本地 API 载入持久化工作区。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace();
    // 初次加载只执行一次；后续刷新由显式操作触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localStorage.getItem("story-studio-model-settings")) return;
    void jsonFetch<ModelDiscovery>("/api/models").then((detected) => {
      const next = { provider: "openai-compatible" as const, model: detected.models[0], baseUrl: detected.baseUrl };
      setSettings(next);
      localStorage.setItem("story-studio-model-settings", JSON.stringify(next));
      setMessage(`已自动连接本地模型：${next.model}`);
    }).catch(() => undefined);
  }, []);

  const mutate = async (action: string, payload: Record<string, unknown>, reload = true) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await jsonFetch<{ result: string }>("/api/workspace", { method: "POST", body: JSON.stringify({ action, payload }) });
      if (reload) await loadWorkspace(workspace?.project.id);
      return response.result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const selectChapter = (chapter: Chapter) => {
    setSelectedChapterId(chapter.id);
    setChapterDraft({ ...chapter });
    setActiveTab("write");
    setProposal(null);
  };

  const saveChapter = async (instruction?: string, contentOverride?: string, clearOutlineStale = false) => {
    if (!chapterDraft) return;
    const content = contentOverride ?? chapterDraft.content;
    await mutate("save-chapter", { ...chapterDraft, content, instruction: instruction || "手动编辑", clearOutlineStale });
    setChapterDraft({ ...chapterDraft, content, outlineStale: clearOutlineStale ? false : chapterDraft.outlineStale });
    setMessage("章节已保存，并记录版本");
  };

  const callAi = async (actionOverride?: AiAction, instructionOverride?: string) => {
    const action = actionOverride || aiAction;
    const instruction = instructionOverride ?? (action === "outline-node" ? outlineAiInstruction : aiInstruction);
    if (!workspace || !instruction.trim()) return;
    setBusy(true);
    setMessage("");
    setAiError("");
    setProposal(null);
    try {
      const data = await jsonFetch<AiProposal>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action,
          projectId: workspace.project.id,
          chapterId: chapterDraft?.id || undefined,
          selection: action === "outline-node" || action === "outline-volume" ? JSON.stringify(outlineDraft) : chapterDraft?.content,
          instruction,
          count: action === "outline-volume" ? volumeChapterCount : action === "outline" ? outlineVolumeCount : undefined,
          settings,
        }),
      });
      setProposal(data);
      setProposalAction(action);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "AI 调用失败";
      setMessage(detail);
      setAiError(detail);
    } finally {
      setBusy(false);
    }
  };

  const detectLocalModel = async (useCurrentUrl = false) => {
    setModelCheckBusy(true);
    setModelCheckMessage("正在检测本机模型服务……");
    try {
      const detected = await jsonFetch<ModelDiscovery>("/api/models", useCurrentUrl ? {
        method: "POST",
        body: JSON.stringify({ baseUrl: settings.baseUrl }),
      } : undefined);
      const next = { provider: "openai-compatible" as const, model: detected.models[0], baseUrl: detected.baseUrl };
      setSettings(next);
      localStorage.setItem("story-studio-model-settings", JSON.stringify(next));
      setModelCheckMessage(`连接成功：${next.model}`);
      setMessage(`已连接并保存本地模型：${next.model}`);
    } catch (error) {
      setModelCheckMessage(error instanceof Error ? error.message : "没有发现本地模型");
    } finally {
      setModelCheckBusy(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal || !workspace) return;
    if (proposal.type === "text") {
      if (proposal.targetChapterId && proposal.targetChapterId !== chapterDraft?.id) {
        setMessage("这份 AI 提案属于另一个章节，已阻止误写入。请回到原章节接受，或在当前章节重新生成。");
        return;
      }
      await saveChapter(`AI：${aiInstruction || "按最新大纲生成"}`, proposal.result, proposalAction === "expand");
    } else if (proposal.type === "outline-node") {
      if (!outlineDraft) return;
      await mutate("save-outline-node", { ...outlineDraft, title: proposal.proposal.title, summary: proposal.proposal.summary });
      setMessage("节点提案已写入；关联正文已按需标记为待同步");
      setOutlineAiInstruction("");
    } else if (proposal.type === "outline-volume") {
      if (!outlineDraft || !isVolumeLikeNode(outlineDraft)) return;
      await mutate("apply-volume-outline", { projectId: workspace.project.id, volumeId: outlineDraft.id, nodes: proposal.proposal.nodes });
      setMessage(`已向《${outlineDraft.title}》加入 ${proposal.proposal.nodes.filter((node) => node.type === "chapter").length} 个章节`);
      setOverallOutlineOpen(false);
    } else {
      await mutate("apply-outline", { projectId: workspace.project.id, nodes: proposal.proposal.nodes });
      setMessage("大纲提案已加入项目");
      setOverallOutlineOpen(false);
    }
    setProposal(null);
    setAiInstruction("");
  };

  const runLogic = async () => {
    if (!workspace || !logicQuery.trim()) return;
    setBusy(true);
    try {
      const result = await jsonFetch<{ answer: string }>("/api/logic", { method: "POST", body: JSON.stringify({ projectId: workspace.project.id, query: logicQuery }) });
      setLogicAnswer(result.answer);
    } catch (error) {
      setLogicAnswer(error instanceof Error ? error.message : "查询失败");
    } finally {
      setBusy(false);
    }
  };

  const createNewProject = async () => {
    const title = newProjectTitle.trim();
    if (!title) return;
    const newId = await mutate("create-project", { title }, false);
    if (newId) {
      setSelectedChapterId("");
      setSelectedCharacterId("");
      await loadWorkspace(newId);
      setActiveTab("outline");
      setMessage(`已创建《${title}》`);
      setNewProjectOpen(false);
      setNewProjectTitle("");
    }
  };

  const uploadIllustration = async (file: File) => {
    if (!workspace || !chapterDraft) return;
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", workspace.project.id);
    form.set("chapterId", chapterDraft.id);
    form.set("caption", file.name.replace(/\.[^.]+$/, ""));
    setBusy(true);
    try {
      const response = await fetch("/api/illustrations", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "上传失败");
      await loadWorkspace(workspace.project.id);
      setMessage("插画已加入当前章节");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  const createOutlineNode = async () => {
    if (!workspace || !nodeCreateDraft?.title.trim()) return;
    const newId = await mutate("create-outline-node", {
      projectId: workspace.project.id,
      type: nodeCreateDraft.type,
      parentId: nodeCreateDraft.parentId,
      afterId: nodeCreateDraft.afterId,
      title: nodeCreateDraft.title.trim(),
      summary: nodeCreateDraft.summary.trim(),
    }, false);
    if (newId) {
      await loadWorkspace(workspace.project.id, newId);
      setNodeCreateDraft(null);
      setMessage(nodeCreateDraft.type === "chapter" ? "新章已插入，并建立了对应写作章节" : "大纲节点已插入");
    }
  };

  const deleteSelectedOutline = async () => {
    if (!workspace || !outlineDraft) return;
    const preferred = outlineDraft.parentId || undefined;
    await mutate("delete-outline-node", { id: outlineDraft.id }, false);
    setDeleteOutlineOpen(false);
    await loadWorkspace(workspace.project.id, preferred);
    setMessage("大纲节点及其下级内容已删除");
  };

  const openRelationshipEditor = () => {
    if (!workspace || workspace.characters.length < 2) {
      setMessage("至少需要两个人物才能添加关系");
      return;
    }
    const source = workspace.characters.find((character) => character.id === selectedCharacterId) ?? workspace.characters[0];
    const target = workspace.characters.find((character) => character.id !== source.id) ?? workspace.characters[1];
    setRelationshipDraft({ sourceCharacterId: source.id, targetCharacterId: target.id, type: "盟友", description: "" });
  };

  const saveCharacter = async () => {
    if (!characterDraft?.name.trim()) {
      setMessage("人物姓名不能为空");
      return;
    }
    const result = await mutate("save-character", characterDraft as unknown as Record<string, unknown>);
    if (result) setMessage(`人物“${characterDraft.name}”已保存，后续 AI 请求会使用最新资料`);
  };

  const createRelationship = async () => {
    if (!workspace || !relationshipDraft) return;
    if (relationshipDraft.sourceCharacterId === relationshipDraft.targetCharacterId) {
      setMessage("一条关系需要选择两个不同的人物");
      return;
    }
    const result = await mutate("create-relationship", { projectId: workspace.project.id, ...relationshipDraft });
    if (result) {
      setRelationshipDraft(null);
      setMessage("人物关系已添加，后续 AI 请求会使用这条关系");
    }
  };

  const saveRelationship = async () => {
    if (!workspace || !relationshipEditDraft) return;
    if (relationshipEditDraft.sourceCharacterId === relationshipEditDraft.targetCharacterId) {
      setMessage("一条关系需要选择两个不同的人物");
      return;
    }
    if (!relationshipEditDraft.type.trim()) {
      setMessage("关系类型不能为空");
      return;
    }
    const result = await mutate("save-relationship", { ...relationshipEditDraft, projectId: workspace.project.id });
    if (result) setMessage("人物关系已保存，后续 AI 请求会使用最新关系");
  };

  const readCharacterImportFile = async (file?: File) => {
    if (!workspace || !file) return;
    try {
      const data = parseCharacterImportJson(await file.text());
      const availableNames = new Set([
        ...workspace.characters.map((character) => normalizeCharacterName(character.name)),
        ...data.characters.map((character) => normalizeCharacterName(character.name)),
      ]);
      const missingNames = Array.from(new Set(data.relationships.flatMap((relationship) => [relationship.sourceName, relationship.targetName])
        .filter((name) => !availableNames.has(normalizeCharacterName(name)))));
      setCharacterImportPreview({ fileName: file.name, data, missingNames });
      setMessage("");
    } catch (error) {
      setCharacterImportPreview(null);
      setMessage(error instanceof Error ? `JSON 导入失败：${error.message}` : "JSON 导入失败");
    } finally {
      if (characterImportInputRef.current) characterImportInputRef.current.value = "";
    }
  };

  const importCharactersFromJson = async () => {
    if (!workspace || !characterImportPreview || characterImportPreview.missingNames.length) return;
    const result = await mutate("import-characters-json", { projectId: workspace.project.id, data: characterImportPreview.data });
    if (result) {
      setCharacterImportPreview(null);
      setMessage(`JSON 导入完成：${result}`);
    }
  };

  const wordCount = useMemo(() => chapterDraft?.content.replace(/\s/g, "").length ?? 0, [chapterDraft?.content]);
  const activeChapterOutline = useMemo(() => workspace?.outline.find((node) => node.id === chapterDraft?.outlineNodeId) ?? null, [workspace?.outline, chapterDraft?.outlineNodeId]);
  const activeChapterScenes = useMemo(() => activeChapterOutline ? workspace?.outline.filter((node) => node.type === "scene" && node.parentId === activeChapterOutline.id) ?? [] : [], [workspace?.outline, activeChapterOutline]);
  const contextStats = useMemo(() => ({
    characters: workspace?.characters.length ?? 0,
    relationships: workspace?.relationships.length ?? 0,
    canon: workspace?.worldEntries.filter((entry) => entry.isCanon).length ?? 0,
    events: workspace?.events.length ?? 0,
    scenes: activeChapterScenes.length,
  }), [workspace, activeChapterScenes.length]);
  const deleteImpact = useMemo(() => {
    if (!workspace || !outlineDraft) return { nodes: 0, chapters: 0, writtenChapters: 0, words: 0 };
    const ids = new Set<string>([outlineDraft.id]);
    let changed = true;
    while (changed) {
      changed = false;
      workspace.outline.forEach((node) => {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true; }
      });
    }
    const chapters = workspace.chapters.filter((chapter) => chapter.outlineNodeId && ids.has(chapter.outlineNodeId));
    return { nodes: ids.size, chapters: chapters.length, writtenChapters: chapters.filter((chapter) => chapter.content.trim()).length, words: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0) };
  }, [workspace, outlineDraft]);

  if (!workspace) {
    return <main className="loading-screen"><LoaderCircle className="spin" /><span>正在打开故事工作台…</span></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><WandSparkles size={20} /></div><div><strong>Story Studio</strong><span>长篇创作工作台</span></div></div>
        <div className="project-switcher">
          <span className="eyebrow">当前作品</span>
          <div className="project-select-row"><select value={workspace.project.id} onChange={(event) => void loadWorkspace(event.target.value)}>
            {workspace.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select><button className="tiny-button" title="新建作品" onClick={() => { setNewProjectTitle(""); setNewProjectOpen(true); }}><CirclePlus size={16} /></button></div>
        </div>
        <div className="top-actions">
          {message && <span className="status-message">{message}</span>}
          {busy && <LoaderCircle size={17} className="spin muted" />}
          <button className="secondary-button" onClick={() => setExportOpen(true)}><Download size={17} />导出</button>
          <button className="icon-button" title="模型设置" onClick={() => setSettingsOpen(true)}><Settings size={19} /></button>
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          {navItems.map((item) => <button key={item.id} className={activeTab === item.id ? "nav-item active" : "nav-item"} onClick={() => setActiveTab(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-footer"><span className="connection-dot" />本地 SQLite</div>
      </aside>

      <section className="workspace">
        {activeTab === "write" && chapterDraft && (
          <div className="writer-layout">
            <aside className="chapter-list panel-subtle">
              <div className="section-heading"><div><span className="eyebrow">MANUSCRIPT</span><h2>章节</h2></div><button className="tiny-button" onClick={async () => { const title = window.prompt("新章节标题", `第${workspace.chapters.length + 1}章`); if (title) { const newId = await mutate("create-chapter", { projectId: workspace.project.id, title }); if (newId) setSelectedChapterId(newId); } }}><CirclePlus size={16} /></button></div>
              <div className="chapter-items">
                <ManuscriptTree workspace={workspace} selectedChapterId={selectedChapterId} collapsedVolumes={collapsedWritingVolumes} onToggleVolume={(volumeId) => setCollapsedWritingVolumes((current) => toggleSetValue(current, volumeId))} onSelectChapter={selectChapter} />
              </div>
              <div className="manuscript-total"><span>全书字数</span><strong>{workspace.chapters.reduce((sum, item) => sum + item.wordCount, 0).toLocaleString()}</strong></div>
            </aside>

            <article className="editor-card">
              <div className="editor-toolbar">
                <input className="title-input" value={chapterDraft.title} onChange={(e) => setChapterDraft({ ...chapterDraft, title: e.target.value })} />
                <div><span>{wordCount.toLocaleString()} 字</span><button className="primary-button small" onClick={() => void saveChapter()}><Save size={16} />保存</button></div>
              </div>
              {activeChapterOutline && <div className={chapterDraft.outlineStale ? "chapter-outline-brief stale" : "chapter-outline-brief"}><div><span className="eyebrow">LATEST OUTLINE · V{activeChapterOutline.revision}</span><strong>{activeChapterOutline.title}</strong><p>{activeChapterOutline.summary || "这一章还没有填写剧情摘要。"}</p></div><div>{chapterDraft.outlineStale && <span className="stale-label"><AlertTriangle size={14} />正文基于旧大纲</span>}<button className="secondary-button" onClick={() => { const instruction = chapterDraft.outlineStale ? "根据本章最新大纲重写完整章节。保留仍符合新大纲的优秀文字，但必须修正所有剧情冲突。只输出完整正文。" : "严格根据本章大纲扩写为完整章节，不增加与人物、世界观或事件链冲突的新事实。只输出完整正文。"; setAiAction("expand"); setAiInstruction(instruction); void callAi("expand", instruction); }}><Sparkles size={15} />{chapterDraft.outlineStale ? "按新大纲重写" : "按大纲扩写"}</button>{chapterDraft.outlineStale && <button className="text-button" onClick={async () => { await mutate("mark-chapter-current", { id: chapterDraft.id }); setMessage("已标记为与最新大纲同步"); }}>我已手动同步</button>}</div></div>}
              <textarea className="manuscript-editor" value={chapterDraft.content} placeholder="从这里开始写故事……" onChange={(e) => setChapterDraft({ ...chapterDraft, content: e.target.value })} />
              <div className="illustration-strip"><div className="illustration-heading"><span><ImagePlus size={15} />章节插画</span><label className="upload-button"><CirclePlus size={15} />添加图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadIllustration(file); event.target.value = ""; }} /></label></div>{workspace.illustrations.filter((image) => image.chapterId === chapterDraft.id).length > 0 && <div className="illustration-grid">{workspace.illustrations.filter((image) => image.chapterId === chapterDraft.id).map((image) => <figure key={image.id}><img src={`/api/assets/${image.id}`} alt={image.caption || image.fileName} /><figcaption>{image.caption || image.fileName}</figcaption></figure>)}</div>}</div>
              <div className="summary-row"><label>章节摘要</label><input value={chapterDraft.summary} onChange={(e) => setChapterDraft({ ...chapterDraft, summary: e.target.value })} placeholder="这一章发生了什么？" /></div>
            </article>

            <aside className="ai-panel">
              <div className="ai-heading"><div className="ai-orb"><Sparkles size={19} /></div><div><h2>AI 编辑</h2><span>先预览，再应用</span></div></div>
              <div className="segmented">
                <button className={aiAction === "revise" ? "active" : ""} onClick={() => setAiAction("revise")}>改写</button>
                <button className={aiAction === "expand" ? "active" : ""} onClick={() => setAiAction("expand")}>续写</button>
                <button className={aiAction === "logic" ? "active" : ""} onClick={() => setAiAction("logic")}>检查</button>
              </div>
              <textarea className="prompt-box" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder="例如：加强林月收到信后的不安，但不要增加新事实……" />
              <button className="primary-button full" disabled={busy || !aiInstruction.trim()} onClick={() => void callAi()}><Bot size={17} />生成提案</button>
              <div className="context-note context-summary"><BrainCircuit size={16} /><div><strong>本次 AI 上下文</strong><span>人物 {contextStats.characters} · 关系 {contextStats.relationships} · 硬设定 {contextStats.canon} · 事件链 {contextStats.events} · 本章场景 {contextStats.scenes}</span><small>同时附带完整大纲及当前章前后一章的正文，用于保持连续性。</small></div></div>
              {proposal && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}
            </aside>
          </div>
        )}

        {activeTab === "outline" && (
          <ContentPage eyebrow="STRUCTURE" title="故事大纲" description="先确定卷、章和场景，再进入写作扩展；每个节点都可以独立修改。" action={<button className="primary-button" onClick={() => { setAiAction("outline"); setOutlineVolumeCount(7); setAiInstruction(""); setProposal(null); setAiError(""); setOverallOutlineOpen(true); }}><Sparkles size={17} />用 AI 构思整体大纲</button>}>
            {projectDraft && <div className="project-foundation"><div className="section-heading"><div><span className="eyebrow">STORY FOUNDATION</span><h2>作品基石</h2></div><button className="primary-button small" onClick={() => void mutate("save-project", projectDraft as unknown as Record<string, unknown>)}><Save size={15} />保存</button></div><div className="foundation-grid"><Field label="作品名" value={projectDraft.title} onChange={(title) => setProjectDraft({ ...projectDraft, title })} /><Field label="类型" value={projectDraft.genre} onChange={(genre) => setProjectDraft({ ...projectDraft, genre })} /></div><Field label="核心构想" value={projectDraft.premise} multiline onChange={(premise) => setProjectDraft({ ...projectDraft, premise })} /><Field label="写作规则 / 风格指南" value={projectDraft.styleGuide} multiline onChange={(styleGuide) => setProjectDraft({ ...projectDraft, styleGuide })} /></div>}
            <div className="outline-grid">
              <div className="outline-tree">
                <div className="outline-tree-header"><div><span className="eyebrow">OUTLINE TREE</span><strong>卷 · 章 · 场景</strong></div><button className="secondary-button" onClick={() => setNodeCreateDraft({ type: "volume", parentId: null, afterId: workspace.outline.at(-1)?.id || null, title: `第${workspace.outline.filter((node) => node.type === "volume").length + 1}卷`, summary: "", heading: "添加新卷" })}><CirclePlus size={15} />添加卷</button></div>
                <OutlineTreeRows nodes={workspace.outline} selectedId={selectedOutlineId} collapsedVolumes={collapsedOutlineVolumes} onToggleVolume={(volumeId) => setCollapsedOutlineVolumes((current) => toggleSetValue(current, volumeId))} onSelect={(node) => { setSelectedOutlineId(node.id); setOutlineDraft({ ...node }); setProposal(null); setOutlineAiInstruction(""); }} />
              </div>
              <div className="outline-side">{outlineDraft && <><div className="detail-editor outline-editor"><div className="section-heading"><div><span className="eyebrow">SELECTED NODE</span><h2>{isVolumeLikeNode(outlineDraft) ? "卷" : outlineDraft.type === "chapter" ? "章" : "场景"}节点</h2></div><button className="primary-button small" onClick={async () => { await mutate("save-outline-node", outlineDraft as unknown as Record<string, unknown>); setMessage("大纲节点已保存；关联正文已按需标记"); }}><Save size={15} />保存</button></div><Field label="标题" value={outlineDraft.title} onChange={(title) => setOutlineDraft({ ...outlineDraft, title })} /><Field label="剧情摘要 / 本节点要完成的任务" value={outlineDraft.summary} multiline onChange={(summary) => setOutlineDraft({ ...outlineDraft, summary })} /><Field label="状态" value={outlineDraft.status} options={[{ label: "计划中", value: "planned" }, { label: "已起草", value: "drafted" }, { label: "已完成", value: "complete" }]} onChange={(status) => setOutlineDraft({ ...outlineDraft, status })} />{outlineDraft.type === "chapter" && !isVolumeLikeNode(outlineDraft) && (() => { const linked = workspace.chapters.find((chapter) => chapter.outlineNodeId === outlineDraft.id); return linked ? <button className="secondary-button full-action" onClick={() => selectChapter(linked)}><FileText size={15} />进入本章写作{linked.outlineStale ? "（待同步）" : ""}</button> : null; })()}<div className="outline-structure-actions">{isVolumeLikeNode(outlineDraft) && <button className="ai-structure-action" onClick={() => { setAiAction("outline-volume"); setVolumeChapterCount(7); setAiInstruction(`根据以下本卷介绍展开章节：\n${outlineDraft.summary.trim() || outlineDraft.title}\n\n要求：每一章都要提供明确的章节标题和章节介绍，形成连续推进的剧情，不要重复其他卷。`); setProposal(null); setAiError(""); setOverallOutlineOpen(true); }}><Sparkles size={14} />AI 展开为章节</button>}{outlineDraft.type === "volume" && <><button onClick={() => setNodeCreateDraft({ type: "chapter", parentId: outlineDraft.id, afterId: outlineDraft.id, title: "新章", summary: "", heading: `在《${outlineDraft.title}》中添加章节` })}><CirclePlus size={14} />本卷添加章</button><button onClick={() => setNodeCreateDraft({ type: "volume", parentId: null, afterId: outlineDraft.id, title: "新卷", summary: "", heading: `在《${outlineDraft.title}》后插入新卷` })}><CirclePlus size={14} />后插新卷</button></>}{outlineDraft.type === "chapter" && !isVolumeLikeNode(outlineDraft) && <><button onClick={() => setNodeCreateDraft({ type: "scene", parentId: outlineDraft.id, afterId: outlineDraft.id, title: "新场景", summary: "", heading: `在《${outlineDraft.title}》中添加场景` })}><CirclePlus size={14} />本章添加场景</button><button onClick={() => setNodeCreateDraft({ type: "chapter", parentId: outlineDraft.parentId, afterId: outlineDraft.id, title: "新章", summary: "", heading: `在《${outlineDraft.title}》后插入新章` })}><CirclePlus size={14} />后插新章</button></>}{outlineDraft.type === "scene" && <button onClick={() => setNodeCreateDraft({ type: "scene", parentId: outlineDraft.parentId, afterId: outlineDraft.id, title: "新场景", summary: "", heading: `在《${outlineDraft.title}》后插入场景` })}><CirclePlus size={14} />后插场景</button>}<button className="danger-text-button" onClick={() => setDeleteOutlineOpen(true)}>删除此{isVolumeLikeNode(outlineDraft) ? "卷" : outlineDraft.type === "chapter" ? "章" : "场景"}</button></div></div><div className="inline-ai-card node-ai-card"><Sparkles size={20} /><h3>AI 单独修改这个节点</h3><p>只修改当前节点，不会改动其他卷、章或场景。</p><textarea value={outlineAiInstruction} onChange={(e) => setOutlineAiInstruction(e.target.value)} placeholder="例如：保留结局不变，但让本章中点出现一次更强的错误判断……" /><button className="primary-button full" onClick={() => void callAi("outline-node")} disabled={busy || !outlineAiInstruction.trim()}>生成节点修改提案</button>{proposal?.type === "outline-node" && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}</div></>}</div>
            </div>
          </ContentPage>
        )}

        {activeTab === "characters" && (
          <ContentPage eyebrow="CAST" title="人物与关系" description="人物动机、秘密和说话方式是连续性检查的基础。" action={<div className="page-actions"><input ref={characterImportInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void readCharacterImportFile(event.target.files?.[0])} /><button className="secondary-button" onClick={() => characterImportInputRef.current?.click()}><Upload size={17} />导入 JSON</button><button className="primary-button" onClick={async () => { const name = window.prompt("人物姓名"); if (name) await mutate("create-character", { projectId: workspace.project.id, name }); }}><CirclePlus size={17} />添加人物</button></div>}>
            <div className="character-layout">
              <div className="character-grid">{workspace.characters.map((character) => <button key={character.id} className={character.id === selectedCharacterId ? "character-card selected" : "character-card"} onClick={() => { setSelectedCharacterId(character.id); setCharacterDraft({ ...character }); }}><div className="avatar">{character.name.slice(0, 1)}</div><div><h3>{character.name}</h3><span>{character.role || "待设定角色"}</span><p>{character.goal || character.description}</p></div></button>)}</div>
              {characterDraft && <div className="detail-editor"><div className="section-heading"><div><span className="eyebrow">CHARACTER CARD</span><h2>{characterDraft.name}</h2></div><button className="primary-button small" disabled={busy || !characterDraft.name.trim()} onClick={() => void saveCharacter()}><Save size={15} />保存</button></div><Field label="姓名" value={characterDraft.name} onChange={(name) => setCharacterDraft({ ...characterDraft, name })} /><Field label="角色" value={characterDraft.role} onChange={(role) => setCharacterDraft({ ...characterDraft, role })} /><Field label="描述" value={characterDraft.description} multiline onChange={(description) => setCharacterDraft({ ...characterDraft, description })} /><div className="two-columns"><Field label="目标" value={characterDraft.goal} onChange={(goal) => setCharacterDraft({ ...characterDraft, goal })} /><Field label="恐惧" value={characterDraft.fear} onChange={(fear) => setCharacterDraft({ ...characterDraft, fear })} /></div><Field label="秘密" value={characterDraft.secret} onChange={(secret) => setCharacterDraft({ ...characterDraft, secret })} /><Field label="说话风格" value={characterDraft.voice} multiline onChange={(voice) => setCharacterDraft({ ...characterDraft, voice })} /><button className="danger-button full-danger" onClick={async () => { const relationshipCount = workspace.relationships.filter((relationship) => relationship.sourceCharacterId === characterDraft.id || relationship.targetCharacterId === characterDraft.id).length; if (!window.confirm(`确认删除人物“${characterDraft.name}”？${relationshipCount ? `\n同时会删除与此人物有关的 ${relationshipCount} 条关系。` : ""}`)) return; const result = await mutate("delete-character", { id: characterDraft.id }); if (result) setMessage("人物及其相关关系已删除"); }}>删除这个人物</button></div>}
            </div>
            <div className="subsection-heading"><h2 className="subsection-title">关系网络</h2><button className="secondary-button small" onClick={openRelationshipEditor}><CirclePlus size={16} />添加关系</button></div><div className="relationship-editor-layout"><div className="relationship-list">{workspace.relationships.length ? workspace.relationships.map((relationship) => <button key={relationship.id} className={relationship.id === selectedRelationshipId ? "relationship-row selected" : "relationship-row"} onClick={() => { setSelectedRelationshipId(relationship.id); setRelationshipEditDraft({ ...relationship }); }}><strong>{relationship.sourceName}</strong><span><i />{relationship.type}<i /></span><strong>{relationship.targetName}</strong><p>{relationship.description}</p></button>) : <div className="empty-inline">还没有人物关系，点击“添加关系”开始建立。</div>}</div>{relationshipEditDraft && <div className="detail-editor relationship-editor"><div className="section-heading"><div><span className="eyebrow">RELATIONSHIP</span><h2>修改关系</h2></div><button className="primary-button small" disabled={busy || !relationshipEditDraft.type.trim() || relationshipEditDraft.sourceCharacterId === relationshipEditDraft.targetCharacterId} onClick={() => void saveRelationship()}><Save size={15} />保存</button></div><div className="two-columns"><Field label="起点人物" value={relationshipEditDraft.sourceCharacterId} options={workspace.characters.map((character) => ({ label: character.name, value: character.id }))} onChange={(sourceCharacterId) => setRelationshipEditDraft({ ...relationshipEditDraft, sourceCharacterId, sourceName: workspace.characters.find((character) => character.id === sourceCharacterId)?.name || "" })} /><Field label="目标人物" value={relationshipEditDraft.targetCharacterId} options={workspace.characters.map((character) => ({ label: character.name, value: character.id }))} onChange={(targetCharacterId) => setRelationshipEditDraft({ ...relationshipEditDraft, targetCharacterId, targetName: workspace.characters.find((character) => character.id === targetCharacterId)?.name || "" })} /></div><Field label="关系类型" value={relationshipEditDraft.type} onChange={(type) => setRelationshipEditDraft({ ...relationshipEditDraft, type })} /><Field label="关系说明" value={relationshipEditDraft.description} multiline onChange={(description) => setRelationshipEditDraft({ ...relationshipEditDraft, description })} /><button className="danger-button full-danger" onClick={async () => { if (!window.confirm(`确认删除“${relationshipEditDraft.sourceName} → ${relationshipEditDraft.targetName}”这条关系？`)) return; const result = await mutate("delete-relationship", { id: relationshipEditDraft.id }); if (result) setMessage("人物关系已删除"); }}>删除这条关系</button></div>}</div>
          </ContentPage>
        )}

        {activeTab === "world" && (
          <ContentPage eyebrow="WORLD BIBLE" title="世界观与背景" description="标为硬设定的内容会进入每次相关 AI 请求。" action={<button className="primary-button" onClick={async () => { const name = window.prompt("设定名称"); if (name) { const category = window.prompt("分类", "背景") || "背景"; const description = window.prompt("设定说明", "") || ""; await mutate("create-world", { projectId: workspace.project.id, name, category, description, isCanon: true }); } }}><CirclePlus size={17} />添加设定</button>}>
            <div className="world-layout"><div className="world-grid">{workspace.worldEntries.map((entry) => <button key={entry.id} className={entry.id === selectedWorldId ? "world-card selected" : "world-card"} onClick={() => { setSelectedWorldId(entry.id); setWorldDraft({ ...entry }); }}><div><span className="category-tag">{entry.category}</span>{entry.isCanon ? <span className="canon-tag"><Check size={12} />硬设定</span> : <span className="draft-tag">草稿</span>}</div><h3>{entry.name}</h3><p>{entry.description}</p></button>)}</div>{worldDraft && <div className="detail-editor world-editor"><div className="section-heading"><div><span className="eyebrow">WORLD ENTRY</span><h2>修改设定</h2></div><button className="primary-button small" disabled={!worldDraft.name.trim()} onClick={async () => { await mutate("save-world", worldDraft as unknown as Record<string, unknown>); setMessage(worldDraft.isCanon ? "硬设定已保存，后续 AI 请求会使用最新内容" : "设定草稿已保存，不会发送给 AI"); }}><Save size={15} />保存</button></div><Field label="设定名称" value={worldDraft.name} onChange={(name) => setWorldDraft({ ...worldDraft, name })} /><Field label="分类" value={worldDraft.category} onChange={(category) => setWorldDraft({ ...worldDraft, category })} /><Field label="详细说明" value={worldDraft.description} multiline onChange={(description) => setWorldDraft({ ...worldDraft, description })} /><Field label="AI 使用方式" value={worldDraft.isCanon ? "canon" : "draft"} options={[{ label: "硬设定（发送给 AI）", value: "canon" }, { label: "草稿（暂不发送）", value: "draft" }]} onChange={(value) => setWorldDraft({ ...worldDraft, isCanon: value === "canon" })} /><div className="world-editor-note">只有“硬设定”会自动进入写作、续写、改写和大纲生成的上下文。</div><button className="danger-button full-danger" onClick={async () => { if (!window.confirm(`确认删除设定“${worldDraft.name}”？`)) return; await mutate("delete-world", { id: worldDraft.id }); setMessage("世界观设定已删除"); }}>删除这条设定</button></div>}</div>
            <div className="subsection-heading"><h2 className="subsection-title">事件时间线</h2><button className="tiny-button" title="添加事件" onClick={async () => { const title = window.prompt("事件名称"); if (title) { const storyTime = window.prompt("故事内时间", "") || ""; const description = window.prompt("事件经过", "") || ""; const causes = window.prompt("前置原因", "") || ""; const consequences = window.prompt("直接结果", "") || ""; await mutate("create-event", { projectId: workspace.project.id, title, storyTime, description, causes, consequences }); } }}><CirclePlus size={16} /></button></div><div className="timeline-layout"><div className="timeline">{workspace.events.map((event) => <button key={event.id} className={event.id === selectedEventId ? "timeline-event selected" : "timeline-event"} onClick={() => { setSelectedEventId(event.id); setEventDraft({ ...event }); }}><div className="timeline-dot" /><span>{event.storyTime || "时间待定"}</span><h3>{event.title}</h3><p>{event.description}</p><div className="cause-effect"><span><b>原因</b>{event.causes}</span><ChevronRight size={18} /><span><b>结果</b>{event.consequences}</span></div></button>)}</div>{eventDraft && <div className="detail-editor event-editor"><div className="section-heading"><div><span className="eyebrow">STORY EVENT</span><h2>修改时间线事件</h2></div><button className="primary-button small" disabled={!eventDraft.title.trim()} onClick={async () => { await mutate("save-event", eventDraft as unknown as Record<string, unknown>); setMessage("时间线事件已保存，后续 AI 请求会使用最新因果链"); }}><Save size={15} />保存</button></div><Field label="事件名称" value={eventDraft.title} onChange={(title) => setEventDraft({ ...eventDraft, title })} /><Field label="故事内时间" value={eventDraft.storyTime} onChange={(storyTime) => setEventDraft({ ...eventDraft, storyTime })} /><Field label="事件经过" value={eventDraft.description} multiline onChange={(description) => setEventDraft({ ...eventDraft, description })} /><Field label="前置原因" value={eventDraft.causes} multiline onChange={(causes) => setEventDraft({ ...eventDraft, causes })} /><Field label="直接结果" value={eventDraft.consequences} multiline onChange={(consequences) => setEventDraft({ ...eventDraft, consequences })} /><div className="world-editor-note">时间、经过、原因和结果都会作为事件因果链发送给 AI。</div><button className="danger-button full-danger" onClick={async () => { if (!window.confirm(`确认删除事件“${eventDraft.title}”？`)) return; await mutate("delete-event", { id: eventDraft.id }); setMessage("时间线事件已删除"); }}>删除这条事件</button></div>}</div>
          </ContentPage>
        )}

        {activeTab === "logic" && (
          <ContentPage eyebrow="CONTINUITY" title="逻辑链查询" description="先查询结构化事实，不配置模型也能使用。">
            <div className="logic-search"><Search size={20} /><input value={logicQuery} onChange={(e) => setLogicQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void runLogic(); }} placeholder="例如：林月为什么可以进入七号仓库？" /><button className="primary-button" onClick={() => void runLogic()}>查询证据链</button></div>
            {logicAnswer ? <div className="logic-result"><div className="logic-result-head"><Network size={20} /><div><span className="eyebrow">EVIDENCE</span><h3>现有资料中的证据</h3></div></div><pre>{logicAnswer}</pre></div> : <div className="empty-state"><Network size={42} /><h3>从因果关系开始提问</h3><p>系统会同时搜索人物目标与秘密、世界观硬设定、事件原因和结果。</p></div>}
          </ContentPage>
        )}

        {activeTab === "history" && (
          <ContentPage eyebrow="REVISIONS" title="版本历史" description="AI 和手动修改都可以留下可追溯记录。">
            <div className="revision-list">{workspace.revisions.length ? workspace.revisions.map((revision) => <article key={revision.id} className="revision-card"><Clock3 size={18} /><div><h3>{revision.instruction}</h3><span>{new Date(revision.createdAt).toLocaleString("zh-CN")}</span><p>修改前 {revision.beforeContent.length} 字 → 修改后 {revision.afterContent.length} 字</p></div></article>) : <div className="empty-state"><History size={42} /><h3>还没有版本记录</h3><p>保存章节或接受 AI 修改后，历史记录会出现在这里。</p></div>}</div>
          </ContentPage>
        )}
      </section>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MODEL PROVIDER</span><h2>模型设置</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div><button className="secondary-button full-action" disabled={modelCheckBusy} onClick={() => void detectLocalModel(false)}>{modelCheckBusy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}自动检测并连接本机 llama.cpp</button><Field label="提供方" value={settings.provider} options={[{ label: "OpenAI Responses API", value: "openai" }, { label: "本地 / OpenAI-compatible", value: "openai-compatible" }]} onChange={(provider) => setSettings({ ...settings, provider: provider as ModelSettings["provider"] })} /><Field label="模型名称" value={settings.model} onChange={(model) => setSettings({ ...settings, model })} />{settings.provider === "openai-compatible" && <><Field label="Base URL" value={settings.baseUrl || ""} onChange={(baseUrl) => setSettings({ ...settings, baseUrl })} /><button className="text-button model-test-button" disabled={modelCheckBusy} onClick={() => void detectLocalModel(true)}>测试这个地址</button></>}{modelCheckMessage && <div className={modelCheckMessage.startsWith("连接成功") ? "model-check success" : "model-check"}>{modelCheckMessage}</div>}<div className="security-note">API Key 不会存入浏览器。OpenAI 使用服务器端 <code>OPENAI_API_KEY</code>；本地模型默认无需密钥。</div><button className="primary-button full" onClick={() => { localStorage.setItem("story-studio-model-settings", JSON.stringify(settings)); setSettingsOpen(false); setMessage("模型设置已保存在本机浏览器"); }}><Save size={17} />保存设置</button></section></div>}
      {exportOpen && <div className="modal-backdrop" onMouseDown={() => setExportOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">EXPORT</span><h2>导出《{workspace.project.title}》</h2></div><button className="icon-button" onClick={() => setExportOpen(false)}><X size={19} /></button></div><div className="export-options"><button onClick={() => { window.open(`/export/${workspace.project.id}`, "_blank", "noopener,noreferrer"); setExportOpen(false); }}><span className="export-icon"><Printer size={22} /></span><div><strong>PDF / 打印稿</strong><small>A4 专业排版，包含章节插画；在打印窗口选择“另存为 PDF”。</small></div><ChevronRight size={17} /></button><a href={`/api/export/markdown?projectId=${workspace.project.id}`} onClick={() => setExportOpen(false)}><span className="export-icon"><FileType2 size={22} /></span><div><strong>Markdown 原稿</strong><small>适合备份、版本管理以及导入其他写作工具。</small></div><ChevronRight size={17} /></a></div><div className="security-note">PDF 使用浏览器原生打印引擎，中文字体与插画会按当前电脑的实际效果排版。</div></section></div>}
      {nodeCreateDraft && <div className="modal-backdrop" onMouseDown={() => setNodeCreateDraft(null)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">INSERT OUTLINE NODE</span><h2>{nodeCreateDraft.heading}</h2></div><button className="icon-button" aria-label="关闭新增大纲节点" onClick={() => setNodeCreateDraft(null)}><X size={19} /></button></div><div className="node-kind-preview"><span className={`node-type ${nodeCreateDraft.type}`}>{nodeCreateDraft.type === "volume" ? "卷" : nodeCreateDraft.type === "chapter" ? "章" : "场"}</span><p>{nodeCreateDraft.type === "chapter" ? "保存后会同时建立对应的写作章节。" : nodeCreateDraft.type === "scene" ? "场景会归入当前章节，不单独建立正文文件。" : "新卷可以继续添加章节和场景。"}</p></div><Field label="标题" value={nodeCreateDraft.title} onChange={(title) => setNodeCreateDraft({ ...nodeCreateDraft, title })} /><Field label="剧情摘要 / 要完成的任务" value={nodeCreateDraft.summary} multiline onChange={(summary) => setNodeCreateDraft({ ...nodeCreateDraft, summary })} /><button className="primary-button full" disabled={busy || !nodeCreateDraft.title.trim()} onClick={() => void createOutlineNode()}><CirclePlus size={16} />确认插入</button></section></div>}
      {deleteOutlineOpen && outlineDraft && <div className="modal-backdrop" onMouseDown={() => setDeleteOutlineOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow danger-eyebrow">DELETE OUTLINE NODE</span><h2>删除《{outlineDraft.title}》？</h2></div><button className="icon-button" aria-label="关闭删除确认" onClick={() => setDeleteOutlineOpen(false)}><X size={19} /></button></div><div className="delete-impact"><AlertTriangle size={24} /><div><strong>此操作不能撤销</strong><p>将删除 {deleteImpact.nodes} 个大纲节点、{deleteImpact.chapters} 个关联章节。{deleteImpact.writtenChapters > 0 ? `其中 ${deleteImpact.writtenChapters} 章已有正文，共 ${deleteImpact.words} 字，也会一并删除。` : "没有已写正文会受到影响。"}</p></div></div><div className="modal-button-row"><button className="secondary-button" onClick={() => setDeleteOutlineOpen(false)}>取消</button><button className="danger-button" disabled={busy} onClick={() => void deleteSelectedOutline()}>确认删除</button></div></section></div>}
      {overallOutlineOpen && <div className="modal-backdrop" onMouseDown={() => setOverallOutlineOpen(false)}><section className="settings-modal wide-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">AI STORY ARCHITECT</span><h2>{aiAction === "outline-volume" ? `展开《${outlineDraft?.title || "本卷"}》` : "构思或扩充整体大纲"}</h2></div><button className="icon-button" aria-label="关闭整体大纲构思" onClick={() => setOverallOutlineOpen(false)}><X size={19} /></button></div><p className="modal-help">{aiAction === "outline-volume" ? `AI 只为当前卷提出指定数量的章与场景。接受后会追加到本卷，不覆盖已有章节，并自动建立对应写作章节。${outlineDraft?.type === "chapter" ? "当前旧版卷会转换为正式的卷；已有正文会保留为卷下的“已有草稿”章节。" : ""}` : "AI 会根据作品类型、核心构想和写作规则，生成指定数量的卷及每卷介绍。之后可分别把每一卷展开为章节。"}</p><div className="active-model-line"><Bot size={14} /><span>{settings.provider === "openai-compatible" ? "本地模型" : "OpenAI"}：{settings.model}</span><button className="text-button" onClick={() => { setOverallOutlineOpen(false); setModelCheckMessage(""); setSettingsOpen(true); }}>更改</button></div><label className="field count-field"><span>{aiAction === "outline-volume" ? "需要生成多少章" : "预想的卷数"}</span><input type="number" min={1} max={20} value={aiAction === "outline-volume" ? volumeChapterCount : outlineVolumeCount} onChange={(event) => { const value = Math.max(1, Math.min(20, Number(event.target.value) || 1)); if (aiAction === "outline-volume") setVolumeChapterCount(value); else setOutlineVolumeCount(value); }} /></label><textarea className="prompt-box outline-modal-prompt" value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder={aiAction === "outline-volume" ? "例如：每章包含两个关键场景；本卷结尾揭示主角记忆存在人为修改……" : "例如：设计悬疑科幻故事；前期发现现实裂缝，中期追查系统真相，结尾完成牺牲与反转……"} /><button className="primary-button full" disabled={busy || !aiInstruction.trim()} onClick={() => void callAi(aiAction === "outline-volume" ? "outline-volume" : "outline")}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "正在生成，请稍候……" : aiAction === "outline-volume" ? `生成 ${volumeChapterCount} 章提案` : `生成 ${outlineVolumeCount} 卷整体大纲`}</button>{busy && <p className="generation-note">本地大模型需要先推理，复杂大纲通常要等待几十秒。</p>}{aiError && <div className="ai-error"><AlertTriangle size={16} /><span>{aiError}</span></div>}{(proposal?.type === "outline" || proposal?.type === "outline-volume") && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}</section></div>}
      {newProjectOpen && <div className="modal-backdrop" onMouseDown={() => setNewProjectOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW PROJECT</span><h2>新建作品</h2></div><button className="icon-button" aria-label="关闭新建作品" onClick={() => setNewProjectOpen(false)}><X size={19} /></button></div><label className="field"><span>作品名称</span><input autoFocus value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newProjectTitle.trim()) void createNewProject(); }} placeholder="例如：雾港来信" /></label><p className="modal-help">新作品会自动建立“第一章”，并与现有作品的数据完全分开。</p><button className="primary-button full" disabled={!newProjectTitle.trim() || busy} onClick={() => void createNewProject()}><CirclePlus size={17} />创建作品</button></section></div>}
      {relationshipDraft && <div className="modal-backdrop" onMouseDown={() => setRelationshipDraft(null)}><section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CHARACTER RELATIONSHIP</span><h2>添加人物关系</h2></div><button className="icon-button" aria-label="关闭添加人物关系" onClick={() => setRelationshipDraft(null)}><X size={19} /></button></div><p className="modal-help">直接从当前作品已有的人物中选择关系双方。这条关系会进入后续 AI 写作上下文。</p><div className="two-columns"><Field label="起点人物" value={relationshipDraft.sourceCharacterId} options={workspace.characters.map((character) => ({ label: character.name, value: character.id }))} onChange={(sourceCharacterId) => { const targetCharacterId = sourceCharacterId === relationshipDraft.targetCharacterId ? workspace.characters.find((character) => character.id !== sourceCharacterId)?.id || "" : relationshipDraft.targetCharacterId; setRelationshipDraft({ ...relationshipDraft, sourceCharacterId, targetCharacterId }); }} /><Field label="目标人物" value={relationshipDraft.targetCharacterId} options={workspace.characters.map((character) => ({ label: character.name, value: character.id }))} onChange={(targetCharacterId) => { const sourceCharacterId = targetCharacterId === relationshipDraft.sourceCharacterId ? workspace.characters.find((character) => character.id !== targetCharacterId)?.id || "" : relationshipDraft.sourceCharacterId; setRelationshipDraft({ ...relationshipDraft, sourceCharacterId, targetCharacterId }); }} /></div><Field label="关系类型" value={relationshipDraft.type} onChange={(type) => setRelationshipDraft({ ...relationshipDraft, type })} /><Field label="关系说明" value={relationshipDraft.description} multiline onChange={(description) => setRelationshipDraft({ ...relationshipDraft, description })} /><button className="primary-button full" disabled={busy || !relationshipDraft.type.trim() || relationshipDraft.sourceCharacterId === relationshipDraft.targetCharacterId} onClick={() => void createRelationship()}><CirclePlus size={17} />确认添加关系</button></section></div>}
      {characterImportPreview && <div className="modal-backdrop" onMouseDown={() => setCharacterImportPreview(null)}><section className="settings-modal wide-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">JSON IMPORT PREVIEW</span><h2>导入人物与关系</h2></div><button className="icon-button" aria-label="关闭 JSON 导入预览" onClick={() => setCharacterImportPreview(null)}><X size={19} /></button></div><p className="modal-help">文件：{characterImportPreview.fileName}。同名人物会合并：JSON 中的非空字段覆盖旧值，空字段保留原内容。</p><div className="import-summary"><span><strong>{characterImportPreview.data.characters.length}</strong> 个人物</span><span><strong>{characterImportPreview.data.relationships.length}</strong> 条关系</span></div><div className="import-preview-list">{characterImportPreview.data.characters.map((character) => { const existing = workspace.characters.some((item) => normalizeCharacterName(item.name) === normalizeCharacterName(character.name)); return <div className="import-preview-row" key={character.name}><span className={existing ? "import-status update" : "import-status"}>{existing ? "合并" : "新增"}</span><div><strong>{character.name}</strong><small>{character.role || character.description || "未填写角色说明"}</small></div></div>; })}{characterImportPreview.data.relationships.map((relationship, index) => <div className="import-preview-row relationship" key={`${relationship.sourceName}-${relationship.targetName}-${relationship.type}-${index}`}><span className="import-status relation">关系</span><div><strong>{relationship.sourceName} → {relationship.targetName}</strong><small>{relationship.type}{relationship.description ? `：${relationship.description}` : ""}</small></div></div>)}</div>{characterImportPreview.missingNames.length > 0 && <div className="ai-error"><AlertTriangle size={16} /><span>以下关系人物既不在文件中，也不在当前作品中：{characterImportPreview.missingNames.join("、")}。请先把他们加入 characters 数组。</span></div>}<div className="modal-button-row"><button className="secondary-button" onClick={() => setCharacterImportPreview(null)}>取消</button><button className="primary-button" disabled={busy || characterImportPreview.missingNames.length > 0} onClick={() => void importCharactersFromJson()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}确认导入</button></div></section></div>}
    </main>
  );
}

function ContentPage({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</div>;
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function ManuscriptTree({ workspace, selectedChapterId, collapsedVolumes, onToggleVolume, onSelectChapter }: {
  workspace: Workspace;
  selectedChapterId: string;
  collapsedVolumes: Set<string>;
  onToggleVolume: (volumeId: string) => void;
  onSelectChapter: (chapter: Chapter) => void;
}) {
  const nodesById = new Map(workspace.outline.map((node) => [node.id, node]));
  const volumes = workspace.outline.filter((node) => node.type === "volume");
  const grouped = new Map(volumes.map((volume) => [volume.id, [] as Chapter[]]));
  const unfiled: Chapter[] = [];
  workspace.chapters.forEach((chapter) => {
    let node = chapter.outlineNodeId ? nodesById.get(chapter.outlineNodeId) : undefined;
    while (node && node.type !== "volume" && node.parentId) node = nodesById.get(node.parentId);
    if (node?.type === "volume" && grouped.has(node.id)) grouped.get(node.id)?.push(chapter); else unfiled.push(chapter);
  });
  return <>{volumes.map((volume) => {
    const chapters = grouped.get(volume.id) || [];
    const collapsed = collapsedVolumes.has(volume.id);
    const active = chapters.some((chapter) => chapter.id === selectedChapterId);
    return <div className="manuscript-volume" key={volume.id}><button className={active ? "manuscript-volume-toggle active" : "manuscript-volume-toggle"} aria-expanded={!collapsed} onClick={() => onToggleVolume(volume.id)}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<div><strong>{volume.title}</strong><small>{chapters.length} 章 · {chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0).toLocaleString()} 字</small></div></button>{!collapsed && <div className="manuscript-volume-children">{chapters.length ? chapters.map((chapter) => <ChapterTreeItem key={chapter.id} chapter={chapter} selected={chapter.id === selectedChapterId} onSelect={() => onSelectChapter(chapter)} />) : <span className="tree-empty">本卷还没有章节</span>}</div>}</div>;
  })}{unfiled.length > 0 && <div className="manuscript-volume unfiled"><div className="manuscript-volume-label"><FileText size={14} /><strong>未归档章节</strong></div><div className="manuscript-volume-children">{unfiled.map((chapter) => <ChapterTreeItem key={chapter.id} chapter={chapter} selected={chapter.id === selectedChapterId} onSelect={() => onSelectChapter(chapter)} />)}</div></div>}</>;
}

function ChapterTreeItem({ chapter, selected, onSelect }: { chapter: Chapter; selected: boolean; onSelect: () => void }) {
  return <button className={selected ? "chapter-item selected" : "chapter-item"} onClick={onSelect}><span>{String(chapter.position + 1).padStart(2, "0")}</span><div><strong>{chapter.title}</strong><small>{chapter.outlineStale ? "⚠ 大纲已更新 · " : ""}{chapter.wordCount} 字 · {chapter.status}</small></div><ChevronRight size={15} /></button>;
}

function OutlineTreeRows({ nodes, selectedId, collapsedVolumes, onToggleVolume, onSelect }: {
  nodes: Workspace["outline"];
  selectedId: string;
  collapsedVolumes: Set<string>;
  onToggleVolume: (volumeId: string) => void;
  onSelect: (node: Workspace["outline"][number]) => void;
}) {
  const ids = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter((node) => !node.parentId || !ids.has(node.parentId));
  return <>{roots.map((node) => <OutlineTreeBranch key={node.id} node={node} nodes={nodes} selectedId={selectedId} collapsedVolumes={collapsedVolumes} onToggleVolume={onToggleVolume} onSelect={onSelect} />)}</>;
}

function OutlineTreeBranch({ node, nodes, selectedId, collapsedVolumes, onToggleVolume, onSelect }: {
  node: Workspace["outline"][number];
  nodes: Workspace["outline"];
  selectedId: string;
  collapsedVolumes: Set<string>;
  onToggleVolume: (volumeId: string) => void;
  onSelect: (node: Workspace["outline"][number]) => void;
}) {
  const children = nodes.filter((item) => item.parentId === node.id);
  const collapsed = node.type === "volume" && collapsedVolumes.has(node.id);
  return <div className={`outline-branch depth-${node.type}`}><div className="outline-tree-row">{node.type === "volume" ? <button className="tree-toggle" title={collapsed ? "展开本卷" : "收起本卷"} aria-label={`${collapsed ? "展开" : "收起"}《${node.title}》`} aria-expanded={!collapsed} onClick={() => onToggleVolume(node.id)}>{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button> : <span className="tree-guide" />}<button className={`outline-node${node.id === selectedId ? " selected" : ""}`} onClick={() => onSelect(node)}><span className={`node-type ${node.type}`}>{node.type === "volume" ? "卷" : node.type === "chapter" ? "章" : "场"}</span><div><h3>{node.title}</h3><p>{node.summary || "尚未填写摘要"}</p></div><span className="status-pill">v{node.revision} · {node.status}</span></button></div>{!collapsed && children.map((child) => <OutlineTreeBranch key={child.id} node={child} nodes={nodes} selectedId={selectedId} collapsedVolumes={collapsedVolumes} onToggleVolume={onToggleVolume} onSelect={onSelect} />)}</div>;
}

function ProposalCard({ proposal, onApply, onClose }: { proposal: AiProposal; onApply: () => void; onClose: () => void }) {
  return <div className="proposal-card"><div className="proposal-head"><strong>AI 提案</strong><button onClick={onClose}><X size={15} /></button></div>{proposal.type === "text" ? <p>{proposal.result.slice(0, 900)}{proposal.result.length > 900 ? "…" : ""}</p> : proposal.type === "outline-node" ? <div><p>{proposal.proposal.rationale}</p><div className="proposal-node"><span>节点</span><strong>{proposal.proposal.title}</strong><small>{proposal.proposal.summary}</small></div></div> : <div><p>{proposal.proposal.rationale}</p>{proposal.proposal.nodes.map((node, index) => <div className="proposal-node" key={`${node.title}-${index}`}><span>{node.type}</span><strong>{node.title}</strong><small>{node.summary}</small></div>)}</div>}{proposal.type === "text" && proposal.requestId && <small className="proposal-log-id">日志编号：{proposal.requestId}</small>}<button className="accept-button" onClick={onApply}><Check size={16} />接受并写入</button></div>;
}

function Field({ label, value, onChange, multiline, options }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; options?: Array<{ label: string; value: string }> }) {
  return <label className="field"><span>{label}</span>{options ? <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>;
}
