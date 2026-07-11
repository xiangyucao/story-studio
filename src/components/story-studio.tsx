"use client";
/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle, BookOpen, Bot, BrainCircuit, Check, ChevronRight, CirclePlus, Clock3,
  Download, FileText, FileType2, GitBranch, History, ImagePlus, LoaderCircle,
  Network, Printer, Save, Search, Settings, Sparkles, Users, WandSparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chapter, Character, ModelSettings, Project, Workspace } from "@/lib/types";

type Tab = "write" | "outline" | "characters" | "world" | "logic" | "history";
type AiAction = "outline" | "outline-node" | "expand" | "revise" | "logic";
type NodeCreateDraft = { type: "volume" | "chapter" | "scene"; parentId: string | null; afterId: string | null; title: string; summary: string; heading: string };
type AiProposal = { type: "text"; result: string } | {
  type: "outline";
  proposal: { rationale: string; nodes: Array<{ type: "volume" | "chapter" | "scene"; title: string; summary: string }> };
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
  baseUrl: "http://127.0.0.1:11434/v1",
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data as T;
}

export function StoryStudio() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("outline");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedOutlineId, setSelectedOutlineId] = useState("");
  const [chapterDraft, setChapterDraft] = useState<Chapter | null>(null);
  const [characterDraft, setCharacterDraft] = useState<Character | null>(null);
  const [outlineDraft, setOutlineDraft] = useState<Workspace["outline"][number] | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [overallOutlineOpen, setOverallOutlineOpen] = useState(false);
  const [nodeCreateDraft, setNodeCreateDraft] = useState<NodeCreateDraft | null>(null);
  const [deleteOutlineOpen, setDeleteOutlineOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [settings, setSettings] = useState<ModelSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    const saved = localStorage.getItem("story-studio-model-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiAction, setAiAction] = useState<AiAction>("revise");
  const [proposalAction, setProposalAction] = useState<AiAction>("revise");
  const [outlineAiInstruction, setOutlineAiInstruction] = useState("");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [logicQuery, setLogicQuery] = useState("");
  const [logicAnswer, setLogicAnswer] = useState("");

  const loadWorkspace = useCallback(async (projectId?: string, preferredOutlineId?: string) => {
    setBusy(true);
    try {
      const data = await jsonFetch<Workspace>(`/api/workspace${projectId ? `?projectId=${projectId}` : ""}`);
      setWorkspace(data);
      setProjectDraft({ ...data.project });
      const chapter = data.chapters.find((item) => item.id === selectedChapterId) ?? data.chapters[0] ?? null;
      const character = data.characters.find((item) => item.id === selectedCharacterId) ?? data.characters[0] ?? null;
      const outlineNode = data.outline.find((item) => item.id === (preferredOutlineId || selectedOutlineId)) ?? data.outline[0] ?? null;
      setSelectedChapterId(chapter?.id || "");
      setChapterDraft(chapter);
      setSelectedCharacterId(character?.id || "");
      setCharacterDraft(character);
      setSelectedOutlineId(outlineNode?.id || "");
      setOutlineDraft(outlineNode ? { ...outlineNode } : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }, [selectedChapterId, selectedCharacterId, selectedOutlineId]);

  useEffect(() => {
    // 首次挂载后从本地 API 载入持久化工作区。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace();
    // 初次加载只执行一次；后续刷新由显式操作触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setProposal(null);
    try {
      const data = await jsonFetch<AiProposal>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action,
          projectId: workspace.project.id,
          chapterId: selectedChapterId || undefined,
          selection: action === "outline-node" ? JSON.stringify(outlineDraft) : chapterDraft?.content,
          instruction,
          settings,
        }),
      });
      setProposal(data);
      setProposalAction(action);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 调用失败");
    } finally {
      setBusy(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal || !workspace) return;
    if (proposal.type === "text") {
      await saveChapter(`AI：${aiInstruction || "按最新大纲生成"}`, proposal.result, proposalAction === "expand");
    } else if (proposal.type === "outline-node") {
      if (!outlineDraft) return;
      await mutate("save-outline-node", { ...outlineDraft, title: proposal.proposal.title, summary: proposal.proposal.summary });
      setMessage("节点提案已写入；关联正文已按需标记为待同步");
      setOutlineAiInstruction("");
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

  const wordCount = useMemo(() => chapterDraft?.content.replace(/\s/g, "").length ?? 0, [chapterDraft?.content]);
  const activeChapterOutline = useMemo(() => workspace?.outline.find((node) => node.id === chapterDraft?.outlineNodeId) ?? null, [workspace?.outline, chapterDraft?.outlineNodeId]);
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
                {workspace.chapters.map((chapter) => <button key={chapter.id} className={chapter.id === selectedChapterId ? "chapter-item selected" : "chapter-item"} onClick={() => selectChapter(chapter)}><span>{String(chapter.position + 1).padStart(2, "0")}</span><div><strong>{chapter.title}</strong><small>{chapter.outlineStale ? "⚠ 大纲已更新 · " : ""}{chapter.wordCount} 字 · {chapter.status}</small></div><ChevronRight size={15} /></button>)}
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
              <div className="context-note"><BrainCircuit size={16} /><div><strong>自动上下文</strong><span>相关章节、人物、硬设定与事件链会随请求发送。</span></div></div>
              {proposal && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}
            </aside>
          </div>
        )}

        {activeTab === "outline" && (
          <ContentPage eyebrow="STRUCTURE" title="故事大纲" description="先确定卷、章和场景，再进入写作扩展；每个节点都可以独立修改。" action={<button className="primary-button" onClick={() => { setAiAction("outline"); setAiInstruction(""); setProposal(null); setOverallOutlineOpen(true); }}><Sparkles size={17} />用 AI 构思整体大纲</button>}>
            {projectDraft && <div className="project-foundation"><div className="section-heading"><div><span className="eyebrow">STORY FOUNDATION</span><h2>作品基石</h2></div><button className="primary-button small" onClick={() => void mutate("save-project", projectDraft as unknown as Record<string, unknown>)}><Save size={15} />保存</button></div><div className="foundation-grid"><Field label="作品名" value={projectDraft.title} onChange={(title) => setProjectDraft({ ...projectDraft, title })} /><Field label="类型" value={projectDraft.genre} onChange={(genre) => setProjectDraft({ ...projectDraft, genre })} /></div><Field label="核心构想" value={projectDraft.premise} multiline onChange={(premise) => setProjectDraft({ ...projectDraft, premise })} /><Field label="写作规则 / 风格指南" value={projectDraft.styleGuide} multiline onChange={(styleGuide) => setProjectDraft({ ...projectDraft, styleGuide })} /></div>}
            <div className="outline-grid">
              <div className="outline-tree">
                <div className="outline-tree-header"><div><span className="eyebrow">OUTLINE TREE</span><strong>卷 · 章 · 场景</strong></div><button className="secondary-button" onClick={() => setNodeCreateDraft({ type: "volume", parentId: null, afterId: workspace.outline.at(-1)?.id || null, title: `第${workspace.outline.filter((node) => node.type === "volume").length + 1}卷`, summary: "", heading: "添加新卷" })}><CirclePlus size={15} />添加卷</button></div>
                {workspace.outline.map((node) => <button key={node.id} className={`outline-node depth-${node.type}${node.id === selectedOutlineId ? " selected" : ""}`} onClick={() => { setSelectedOutlineId(node.id); setOutlineDraft({ ...node }); setProposal(null); setOutlineAiInstruction(""); }}><span className={`node-type ${node.type}`}>{node.type === "volume" ? "卷" : node.type === "chapter" ? "章" : "场"}</span><div><h3>{node.title}</h3><p>{node.summary || "尚未填写摘要"}</p></div><span className="status-pill">v{node.revision} · {node.status}</span></button>)}
              </div>
              <div className="outline-side">{outlineDraft && <><div className="detail-editor outline-editor"><div className="section-heading"><div><span className="eyebrow">SELECTED NODE</span><h2>{outlineDraft.type === "volume" ? "卷" : outlineDraft.type === "chapter" ? "章" : "场景"}节点</h2></div><button className="primary-button small" onClick={async () => { await mutate("save-outline-node", outlineDraft as unknown as Record<string, unknown>); setMessage("大纲节点已保存；关联正文已按需标记"); }}><Save size={15} />保存</button></div><Field label="标题" value={outlineDraft.title} onChange={(title) => setOutlineDraft({ ...outlineDraft, title })} /><Field label="剧情摘要 / 本节点要完成的任务" value={outlineDraft.summary} multiline onChange={(summary) => setOutlineDraft({ ...outlineDraft, summary })} /><Field label="状态" value={outlineDraft.status} options={[{ label: "计划中", value: "planned" }, { label: "已起草", value: "drafted" }, { label: "已完成", value: "complete" }]} onChange={(status) => setOutlineDraft({ ...outlineDraft, status })} />{outlineDraft.type === "chapter" && (() => { const linked = workspace.chapters.find((chapter) => chapter.outlineNodeId === outlineDraft.id); return linked ? <button className="secondary-button full-action" onClick={() => selectChapter(linked)}><FileText size={15} />进入本章写作{linked.outlineStale ? "（待同步）" : ""}</button> : null; })()}<div className="outline-structure-actions">{outlineDraft.type === "volume" && <><button onClick={() => setNodeCreateDraft({ type: "chapter", parentId: outlineDraft.id, afterId: outlineDraft.id, title: "新章", summary: "", heading: `在《${outlineDraft.title}》中添加章节` })}><CirclePlus size={14} />本卷添加章</button><button onClick={() => setNodeCreateDraft({ type: "volume", parentId: null, afterId: outlineDraft.id, title: "新卷", summary: "", heading: `在《${outlineDraft.title}》后插入新卷` })}><CirclePlus size={14} />后插新卷</button></>}{outlineDraft.type === "chapter" && <><button onClick={() => setNodeCreateDraft({ type: "scene", parentId: outlineDraft.id, afterId: outlineDraft.id, title: "新场景", summary: "", heading: `在《${outlineDraft.title}》中添加场景` })}><CirclePlus size={14} />本章添加场景</button><button onClick={() => setNodeCreateDraft({ type: "chapter", parentId: outlineDraft.parentId, afterId: outlineDraft.id, title: "新章", summary: "", heading: `在《${outlineDraft.title}》后插入新章` })}><CirclePlus size={14} />后插新章</button></>}{outlineDraft.type === "scene" && <button onClick={() => setNodeCreateDraft({ type: "scene", parentId: outlineDraft.parentId, afterId: outlineDraft.id, title: "新场景", summary: "", heading: `在《${outlineDraft.title}》后插入场景` })}><CirclePlus size={14} />后插场景</button>}<button className="danger-text-button" onClick={() => setDeleteOutlineOpen(true)}>删除此{outlineDraft.type === "volume" ? "卷" : outlineDraft.type === "chapter" ? "章" : "场景"}</button></div></div><div className="inline-ai-card node-ai-card"><Sparkles size={20} /><h3>AI 单独修改这个节点</h3><p>只修改当前节点，不会改动其他卷、章或场景。</p><textarea value={outlineAiInstruction} onChange={(e) => setOutlineAiInstruction(e.target.value)} placeholder="例如：保留结局不变，但让本章中点出现一次更强的错误判断……" /><button className="primary-button full" onClick={() => void callAi("outline-node")} disabled={busy || !outlineAiInstruction.trim()}>生成节点修改提案</button>{proposal?.type === "outline-node" && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}</div></>}</div>
            </div>
          </ContentPage>
        )}

        {activeTab === "characters" && (
          <ContentPage eyebrow="CAST" title="人物与关系" description="人物动机、秘密和说话方式是连续性检查的基础。" action={<button className="primary-button" onClick={async () => { const name = window.prompt("人物姓名"); if (name) await mutate("create-character", { projectId: workspace.project.id, name }); }}><CirclePlus size={17} />添加人物</button>}>
            <div className="character-layout">
              <div className="character-grid">{workspace.characters.map((character) => <button key={character.id} className={character.id === selectedCharacterId ? "character-card selected" : "character-card"} onClick={() => { setSelectedCharacterId(character.id); setCharacterDraft({ ...character }); }}><div className="avatar">{character.name.slice(0, 1)}</div><div><h3>{character.name}</h3><span>{character.role || "待设定角色"}</span><p>{character.goal || character.description}</p></div></button>)}</div>
              {characterDraft && <div className="detail-editor"><div className="section-heading"><div><span className="eyebrow">CHARACTER CARD</span><h2>{characterDraft.name}</h2></div><button className="primary-button small" onClick={() => void mutate("save-character", characterDraft as unknown as Record<string, unknown>)}><Save size={15} />保存</button></div><Field label="姓名" value={characterDraft.name} onChange={(name) => setCharacterDraft({ ...characterDraft, name })} /><Field label="角色" value={characterDraft.role} onChange={(role) => setCharacterDraft({ ...characterDraft, role })} /><Field label="描述" value={characterDraft.description} multiline onChange={(description) => setCharacterDraft({ ...characterDraft, description })} /><div className="two-columns"><Field label="目标" value={characterDraft.goal} onChange={(goal) => setCharacterDraft({ ...characterDraft, goal })} /><Field label="恐惧" value={characterDraft.fear} onChange={(fear) => setCharacterDraft({ ...characterDraft, fear })} /></div><Field label="秘密" value={characterDraft.secret} onChange={(secret) => setCharacterDraft({ ...characterDraft, secret })} /><Field label="说话风格" value={characterDraft.voice} multiline onChange={(voice) => setCharacterDraft({ ...characterDraft, voice })} /></div>}
            </div>
            <div className="subsection-heading"><h2 className="subsection-title">关系网络</h2><button className="tiny-button" title="添加关系" onClick={async () => { const sourceName = window.prompt("起点人物姓名"); const targetName = window.prompt("目标人物姓名"); const source = workspace.characters.find((c) => c.name === sourceName); const target = workspace.characters.find((c) => c.name === targetName); if (!source || !target) { setMessage("没有找到对应人物，请输入人物卡中的完整姓名"); return; } const type = window.prompt("关系类型", "盟友") || "关系"; const description = window.prompt("关系说明", "") || ""; await mutate("create-relationship", { projectId: workspace.project.id, sourceCharacterId: source.id, targetCharacterId: target.id, type, description }); }}><CirclePlus size={16} /></button></div><div className="relationship-list">{workspace.relationships.map((r) => <div key={r.id} className="relationship-row"><strong>{r.sourceName}</strong><span><i />{r.type}<i /></span><strong>{r.targetName}</strong><p>{r.description}</p></div>)}</div>
          </ContentPage>
        )}

        {activeTab === "world" && (
          <ContentPage eyebrow="WORLD BIBLE" title="世界观与背景" description="标为硬设定的内容会进入每次相关 AI 请求。" action={<button className="primary-button" onClick={async () => { const name = window.prompt("设定名称"); if (name) { const category = window.prompt("分类", "背景") || "背景"; const description = window.prompt("设定说明", "") || ""; await mutate("create-world", { projectId: workspace.project.id, name, category, description, isCanon: true }); } }}><CirclePlus size={17} />添加设定</button>}>
            <div className="world-grid">{workspace.worldEntries.map((entry) => <article key={entry.id} className="world-card"><div><span className="category-tag">{entry.category}</span>{entry.isCanon && <span className="canon-tag"><Check size={12} />硬设定</span>}</div><h3>{entry.name}</h3><p>{entry.description}</p></article>)}</div>
            <div className="subsection-heading"><h2 className="subsection-title">事件时间线</h2><button className="tiny-button" title="添加事件" onClick={async () => { const title = window.prompt("事件名称"); if (title) { const storyTime = window.prompt("故事内时间", "") || ""; const description = window.prompt("事件经过", "") || ""; const causes = window.prompt("前置原因", "") || ""; const consequences = window.prompt("直接结果", "") || ""; await mutate("create-event", { projectId: workspace.project.id, title, storyTime, description, causes, consequences }); } }}><CirclePlus size={16} /></button></div><div className="timeline">{workspace.events.map((event) => <article key={event.id} className="timeline-event"><div className="timeline-dot" /><span>{event.storyTime || "时间待定"}</span><h3>{event.title}</h3><p>{event.description}</p><div className="cause-effect"><span><b>原因</b>{event.causes}</span><ChevronRight size={18} /><span><b>结果</b>{event.consequences}</span></div></article>)}</div>
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

      {settingsOpen && <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MODEL PROVIDER</span><h2>模型设置</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div><Field label="提供方" value={settings.provider} options={[{ label: "OpenAI Responses API", value: "openai" }, { label: "本地 / OpenAI-compatible", value: "openai-compatible" }]} onChange={(provider) => setSettings({ ...settings, provider: provider as ModelSettings["provider"] })} /><Field label="模型名称" value={settings.model} onChange={(model) => setSettings({ ...settings, model })} />{settings.provider === "openai-compatible" && <Field label="Base URL" value={settings.baseUrl || ""} onChange={(baseUrl) => setSettings({ ...settings, baseUrl })} />}<div className="security-note">API Key 不会存入浏览器。OpenAI 使用服务器端 <code>OPENAI_API_KEY</code>；本地模型默认无需密钥。</div><button className="primary-button full" onClick={() => { localStorage.setItem("story-studio-model-settings", JSON.stringify(settings)); setSettingsOpen(false); setMessage("模型设置已保存在本机浏览器"); }}><Save size={17} />保存设置</button></section></div>}
      {exportOpen && <div className="modal-backdrop" onMouseDown={() => setExportOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">EXPORT</span><h2>导出《{workspace.project.title}》</h2></div><button className="icon-button" onClick={() => setExportOpen(false)}><X size={19} /></button></div><div className="export-options"><button onClick={() => { window.open(`/export/${workspace.project.id}`, "_blank", "noopener,noreferrer"); setExportOpen(false); }}><span className="export-icon"><Printer size={22} /></span><div><strong>PDF / 打印稿</strong><small>A4 专业排版，包含章节插画；在打印窗口选择“另存为 PDF”。</small></div><ChevronRight size={17} /></button><a href={`/api/export/markdown?projectId=${workspace.project.id}`} onClick={() => setExportOpen(false)}><span className="export-icon"><FileType2 size={22} /></span><div><strong>Markdown 原稿</strong><small>适合备份、版本管理以及导入其他写作工具。</small></div><ChevronRight size={17} /></a></div><div className="security-note">PDF 使用浏览器原生打印引擎，中文字体与插画会按当前电脑的实际效果排版。</div></section></div>}
      {nodeCreateDraft && <div className="modal-backdrop" onMouseDown={() => setNodeCreateDraft(null)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">INSERT OUTLINE NODE</span><h2>{nodeCreateDraft.heading}</h2></div><button className="icon-button" aria-label="关闭新增大纲节点" onClick={() => setNodeCreateDraft(null)}><X size={19} /></button></div><div className="node-kind-preview"><span className={`node-type ${nodeCreateDraft.type}`}>{nodeCreateDraft.type === "volume" ? "卷" : nodeCreateDraft.type === "chapter" ? "章" : "场"}</span><p>{nodeCreateDraft.type === "chapter" ? "保存后会同时建立对应的写作章节。" : nodeCreateDraft.type === "scene" ? "场景会归入当前章节，不单独建立正文文件。" : "新卷可以继续添加章节和场景。"}</p></div><Field label="标题" value={nodeCreateDraft.title} onChange={(title) => setNodeCreateDraft({ ...nodeCreateDraft, title })} /><Field label="剧情摘要 / 要完成的任务" value={nodeCreateDraft.summary} multiline onChange={(summary) => setNodeCreateDraft({ ...nodeCreateDraft, summary })} /><button className="primary-button full" disabled={busy || !nodeCreateDraft.title.trim()} onClick={() => void createOutlineNode()}><CirclePlus size={16} />确认插入</button></section></div>}
      {deleteOutlineOpen && outlineDraft && <div className="modal-backdrop" onMouseDown={() => setDeleteOutlineOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow danger-eyebrow">DELETE OUTLINE NODE</span><h2>删除《{outlineDraft.title}》？</h2></div><button className="icon-button" aria-label="关闭删除确认" onClick={() => setDeleteOutlineOpen(false)}><X size={19} /></button></div><div className="delete-impact"><AlertTriangle size={24} /><div><strong>此操作不能撤销</strong><p>将删除 {deleteImpact.nodes} 个大纲节点、{deleteImpact.chapters} 个关联章节。{deleteImpact.writtenChapters > 0 ? `其中 ${deleteImpact.writtenChapters} 章已有正文，共 ${deleteImpact.words} 字，也会一并删除。` : "没有已写正文会受到影响。"}</p></div></div><div className="modal-button-row"><button className="secondary-button" onClick={() => setDeleteOutlineOpen(false)}>取消</button><button className="danger-button" disabled={busy} onClick={() => void deleteSelectedOutline()}>确认删除</button></div></section></div>}
      {overallOutlineOpen && <div className="modal-backdrop" onMouseDown={() => setOverallOutlineOpen(false)}><section className="settings-modal wide-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">AI STORY ARCHITECT</span><h2>构思或扩充整体大纲</h2></div><button className="icon-button" aria-label="关闭整体大纲构思" onClick={() => setOverallOutlineOpen(false)}><X size={19} /></button></div><p className="modal-help">AI 会返回结构化的卷、章、场景提案。接受后，每个“章”都会自动建立可写作的章节。</p><textarea className="prompt-box outline-modal-prompt" value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder="例如：设计三卷十二章的悬疑故事。第一卷完成回乡与错误线索，第二卷揭开家族关系，第三卷回收仓库和潮汐伏笔……" /><button className="primary-button full" disabled={busy || !aiInstruction.trim()} onClick={() => void callAi("outline")}><Sparkles size={17} />生成结构化整体大纲</button>{proposal?.type === "outline" && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}</section></div>}
      {newProjectOpen && <div className="modal-backdrop" onMouseDown={() => setNewProjectOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW PROJECT</span><h2>新建作品</h2></div><button className="icon-button" aria-label="关闭新建作品" onClick={() => setNewProjectOpen(false)}><X size={19} /></button></div><label className="field"><span>作品名称</span><input autoFocus value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newProjectTitle.trim()) void createNewProject(); }} placeholder="例如：雾港来信" /></label><p className="modal-help">新作品会自动建立“第一章”，并与现有作品的数据完全分开。</p><button className="primary-button full" disabled={!newProjectTitle.trim() || busy} onClick={() => void createNewProject()}><CirclePlus size={17} />创建作品</button></section></div>}
    </main>
  );
}

function ContentPage({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</div>;
}

function ProposalCard({ proposal, onApply, onClose }: { proposal: AiProposal; onApply: () => void; onClose: () => void }) {
  return <div className="proposal-card"><div className="proposal-head"><strong>AI 提案</strong><button onClick={onClose}><X size={15} /></button></div>{proposal.type === "text" ? <p>{proposal.result.slice(0, 900)}{proposal.result.length > 900 ? "…" : ""}</p> : proposal.type === "outline-node" ? <div><p>{proposal.proposal.rationale}</p><div className="proposal-node"><span>节点</span><strong>{proposal.proposal.title}</strong><small>{proposal.proposal.summary}</small></div></div> : <div><p>{proposal.proposal.rationale}</p>{proposal.proposal.nodes.map((node, index) => <div className="proposal-node" key={`${node.title}-${index}`}><span>{node.type}</span><strong>{node.title}</strong><small>{node.summary}</small></div>)}</div>}<button className="accept-button" onClick={onApply}><Check size={16} />接受并写入</button></div>;
}

function Field({ label, value, onChange, multiline, options }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; options?: Array<{ label: string; value: string }> }) {
  return <label className="field"><span>{label}</span>{options ? <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>;
}
