import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Studio — 本地 AI 写作工作台",
  description: "管理小说大纲、章节、人物关系、世界观与逻辑链的开源本地工具。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
