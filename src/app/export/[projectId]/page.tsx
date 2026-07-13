/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import { getWorkspace } from "@/lib/db";
import { groupChaptersByVolume } from "@/lib/manuscript";
import { PrintActions } from "./print-button";
import styles from "./print.module.css";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const workspace = getWorkspace(projectId);
  const safeTitle = workspace.project.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "") || "未命名作品";
  return { title: safeTitle };
}

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const workspace = getWorkspace(projectId);
  const groups = groupChaptersByVolume(workspace).map((group) => ({
    ...group,
    chapters: group.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)),
  })).filter((group) => group.chapters.length);
  return <main className={styles.exportPage}>
    <PrintActions />
    <article className={styles.book}>
      <section className={styles.cover}>
        <span>STORY STUDIO MANUSCRIPT</span>
        <h1>{workspace.project.title}</h1>
        {workspace.project.genre && <p className={styles.genre}>{workspace.project.genre}</p>}
        {workspace.project.premise && <p className={styles.premise}>{workspace.project.premise}</p>}
      </section>
      {groups.map((group, groupIndex) => <Fragment key={group.volume?.id || "unfiled"}>
        <section className={styles.cover}>
          <span>{group.volume ? `VOLUME ${groupIndex + 1}` : "APPENDIX"}</span>
          <h1>{group.volume?.title || "未归档章节"}</h1>
          {group.volume?.summary && <p className={styles.premise}>{group.volume.summary}</p>}
        </section>
        {group.chapters.map((chapter) => {
          const illustrations = workspace.illustrations.filter((image) => image.chapterId === chapter.id);
          return <section className={styles.chapter} key={chapter.id}>
            <header><span>CHAPTER {chapter.position + 1}</span><h2>{chapter.title}</h2></header>
            <div className={styles.prose}>{chapter.content.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {illustrations.map((image) => <figure key={image.id}><img src={`/api/assets/${image.id}`} alt={image.caption || image.fileName} />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}
          </section>;
        })}
      </Fragment>)}
      <footer className={styles.colophon}>由 Story Studio 导出 · {new Date().toLocaleDateString("zh-CN")}</footer>
    </article>
  </main>;
}
