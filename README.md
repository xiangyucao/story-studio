# Story Studio

一个本地优先、可切换大模型的开源长篇写作工作台。

Story Studio 用结构化数据管理作品大纲、章节、人物关系、世界观和事件因果链。AI 是可替换的编辑助手：它生成提案，作者确认后才写入正式稿，并留下版本记录。

## 已实现功能

- 卷 / 章 / 场景三级大纲，支持自然语言生成结构化大纲提案
- 章节编辑、摘要、字数统计和版本历史
- 人物目标、恐惧、秘密、口吻与人物关系
- 世界观条目与不可随意改变的“硬设定”
- 故事事件、原因和后果时间线
- 不依赖模型的本地逻辑链证据查询
- OpenAI Responses API 接入
- OpenAI-compatible 本地模型接入
- SQLite 本地持久化；首次运行附带一个示例项目
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
