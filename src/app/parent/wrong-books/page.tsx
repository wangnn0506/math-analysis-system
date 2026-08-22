import type { Metadata } from "next";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";
import { listWrongBooksForStudent } from "@/lib/store";

export const metadata: Metadata = { title: "错题本" };
export const dynamic = "force-dynamic";

export default async function ParentWrongBooksPage() {
  const session = await requireParentSession();
  const wrongBooks = await listWrongBooksForStudent(session.student.id);
  return (
    <div className="parent-page">
      <ParentHeader student={session.student} />
      <section className="parent-section-card parent-list-page-header">
        <p className="parent-auth-eyebrow">错题中心</p>
        <h1>错题本</h1>
        <p>教师整理的错题会在这里汇总，点击即可下载练习文档。</p>
      </section>
      <section className="parent-simple-list parent-large-list">
        {wrongBooks.length === 0 ? (
          <div className="parent-empty-state">暂时还没有错题本。</div>
        ) : (
          wrongBooks.map((item) => (
            <a href={`/api/parent/wrong-books/${item.id}`} key={item.id}>
              <span className="parent-list-icon">错</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.questionNumbers.length} 道题 · 点击下载 Word</small>
              </span>
              <span className="parent-list-arrow">↓</span>
            </a>
          ))
        )}
      </section>
      <ParentNavigation active="wrong-books" />
    </div>
  );
}
