import type { Metadata } from "next";
import Link from "next/link";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";
import { listCuratedPapers, listWrongBooksForStudent } from "@/lib/store";

export const metadata: Metadata = { title: "家长首页" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string }>;

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireParentSession();
  const [wrongBooks, papers, params] = await Promise.all([
    listWrongBooksForStudent(session.student.id),
    listCuratedPapers({ publishedOnly: true }),
    searchParams,
  ]);
  return (
    <div className="parent-page">
      <ParentHeader student={session.student} />
      {params.success ? <p className="parent-message success-text">{params.success}</p> : null}
      <section className="parent-welcome-card">
        <div>
          <p className="parent-auth-eyebrow">你好，{session.student.name}</p>
          <h1>今天也一起把错题弄懂</h1>
          <p>从错题开始，慢慢看见学习进步。</p>
        </div>
        <span className="parent-welcome-mark">拾</span>
      </section>

      <section className="parent-feature-grid" aria-label="核心功能">
        <Link className="parent-feature-card feature-green" href="/parent/wrong-books">
          <span className="parent-feature-icon">错</span>
          <strong>错题本</strong>
          <small>{wrongBooks.length} 份整理记录</small>
        </Link>
        <Link className="parent-feature-card feature-blue" href="/parent/reports">
          <span className="parent-feature-icon">学</span>
          <strong>学情报告</strong>
          <small>知识点与错题综合观察</small>
        </Link>
        <Link className="parent-feature-card feature-orange" href="/parent/scores">
          <span className="parent-feature-icon">分</span>
          <strong>成绩分析</strong>
          <small>考试成绩趋势</small>
        </Link>
        <Link className="parent-feature-card feature-purple" href="/parent/papers">
          <span className="parent-feature-icon">卷</span>
          <strong>精品试卷</strong>
          <small>{papers.length} 份精选内容</small>
        </Link>
      </section>

      <section className="parent-section-card">
        <div className="parent-section-heading">
          <div>
            <h2>最近错题</h2>
            <p>教师为你整理的学习材料</p>
          </div>
          <Link href="/parent/wrong-books">查看全部</Link>
        </div>
        {wrongBooks.length === 0 ? (
          <div className="parent-empty-state">还没有错题整理记录。</div>
        ) : (
          <div className="parent-simple-list">
            {wrongBooks.slice(0, 3).map((item) => (
              <a href={`/api/parent/wrong-books/${item.id}`} key={item.id}>
                <span className="parent-list-icon">错</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.questionNumbers.length} 道题</small>
                </span>
                <span className="parent-list-arrow">↓</span>
              </a>
            ))}
          </div>
        )}
      </section>
      <ParentNavigation active="home" />
    </div>
  );
}
