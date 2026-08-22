import type { Metadata } from "next";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";

export const metadata: Metadata = { title: "学情报告" };
export const dynamic = "force-dynamic";

export default async function ParentReportsPage() {
  const session = await requireParentSession();
  return (
    <div className="parent-page">
      <ParentHeader student={session.student} />
      <section className="parent-report-hero">
        <p className="parent-auth-eyebrow">学情报告</p>
        <h1>让每一道错题都变成进步线索</h1>
        <p>后续将综合成绩、知识点和错题记录，生成易懂的学习观察。</p>
      </section>
      <section className="parent-placeholder-grid">
        <article>
          <span>01</span>
          <strong>知识点掌握</strong>
          <p>识别薄弱知识点和反复出错的题型。</p>
        </article>
        <article>
          <span>02</span>
          <strong>错题变化</strong>
          <p>观察错题数量、订正情况和近期变化。</p>
        </article>
        <article>
          <span>03</span>
          <strong>下一步建议</strong>
          <p>根据真实数据生成家长容易理解的建议。</p>
        </article>
      </section>
      <p className="parent-coming-soon">成绩和知识点数据接入后，这里会自动生成报告。</p>
      <ParentNavigation active="reports" />
    </div>
  );
}
