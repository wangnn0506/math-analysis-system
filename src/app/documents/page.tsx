import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { UploadSubmitButton } from "@/components/upload-submit-button";
import { listDocuments } from "@/lib/store";
import { formatDate } from "@/lib/text";
import { deleteDocumentAction } from "./actions";

const visibleWarnings = (warnings: string[]) =>
  warnings.filter((warning) => !warning.startsWith("检测到图片型试卷"));

export const metadata: Metadata = { title: "试卷管理" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string;
  error?: string;
}>;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [documents, params] = await Promise.all([listDocuments(), searchParams]);

  return (
    <div className="page">
      <header className="page-header page-header-label-only">
        <p className="eyebrow">试卷管理</p>
      </header>
      <Notice type="success" message={params.success} />
      <Notice type="error" message={params.error} />

      <section className="upload-panel upload-panel-form-only">
        <form
          action="/api/documents"
          method="post"
          encType="multipart/form-data"
          className="upload-form"
        >
          <label>
            <span>试卷名称</span>
            <input name="title" maxLength={150} placeholder="留空则使用文件名" />
          </label>
          <label className="file-picker">
            <input
              name="file"
              type="file"
              aria-label="上传试卷文件"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
            />
          </label>
          <UploadSubmitButton />
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>已上传试卷</h2>
            <p>共 {documents.length} 份</p>
          </div>
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon="卷"
            title="还没有试卷"
            description="使用上方上传区域添加第一份试卷文档。"
          />
        ) : (
          <div className="document-grid">
            {documents.map((document) => (
              <article className="document-card" key={document.id}>
                <div className="document-card-top">
                  <span className="document-type">
                    {document.originalFilename.toLowerCase().endsWith(".pdf")
                      ? "PDF"
                      : "DOCX"}
                  </span>
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <button className="icon-button danger" title="删除试卷">
                      ×
                    </button>
                  </form>
                </div>
                <Link href={"/documents/" + document.id}>
                  <h3>{document.title}</h3>
                  <p>{document.originalFilename}</p>
                  <div className="document-meta">
                    <span>{document.questionCount} 道题</span>
                    <span>{formatDate(document.createdAt)}</span>
                  </div>
                  {visibleWarnings(document.extractionWarnings).length > 0 ? (
                    <span className="warning-pill">
                      {visibleWarnings(document.extractionWarnings).length} 项待核对
                    </span>
                  ) : (
                    <span className="ready-pill">识别完成</span>
                  )}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
