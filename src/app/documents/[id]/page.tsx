import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PaperSelector } from "@/components/paper-selector";
import { getDocumentWithQuestions, listStudents } from "@/lib/store";
import { formatDate } from "@/lib/text";
import {
  addQuestionAction,
  deleteQuestionAction,
  updateQuestionAction,
} from "../actions";

export const dynamic = "force-dynamic";

const visibleWarnings = (warnings: string[]) =>
  warnings.filter((warning) => !warning.startsWith("检测到图片型试卷"));

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getDocumentWithQuestions(id);
  return { title: data?.document.title ?? "试卷预览" };
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  const [data, students] = await Promise.all([
    getDocumentWithQuestions(id),
    listStudents(),
  ]);
  if (!data) notFound();
  const isPageImageDocument =
    data.document.processingMode === "page-images" &&
    (data.document.pages?.length ?? 0) > 0;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link href="/documents">试卷文档</Link>
        <span>/</span>
        <span>{data.document.title}</span>
      </div>
      <PageHeader
        eyebrow={isPageImageDocument ? "原卷选题" : "拆题预览"}
        title={data.document.title}
        description={
          "已识别 " +
          data.questions.length +
          " 道题 · 上传于 " +
          formatDate(data.document.createdAt) +
          (isPageImageDocument
            ? "。题干、公式和图形均保留为原试卷图片，点击题号旁按钮即可加入错题。"
            : "。请先核对题号和内容，再生成错题集。")
        }
        actions={!isPageImageDocument ? (
          <Link className="button button-primary" href="/wrong-books">
            使用这份试卷生成错题集
          </Link>
        ) : undefined}
      />
      <Notice type="success" message={messages.success} />
      <Notice type="error" message={messages.error} />
      {visibleWarnings(data.document.extractionWarnings).map((warning) => (
        <Notice key={warning} type="warning" message={warning} />
      ))}

      {isPageImageDocument ? (
        <PaperSelector
          documentId={data.document.id}
          documentTitle={data.document.title}
          pages={(data.document.pages ?? []).map((page, index) => ({
            pageNumber: index + 1,
            width: page.width,
            height: page.height,
            imageUrl:
              "/api/documents/" + data.document.id + "/pages/" + (index + 1),
          }))}
          questions={data.questions}
          students={students}
        />
      ) : (
      <div className="question-layout">
        <section className="questions-column">
          <div className="section-heading sticky-heading">
            <div>
              <h2>识别结果</h2>
              <p>每张卡片对应一道题，修改后单独保存。</p>
            </div>
            <span className="count-pill">{data.questions.length} 题</span>
          </div>
          {data.questions.map((question) => (
            <article className="question-card" key={question.id}>
              <form action={updateQuestionAction}>
                <input
                  type="hidden"
                  name="documentId"
                  value={data.document.id}
                />
                <input type="hidden" name="id" value={question.id} />
                <div className="question-card-header">
                  <label>
                    <span>题号</span>
                    <input
                      className="question-number-input"
                      name="number"
                      defaultValue={question.number}
                      maxLength={32}
                      required
                    />
                  </label>
                  <button className="button button-secondary button-small">
                    保存修改
                  </button>
                </div>
                <label className="question-content-label">
                  <span>题目内容</span>
                  <textarea
                    name="content"
                    defaultValue={question.content}
                    maxLength={100000}
                    required
                    rows={Math.min(
                      14,
                      Math.max(4, question.content.split("\n").length + 2),
                    )}
                  />
                </label>
              </form>
              <form action={deleteQuestionAction} className="delete-question-form">
                <input
                  type="hidden"
                  name="documentId"
                  value={data.document.id}
                />
                <input type="hidden" name="id" value={question.id} />
                <button className="text-button danger">删除这道题</button>
              </form>
            </article>
          ))}
        </section>

        <aside className="add-question-card">
          <p className="eyebrow">人工补充</p>
          <h2>添加漏识别题目</h2>
          <p>如果文档中的某道题没有被识别，可以在这里补充。</p>
          <form action={addQuestionAction}>
            <input type="hidden" name="documentId" value={data.document.id} />
            <label>
              <span>题号 *</span>
              <input name="number" required maxLength={32} placeholder="例如：12" />
            </label>
            <label>
              <span>题目内容 *</span>
              <textarea
                name="content"
                required
                maxLength={100000}
                rows={8}
                placeholder="粘贴或输入题目正文"
              />
            </label>
            <button className="button button-primary button-full">
              添加题目
            </button>
          </form>
          <div className="tip-box">
            <strong>识别提示</strong>
            <p>
              题号单独占行、使用“1.”“2、”或“第3题”等形式，自动拆分效果最好。
            </p>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
