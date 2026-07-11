"use client";
/* eslint-disable @next/next/no-img-element */

import {
  BookOpen, Bot, BrainCircuit, Check, ChevronRight, CirclePlus, Clock3,
  Download, FileText, FileType2, GitBranch, History, ImagePlus, LoaderCircle,
  Network, Printer, Save, Search, Settings, Sparkles, Users, WandSparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chapter, Character, ModelSettings, Project, Workspace } from "@/lib/types";

type Tab = "write" | "outline" | "characters" | "world" | "logic" | "history";
type AiProposal = { type: "text"; result: string } | {
  type: "outline";
  proposal: { rationale: string; nodes: Array<{ type: "volume" | "chapter" | "scene"; title: string; summary: string }> };
};

const navItems: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
  { id: "write", label: "写作", icon: FileText },
  { id: "outline", label: "大纲", icon: GitBranch },
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
  const [activeTab, setActiveTab] = useState<Tab>("write");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [chapterDraft, setChapterDraft] = useState<Chapter | null>(null);
  const [characterDraft, setCharacterDraft] = useState<Character | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [settings, setSettings] = useState<ModelSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    const saved = localStorage.getItem("story-studio-model-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiAction, setAiAction] = useState<"outline" | "expand" | "revise" | "logic">("revise");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [logicQuery, setLogicQuery] = useState("");
  const [logicAnswer, setLogicAnswer] = useState("");

  const loadWorkspace = useCallback(async (projectId?: string) => {
    setBusy(true);
    try {
      const data = await jsonFetch<Workspace>(`/api/workspace${projectId ? `?projectId=${projectId}` : ""}`);
      setWorkspace(data);
      setProjectDraft({ ...data.project });
      const chapter = data.chapters.find((item) => item.id === selectedChapterId) ?? data.chapters[0] ?? null;
      const character = data.characters.find((item) => item.id === selectedCharacterId) ?? data.characters[0] ?? null;
      setSelectedChapterId(chapter?.id || "");
      setChapterDraft(chapter);
      setSelectedCharacterId(character?.id || "");
      setCharacterDraft(character);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }, [selectedChapterId, selectedCharacterId]);

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

  const saveChapter = async (instruction?: string, contentOverride?: string) => {
    if (!chapterDraft) return;
    const content = contentOverride ?? chapterDraft.content;
    await mutate("save-chapter", { ...chapterDraft, content, instruction: instruction || "手动编辑" });
    setChapterDraft({ ...chapterDraft, content });
    setMessage("章节已保存，并记录版本");
  };

  const callAi = async () => {
    if (!workspace || !aiInstruction.trim()) return;
    setBusy(true);
    setMessage("");
    setProposal(null);
    try {
      const data = await jsonFetch<AiProposal>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action: aiAction,
          projectId: workspace.project.id,
          chapterId: selectedChapterId || undefined,
          selection: chapterDraft?.content,
          instruction: aiInstruction,
          settings,
        }),
      });
      setProposal(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 调用失败");
    } finally {
      setBusy(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal || !workspace) return;
    if (proposal.type === "text") {
      await saveChapter(`AI：${aiInstruction}`, proposal.result);
    } else {
      await mutate("apply-outline", { projectId: workspace.project.id, nodes: proposal.proposal.nodes });
      setMessage("大纲提案已加入项目");
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
      setActiveTab("write");
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

  const wordCount = useMemo(() => chapterDraft?.content.replace(/\s/g, "").length ?? 0, [chapterDraft?.content]);

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
                {workspace.chapters.map((chapter) => <button key={chapter.id} className={chapter.id === selectedChapterId ? "chapter-item selected" : "chapter-item"} onClick={() => selectChapter(chapter)}><span>{String(chapter.position + 1).padStart(2, "0")}</span><div><strong>{chapter.title}</strong><small>{chapter.wordCount} 字 · {chapter.status}</small></div><ChevronRight size={15} /></button>)}
              </div>
              <div className="manuscript-total"><span>全书字数</span><strong>{workspace.chapters.reduce((sum, item) => sum + item.wordCount, 0).toLocaleString()}</strong></div>
            </aside>

            <article className="editor-card">
              <div className="editor-toolbar">
                <input className="title-input" value={chapterDraft.title} onChange={(e) => setChapterDraft({ ...chapterDraft, title: e.target.value })} />
                <div><span>{wordCount.toLocaleString()} 字</span><button className="primary-button small" onClick={() => void saveChapter()}><Save size={16} />保存</button></div>
              </div>
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
          <ContentPage eyebrow="STRUCTURE" title="故事大纲" description="从卷、章到场景，记录每一步的目标与转折。" action={<button className="primary-button" onClick={() => { setAiAction("outline"); setAiInstruction(""); }}><Sparkles size={17} />用 AI 构思</button>}>
            {projectDraft && <div className="project-foundation"><div className="section-heading"><div><span className="eyebrow">STORY FOUNDATION</span><h2>作品基石</h2></div><button className="primary-button small" onClick={() => void mutate("save-project", projectDraft as unknown as Record<string, unknown>)}><Save size={15} />保存</button></div><div className="foundation-grid"><Field label="作品名" value={projectDraft.title} onChange={(title) => setProjectDraft({ ...projectDraft, title })} /><Field label="类型" value={projectDraft.genre} onChange={(genre) => setProjectDraft({ ...projectDraft, genre })} /></div><Field label="核心构想" value={projectDraft.premise} multiline onChange={(premise) => setProjectDraft({ ...projectDraft, premise })} /><Field label="写作规则 / 风格指南" value={projectDraft.styleGuide} multiline onChange={(styleGuide) => setProjectDraft({ ...projectDraft, styleGuide })} /></div>}
            <div className="outline-grid">
              <div className="outline-tree">
                {workspace.outline.map((node) => <div key={node.id} className={`outline-node depth-${node.type}`}><span className={`node-type ${node.type}`}>{node.type === "volume" ? "卷" : node.type === "chapter" ? "章" : "场"}</span><div><h3>{node.title}</h3><p>{node.summary}</p></div><span className="status-pill">{node.status}</span></div>)}
              </div>
              <div className="inline-ai-card"><Sparkles size={20} /><h3>自然语言构思</h3><textarea value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder="例如：在第一卷末尾安排一次错误胜利，并埋下陈叔身份反转的线索……" /><button className="primary-button full" onClick={() => { setAiAction("outline"); void callAi(); }} disabled={busy || !aiInstruction.trim()}>生成结构化大纲</button>{proposal && <ProposalCard proposal={proposal} onApply={() => void applyProposal()} onClose={() => setProposal(null)} />}</div>
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
      {newProjectOpen && <div className="modal-backdrop" onMouseDown={() => setNewProjectOpen(false)}><section className="settings-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW PROJECT</span><h2>新建作品</h2></div><button className="icon-button" aria-label="关闭新建作品" onClick={() => setNewProjectOpen(false)}><X size={19} /></button></div><label className="field"><span>作品名称</span><input autoFocus value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newProjectTitle.trim()) void createNewProject(); }} placeholder="例如：雾港来信" /></label><p className="modal-help">新作品会自动建立“第一章”，并与现有作品的数据完全分开。</p><button className="primary-button full" disabled={!newProjectTitle.trim() || busy} onClick={() => void createNewProject()}><CirclePlus size={17} />创建作品</button></section></div>}
    </main>
  );
}

function ContentPage({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</div>;
}

function ProposalCard({ proposal, onApply, onClose }: { proposal: AiProposal; onApply: () => void; onClose: () => void }) {
  return <div className="proposal-card"><div className="proposal-head"><strong>AI 提案</strong><button onClick={onClose}><X size={15} /></button></div>{proposal.type === "text" ? <p>{proposal.result.slice(0, 900)}{proposal.result.length > 900 ? "…" : ""}</p> : <div><p>{proposal.proposal.rationale}</p>{proposal.proposal.nodes.map((node, index) => <div className="proposal-node" key={`${node.title}-${index}`}><span>{node.type}</span><strong>{node.title}</strong><small>{node.summary}</small></div>)}</div>}<button className="accept-button" onClick={onApply}><Check size={16} />接受并写入</button></div>;
}

function Field({ label, value, onChange, multiline, options }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; options?: Array<{ label: string; value: string }> }) {
  return <label className="field"><span>{label}</span>{options ? <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>;
}
