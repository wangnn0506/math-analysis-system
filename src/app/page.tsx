import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  getDashboardStats,
  listDocuments,
  listWrongBooks,
} from "@/lib/store";
import { formatDate } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, documents, wrongBooks] = await Promise.all([
    getDashboardStats(),
    listDocuments(),
    listWrongBooks(),
  ]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="教师工作台"
        title="把试卷里的错题，变成学生的专属练习"
        description="上传一次试卷，识别题号；以后只需选择学生并输入错题号，就能生成可编辑、可打印的 Word 错题集。"
        actions={
          <Link className="button button-primary" href="/wrong-books">
            ＋ 生成错题集
          </Link>
        }
      />

      <section className="stats-grid" aria-label="数据概览">
        <article className="stat-card stat-indigo">
          <span className="stat-icon">人</span>
          <div>
            <strong>{stats.students}</strong>
            <span>名学生</span>
          </div>
        </article>
        <article className="stat-card stat-teal">
          <span className="stat-icon">卷</span>
          <div>
            <strong>{stats.documents}</strong>
            <span>份试卷</span>
          </div>
        </article>
        <article className="stat-card stat-amber">
          <span className="stat-icon">题</span>
          <div>
            <strong>{stats.questions}</strong>
            <span>道已识别题目</span>
          </div>
        </article>
        <article className="stat-card stat-rose">
          <span className="stat-icon">集</span>
          <div>
            <strong>{stats.wrongBooks}</strong>
            <span>份错题集</span>
          </div>
        </article>
      </section>

      <section className="workflow-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">三步完成</p>
            <h2>最短使用路径</h2>
          </div>
        </div>
        <div className="workflow">
          <Link href="/students" className="workflow-step">
            <span>01</span>
            <div>
              <strong>建立学生名单</strong>
              <p>录入学号、姓名和班级</p>
            </div>
          </Link>
          <div className="workflow-arrow" aria-hidden="true">
            →
          </div>
          <Link href="/documents" className="workflow-step">
            <span>02</span>
            <div>
              <strong>上传并检查试卷</strong>
              <p>自动识别题号，人工确认内容</p>
            </div>
          </Link>
          <div className="workflow-arrow" aria-hidden="true">
            →
          </div>
          <Link href="/wrong-books" className="workflow-step">
            <span>03</span>
            <div>
              <strong>输入错题号</strong>
              <p>一键下载学生专属 Word</p>
            </div>
          </Link>
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>最近试卷</h2>
            <Link href="/documents">查看全部 →</Link>
          </div>
          {documents.length === 0 ? (
            <EmptyState
              icon="卷"
              title="还没有试卷"
              description="上传第一份 PDF 或 DOCX，系统会自动识别题号。"
              actionHref="/documents"
              actionLabel="上传试卷"
            />
          ) : (
            <div className="compact-list">
              {documents.slice(0, 4).map((document) => (
                <Link href={"/documents/" + document.id} key={document.id}>
                  <span className="list-avatar">卷</span>
                  <span className="list-main">
                    <strong>{document.title}</strong>
                    <small>{formatDate(document.createdAt)}</small>
                  </span>
                  <span className="count-pill">{document.questionCount} 题</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>最近生成</h2>
            <Link href="/wrong-books">查看全部 →</Link>
          </div>
          {wrongBooks.length === 0 ? (
            <EmptyState
              icon="集"
              title="还没有错题集"
              description="学生和试卷准备好后，就可以生成第一份错题集。"
            />
          ) : (
            <div className="compact-list">
              {wrongBooks.slice(0, 4).map((item) => (
                <a href={"/api/wrong-books/" + item.id} key={item.id}>
                  <span className="list-avatar list-avatar-green">W</span>
                  <span className="list-main">
                    <strong>{item.title}</strong>
                    <small>
                      {item.student?.name} · {formatDate(item.createdAt)}
                    </small>
                  </span>
                  <span className="download-mark">↓</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
