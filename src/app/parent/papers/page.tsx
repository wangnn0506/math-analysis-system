import type { Metadata } from "next";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";
import { listCuratedPapers } from "@/lib/store";

export const metadata: Metadata = { title: "精品试卷" };
export const dynamic = "force-dynamic";

export default async function ParentPapersPage() {
  const session = await requireParentSession();
  const papers = await listCuratedPapers({ publishedOnly: true });
  return (
    <div className="parent-page">
      <ParentHeader student={session.student} />
      <section className="parent-section-card parent-list-page-header">
        <p className="parent-auth-eyebrow">学习资源</p>
        <h1>精品试卷</h1>
        <p>教师精选的练习资料会集中展示在这里。</p>
      </section>
      <section className="parent-paper-grid">
        {papers.length === 0 ? (
          <div className="parent-empty-panel">老师还没有发布精选试卷。</div>
        ) : (
          papers.map((paper) => (
            <a key={paper.id} className="parent-paper-card" href={`/api/parent/papers/${paper.id}`}>
              <span className="parent-feature-icon feature-purple">卷</span>
              <div>
                <strong>{paper.title}</strong>
                <small>{paper.grade} · {paper.subject}</small>
                {paper.description ? <p>{paper.description}</p> : null}
              </div>
            </a>
          ))
        )}
      </section>
      <ParentNavigation active="home" />
    </div>
  );
}
