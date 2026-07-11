export type Project = {
  id: string;
  title: string;
  genre: string;
  premise: string;
  styleGuide: string;
  createdAt: string;
  updatedAt: string;
};

export type OutlineNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  type: "volume" | "chapter" | "scene";
  title: string;
  summary: string;
  position: number;
  status: string;
};

export type Chapter = {
  id: string;
  projectId: string;
  outlineNodeId: string | null;
  title: string;
  content: string;
  summary: string;
  status: string;
  position: number;
  wordCount: number;
  updatedAt: string;
};

export type Character = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  description: string;
  goal: string;
  fear: string;
  secret: string;
  voice: string;
  status: string;
};

export type Relationship = {
  id: string;
  projectId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  sourceName: string;
  targetName: string;
  type: string;
  description: string;
};

export type WorldEntry = {
  id: string;
  projectId: string;
  category: string;
  name: string;
  description: string;
  isCanon: boolean;
};

export type StoryEvent = {
  id: string;
  projectId: string;
  chapterId: string | null;
  chapterTitle: string | null;
  title: string;
  storyTime: string;
  description: string;
  causes: string;
  consequences: string;
};

export type Revision = {
  id: string;
  entityType: string;
  entityId: string;
  beforeContent: string;
  afterContent: string;
  instruction: string;
  createdAt: string;
};

export type Illustration = {
  id: string;
  projectId: string;
  chapterId: string;
  fileName: string;
  mimeType: string;
  caption: string;
  position: number;
  createdAt: string;
};

export type Workspace = {
  projects: Project[];
  project: Project;
  outline: OutlineNode[];
  chapters: Chapter[];
  characters: Character[];
  relationships: Relationship[];
  worldEntries: WorldEntry[];
  events: StoryEvent[];
  illustrations: Illustration[];
  revisions: Revision[];
};

export type ModelSettings = {
  provider: "openai" | "openai-compatible";
  model: string;
  baseUrl?: string;
};
