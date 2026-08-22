import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { listCuratedPapers, listDocuments } from "@/lib/store";
import { createCuratedPaperAction } from "./actions";

export const metadata: Metadata = { title: "精选试卷" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function CuratedPapersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [papers, documents, params] = await Promise.all([
    listCuratedPapers(),
    listDocuments(),
    searchParams,
  ]);
  return (
    <div className="page">
      <PageHeader
        eyebrow="资源管理"
        title="精选试卷"
        description="从已上传的试卷中挑选适合学生练习的内容，发布到家长端。"
      />
      <Notice type="success" message={params.success} />
      <Notice type="error" message={params.error} />
      <section className="panel form-panel">
        <div className="section-heading">
          <div>
            <h2>发布精选试卷</h2>
            <p>先上传试卷，再补充面向家长展示的分类信息。</p>
          </div>
        </div>
        {documents.length === 0 ? (
          <EmptyState icon="卷" title="还没有可选试卷" description="请先在试卷文档中上传文件。" />
        ) : (
          <form action={createCuratedPaperAction} className="curated-paper-form">
            <label>
              <span>关联试卷 *</span>
              <select name="documentId" required defaultValue="">
                <option value="" disabled>请选择已上传试卷</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>{document.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>展示标题 *</span>
              <input name="title" required maxLength={150} />
            </label>
            <label>
              <span>学科 *</span>
              <input name="subject" required maxLength={50} defaultValue="数学" />
            </label>
            <label>
              <span>年级 *</span>
              <input name="grade" required maxLength={30} />
            </label>
            <label className="curated-paper-description">
              <span>试卷说明</span>
              <textarea name="description" maxLength={500} rows={2} />
            </label>
            <button className="button button-primary" type="submit">发布到家长端</button>
          </form>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>已发布试卷</h2>
            <p>家长端当前可见 {papers.filter((paper) => paper.published).length} 份</p>
          </div>
        </div>
        {papers.length === 0 ? (
          <EmptyState icon="精" title="还没有精选试卷" description="发布后会显示在这里。" />
        ) : (
          <div className="curated-paper-list">
            {papers.map((paper) => (
              <article className="curated-paper-row" key={paper.id}>
                <span className="curated-paper-mark">卷</span>
                <div>
                  <strong>{paper.title}</strong>
                  <small>{paper.grade} · {paper.subject}{paper.published ? " · 已发布" : " · 草稿"}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
