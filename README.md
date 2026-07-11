# Story Studio

一个本地优先、可切换大模型的开源长篇写作工作台。

Story Studio 用结构化数据管理作品大纲、章节、人物关系、世界观和事件因果链。AI 是可替换的编辑助手：它生成提案，作者确认后才写入正式稿，并留下版本记录。

## 已实现功能

- 卷 / 章 / 场景三级大纲，支持自然语言生成结构化大纲提案
- 大纲优先工作流：每个节点可手动编辑或单独生成 AI 修改提案
- 大纲变更追踪：关联正文自动标记为“待同步”，可按新大纲重写
- 同时管理多个作品，并在顶部快速新建和切换
- 章节编辑、摘要、字数统计和版本历史
- 为章节上传 JPG、PNG 或 WebP 插画
- 人物目标、恐惧、秘密、口吻与人物关系
- 世界观条目与不可随意改变的“硬设定”
- 故事事件、原因和后果时间线
- 不依赖模型的本地逻辑链证据查询
- OpenAI Responses API 接入
- OpenAI-compatible 本地模型接入
- SQLite 本地持久化；首次运行附带一个示例项目
- A4 打印级 PDF（通过系统打印窗口保存）和 Markdown 导出
- 响应式中文管理界面

## 快速开始

要求：Node.js 22 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。不配置模型也能使用所有管理和本地逻辑查询功能。

SQLite 数据默认保存在 `data/story-studio.db`。该目录被 Git 忽略。可通过 `STORY_STUDIO_DATA_DIR` 改到其他位置。

## 导出与插画

在章节编辑器底部点击“添加图片”，即可把插画加入当前章节。图片保存在本地数据目录，不会上传到第三方服务。

右上角“导出”提供两种格式：

- **PDF / 打印稿**：打开 A4 排版预览，包含封面、已有正文的章节和插画；点击“打印 / 保存为 PDF”后，在系统打印窗口选择“另存为 PDF”。空白的计划章节不会占用页面。
- **Markdown 原稿**：适合备份、Git 版本管理或迁移到其他写作工具。

## 配置模型

### OpenAI

在 `.env.local` 中配置：

```dotenv
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.4-mini
```

界面右上角“模型设置”选择 OpenAI。项目使用 Responses API；结构化大纲使用严格 JSON Schema 输出。

### 本地模型

任何实现 OpenAI Chat Completions 兼容接口的服务均可接入：

```dotenv
LOCAL_MODEL_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_MODEL=qwen3:8b
LOCAL_MODEL_API_KEY=local
```

然后在界面中选择“本地 / OpenAI-compatible”。不同本地服务对 JSON 输出的遵循程度不同，大纲解析失败时请换用指令遵循更好的模型。

## 推荐写作流程

1. 在“大纲”页填写作品基石，并构思卷、章、场景。
2. 点击任一节点，在右侧手动修改，或只让 AI 修改这个节点。
   - 选中卷：可在卷内添加章，或在其后插入新卷。
   - 选中章：可在章内添加场景，或在其后插入新章。
   - 选中场景：可在其后插入新场景。
   - “添加卷”按钮始终位于大纲树顶部。
3. 对“章”节点点击“进入本章写作”，再选择“按大纲扩写”。
4. 如果之后修改了该章大纲，已有正文会显示“正文基于旧大纲”。可以让 AI 按新大纲重写，也可以手动调整后标记为已同步。

AI 的整体大纲和单节点修改都只生成提案，作者接受后才写入数据库。

删除卷、章或场景前，界面会列出将删除的大纲节点数、关联章节数、已有正文数量和总字数。删除卷会级联删除卷内的章与场景；删除章也会删除对应正文和插画。

## Docker

```bash
docker build -t story-studio .
docker run --rm -p 3000:3000 -v story-studio-data:/app/data --env-file .env.local story-studio
```

## 数据与 AI 的边界

```text
SQLite（唯一真相来源）
  ├─ 大纲 / 章节 / 人物 / 世界观 / 事件链
  ├─ 本地证据检索
  └─ 上下文组装器
          ↓
   模型适配层
     ├─ OpenAI Responses API
     └─ OpenAI-compatible Chat Completions
          ↓
      修改提案 → 作者确认 → 版本记录 → 正式稿
```

API Key 只由 Next.js 服务端读取。浏览器只保存模型名称、提供方和本地 Base URL。

## 开发

```bash
npm run lint
npm run test
npm run build
```

主要目录：

```text
src/app/api/       本地 API
src/components/    管理界面
src/lib/db.ts      SQLite 模式与数据访问
src/lib/context.ts AI 上下文组装
src/lib/models.ts  模型适配层
```

## 路线图

- 可视化人物关系图
- 手动编辑和拖放大纲
- 精细段落 diff 与逐项接受
- 事件知情状态和矛盾检测
- Markdown / DOCX 导入导出
- Embedding 混合检索
- Google Docs / NotebookLM Enterprise 可选同步适配器
- 插件式模型提供方

## 开源许可

[MIT](LICENSE)
