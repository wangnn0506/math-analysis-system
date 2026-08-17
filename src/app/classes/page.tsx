import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { listClassesWithCounts } from "@/lib/store";
import { createClassAction, updateClassAction } from "./actions";

export const metadata: Metadata = { title: "班级管理" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [classes, params] = await Promise.all([
    listClassesWithCounts(),
    searchParams,
  ]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="学生管理"
        title="班级管理"
        description="先创建班级，再手动添加学生或从 Excel 名单批量导入。"
      />
      <Notice type="success" message={params.success} />
      <Notice type="error" message={params.error} />

      <section className="panel form-panel">
        <form action={createClassAction} className="class-create-form">
          <label>
            <span>年级 *</span>
            <select name="grade" required defaultValue="">
              <option value="" disabled>
                请选择年级
              </option>
              <option value="高一">高一</option>
              <option value="高二">高二</option>
              <option value="高三">高三</option>
            </select>
          </label>
          <label>
            <span>班级 *</span>
            <input name="classNo" type="number" required min={1} max={25} step={1} />
          </label>
          <button className="button button-primary" type="submit">
            创建班级
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>已有班级</h2>
            <p>共 {classes.length} 个班级</p>
          </div>
          <Link href="/students" className="button button-secondary button-small">
            查看全部学生
          </Link>
        </div>
        {classes.length === 0 ? (
          <EmptyState
            icon="班"
            title="还没有班级"
            description="先创建一个班级，再导入或添加学生。"
          />
        ) : (
          <div className="class-list">
            {classes.map((classGroup) => (
              <article className="class-row" key={classGroup.id}>
                <div className="class-identity">
                  <span className="class-avatar">班</span>
                  <div>
                    <strong>{classGroup.name}</strong>
                    <small>{classGroup.studentCount} 名学生</small>
                  </div>
                </div>
                <form action={updateClassAction} className="class-edit-form">
                  <input type="hidden" name="id" value={classGroup.id} />
                  <label>
                    <span>班级名称</span>
                    <input name="name" defaultValue={classGroup.name} maxLength={100} required />
                  </label>
                  <button className="button button-secondary button-small" type="submit">
                    保存
                  </button>
                </form>
                <div className="class-actions">
                  <Link href={`/students?classId=${encodeURIComponent(classGroup.id)}`}>
                    查看学生
                  </Link>
                  <Link href={`/students?classId=${encodeURIComponent(classGroup.id)}#batch-import`}>
                    导入名单
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
