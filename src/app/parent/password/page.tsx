import type { Metadata } from "next";
import Link from "next/link";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { changeParentPasswordAction } from "../actions";
import { requireParentSession } from "@/lib/parent-auth";

export const metadata: Metadata = { title: "修改密码" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; first?: string }>;

export default async function ParentPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireParentSession({ allowPasswordChange: true });
  const params = await searchParams;
  const firstLogin = params.first === "1" || session.account.mustChangePassword;
  return (
    <div className="parent-page parent-form-page">
      <ParentHeader student={session.student} />
      <section className="parent-section-card parent-form-card">
        <p className="parent-auth-eyebrow">账号安全</p>
        <h1>{firstLogin ? "请先修改初始密码" : "修改密码"}</h1>
        <p className="parent-form-description">密码修改后，下次请使用新密码登录。</p>
        {params.error ? <p className="parent-message error-text">{params.error}</p> : null}
        <form action={changeParentPasswordAction} className="parent-auth-form">
          <label>
            <span>新密码</span>
            <input name="password" type="password" minLength={6} maxLength={128} required />
          </label>
          <label>
            <span>确认新密码</span>
            <input name="confirmPassword" type="password" minLength={6} maxLength={128} required />
          </label>
          <button className="button button-primary" type="submit">保存新密码</button>
        </form>
        {!firstLogin ? <Link className="parent-back-link" href="/parent">返回首页</Link> : null}
      </section>
      <ParentNavigation active="profile" />
    </div>
  );
}
