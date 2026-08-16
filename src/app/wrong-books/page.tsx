import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  listDocuments,
  listStudents,
  listWrongBooks,
} from "@/lib/store";
import { formatDate } from "@/lib/text";

export const metadata: Metadata = { title: "生成错题集" };
export const dynamic = "force-dynamic";

export default async function WrongBooksPage() {
  const [students, documents, wrongBooks] = await Promise.all([
    listStudents(),
    listDocuments(),
    listWrongBooks(),
  ]);
  const canGenerate = students.length > 0 && documents.length > 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="错题整理"
        title="生成学生错题集"
        description="图片型试卷可在原卷预览中直接勾选；这里仍可通过输入题号批量生成 Word。"
      />

      <section className="generator-card">
        <div className="generator-intro">
          <span className="generator-icon">集</span>
          <div>
            <h2>新建错题集</h2>
            <p>题号可用空格、逗号或顿号分隔，例如：2, 5, 8, 12。</p>
          </div>
        </div>
        {!canGenerate ? (
          <div className="prerequisite-list">
            <div className={students.length > 0 ? "done" : ""}>
              <span>{students.length > 0 ? "✓" : "1"}</span>
              <p>
                <strong>添加学生</strong>
                <small>
                  {students.length > 0
                    ? "已完成，共 " + students.length + " 人"
                    : "先到学生名单添加学生"}
                </small>
              </p>
            </div>
            <div className={documents.length > 0 ? "done" : ""}>
              <span>{documents.length > 0 ? "✓" : "2"}</span>
              <p>
                <strong>上传试卷</strong>
                <small>
                  {documents.length > 0
                    ? "已完成，共 " + documents.length + " 份"
                    : "上传并核对至少一份试卷"}
                </small>
              </p>
            </div>
          </div>
        ) : (
          <form
            action="/api/wrong-books"
            method="post"
            className="generator-form"
          >
            <div className="generator-form-grid">
              <label>
                <span>选择学生 *</span>
                <select name="studentId" required defaultValue="">
                  <option value="" disabled>
                    请选择学生
                  </option>
                  {students.map((student) => (
                    <option value={student.id} key={student.id}>
                      {student.name} · {student.studentNo}
                      {student.className ? " · " + student.className : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>选择试卷 *</span>
                <select name="documentId" required defaultValue="">
                  <option value="" disabled>
                    请选择试卷
                  </option>
                  {documents.map((document) => (
                    <option value={document.id} key={document.id}>
                      {document.title}（{document.questionCount} 题）
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>错误题号 *</span>
              <input
                name="questionNumbers"
                required
                maxLength={2000}
                placeholder="例如：2, 5, 8, 12"
                className="large-input"
              />
              <small>
                必须与试卷预览中的题号一致，可使用空格、逗号或顿号分隔。
              </small>
            </label>
            <p className="auto-document-title">
              文档名称将自动使用：试卷名称 · 学生姓名 · 班级 · 学号
            </p>
            <button className="button button-primary button-large" type="submit">
              生成并下载 Word 文档
            </button>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>生成记录</h2>
            <p>可以重新下载已生成的错题集。</p>
          </div>
          <span className="count-pill">{wrongBooks.length} 份</span>
        </div>
        {wrongBooks.length === 0 ? (
          <EmptyState
            icon="W"
            title="暂无生成记录"
            description="完成上面的表单后，生成记录会保存在这里。"
          />
        ) : (
          <div className="history-list">
            {wrongBooks.map((item) => (
              <article key={item.id}>
                <span className="history-icon">W</span>
                <div className="history-main">
                  <strong>{item.title}</strong>
                  <p>
                    {item.student?.name} · {item.document?.title}
                  </p>
                  <small>
                    题号 {item.questionNumbers.join("、")} ·{" "}
                    {formatDate(item.createdAt)}
                  </small>
                </div>
                <a
                  className="button button-secondary button-small"
                  href={"/api/wrong-books/" + item.id}
                >
                  重新下载
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
