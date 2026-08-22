import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { listClasses, listStudents } from "@/lib/store";
import { StudentImport } from "@/components/student-import";
import { buildParentUsername } from "@/lib/parent-account";
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
  classId?: string;
  q?: string;
}>;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, classes] = await Promise.all([searchParams, listClasses()]);
  const selectedClassId = params.classId || undefined;
  const query = params.q?.trim() ?? "";
  const students = await listStudents(selectedClassId);
  const visibleStudents = query
    ? students.filter((student) =>
        [student.name, student.studentNo, student.notes, student.className]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(query.toLocaleLowerCase("zh-CN")),
      )
    : students;
  const selectedClass = classes.find((classGroup) => classGroup.id === selectedClassId);

  return (
    <div className="page">
      <PageHeader
        eyebrow="学生管理"
        title="学生名单"
        description="一个学生只归属一个班级；学科扩展时仍可沿用同一份学生名单。"
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
            <span>班级 *</span>
            <select name="classId" required defaultValue={selectedClassId ?? ""}>
              <option value="">请选择班级</option>
              {classes.map((classGroup) => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.name}
                </option>
              ))}
            </select>
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

      <StudentImport
        classes={classes}
        defaultClassId={selectedClassId}
      />

      <section className="panel student-filter-panel">
        <form method="get" className="list-filter-form">
          <label>
            <span>筛选班级</span>
            <select name="classId" defaultValue={selectedClassId ?? ""}>
              <option value="">全部班级</option>
              {classes.map((classGroup) => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>搜索学生</span>
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              placeholder="姓名、学号或备注"
            />
          </label>
          <button className="button button-secondary" type="submit">
            筛选
          </button>
          {selectedClassId || query ? (
            <a className="filter-reset" href="/students">
              清除筛选
            </a>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>全部学生</h2>
            <p>
              {selectedClass ? `${selectedClass.name} · ` : "全部班级 · "}
              {query ? `显示 ${visibleStudents.length} / ${students.length} 人` : `共 ${students.length} 人`}
            </p>
          </div>
          {selectedClassId ? (
            <a className="button button-secondary button-small" href="/students">
              查看全部
            </a>
          ) : null}
        </div>
        {visibleStudents.length === 0 ? (
          <EmptyState
            icon="人"
            title={students.length === 0 ? "名单还是空的" : "没有找到匹配学生"}
            description={
              students.length === 0
                ? "在上方填写学号和姓名，添加第一名学生。"
                : "请尝试更换关键词，或清除筛选条件。"
            }
          />
        ) : (
          <div className="student-list">
            {visibleStudents.map((student) => (
              <article className="student-row" key={student.id}>
                <div className="student-identity">
                  <span className="student-avatar">
                    {student.name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.studentNo}</small>
                    <small>家长账号：{buildParentUsername(student.name, student.studentNo)}</small>
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
                    <select name="classId" defaultValue={student.classId ?? ""} required>
                      <option value="">请选择班级</option>
                      {classes.map((classGroup) => (
                        <option key={classGroup.id} value={classGroup.id}>
                          {classGroup.name}
                        </option>
                      ))}
                    </select>
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
