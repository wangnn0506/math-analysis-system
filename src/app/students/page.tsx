import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { listStudents } from "@/lib/store";
import {
  createStudentAction,
  deleteStudentAction,
  updateStudentAction,
} from "./actions";

export const metadata: Metadata = { title: "学生名单" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string;
  error?: string;
}>;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [students, params] = await Promise.all([listStudents(), searchParams]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="学生管理"
        title="学生名单"
        description="学号用于稳定匹配学生，姓名和班级会显示在生成的错题文档中。"
      />
      <Notice type="success" message={params.success} />
      <Notice type="error" message={params.error} />

      <section className="panel form-panel">
        <div className="section-heading">
          <div>
            <h2>添加学生</h2>
            <p>先录入基本信息，之后可随时修改。</p>
          </div>
        </div>
        <form action={createStudentAction} className="student-create-form">
          <label>
            <span>学号 *</span>
            <input name="studentNo" required maxLength={64} placeholder="例如：2026001" />
          </label>
          <label>
            <span>姓名 *</span>
            <input name="name" required maxLength={100} placeholder="学生姓名" />
          </label>
          <label>
            <span>班级</span>
            <input name="className" maxLength={100} placeholder="例如：高二（1）班" />
          </label>
          <label>
            <span>备注</span>
            <input name="notes" maxLength={500} placeholder="选填" />
          </label>
          <button className="button button-primary" type="submit">
            添加学生
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>全部学生</h2>
            <p>共 {students.length} 人</p>
          </div>
        </div>
        {students.length === 0 ? (
          <EmptyState
            icon="人"
            title="名单还是空的"
            description="在上方填写学号和姓名，添加第一名学生。"
          />
        ) : (
          <div className="student-list">
            {students.map((student) => (
              <article className="student-row" key={student.id}>
                <div className="student-identity">
                  <span className="student-avatar">
                    {student.name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.studentNo}</small>
                  </div>
                </div>
                <form action={updateStudentAction} className="student-edit-form">
                  <input type="hidden" name="id" value={student.id} />
                  <label>
                    <span>学号</span>
                    <input
                      name="studentNo"
                      defaultValue={student.studentNo}
                      maxLength={64}
                      required
                    />
                  </label>
                  <label>
                    <span>姓名</span>
                    <input name="name" defaultValue={student.name} maxLength={100} required />
                  </label>
                  <label>
                    <span>班级</span>
                    <input name="className" defaultValue={student.className} maxLength={100} />
                  </label>
                  <label>
                    <span>备注</span>
                    <input name="notes" defaultValue={student.notes} maxLength={500} />
                  </label>
                  <button className="button button-secondary button-small">
                    保存
                  </button>
                </form>
                <form action={deleteStudentAction}>
                  <input type="hidden" name="id" value={student.id} />
                  <button className="icon-button danger" title="删除学生">
                    ×
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
