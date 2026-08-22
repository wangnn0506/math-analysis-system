import Link from "next/link";
import { logoutParentAction } from "@/app/parent/actions";
import type { Student } from "@/lib/types";

export function ParentHeader({ student }: { student: Student }) {
  return (
    <header className="parent-topbar">
      <Link className="parent-logo" href="/parent">
        拾题 <span>家长端</span>
      </Link>
      <div className="parent-child-summary">
        <strong>{student.name}</strong>
        <span>{student.className || "未分配班级"}</span>
      </div>
      <form action={logoutParentAction}>
        <button className="parent-logout" type="submit">
          退出
        </button>
      </form>
    </header>
  );
}
