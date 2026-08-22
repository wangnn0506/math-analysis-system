import type { Metadata } from "next";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";

export const metadata: Metadata = { title: "成绩分析" };
export const dynamic = "force-dynamic";

export default async function ParentScoresPage() {
  const session = await requireParentSession();
  return (
    <div className="parent-page">
      <ParentHeader student={session.student} />
      <section className="parent-section-card parent-list-page-header">
        <p className="parent-auth-eyebrow">成绩分析</p>
        <h1>成绩趋势</h1>
        <p>成绩录入功能暂未开放，接入考试数据后会在这里显示趋势。</p>
      </section>
      <div className="parent-empty-panel">暂时没有可分析的考试成绩。</div>
      <ParentNavigation active="reports" />
    </div>
  );
}
