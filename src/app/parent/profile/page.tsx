import type { Metadata } from "next";
import Link from "next/link";
import { ParentHeader } from "@/components/parent-header";
import { ParentNavigation } from "@/components/parent-navigation";
import { requireParentSession } from "@/lib/parent-auth";
import { bindParentPhoneAction } from "../actions";

export const metadata: Metadata = { title: "我的账号" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function ParentProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireParentSession();
  const params = await searchParams;
  return (
    <div className="parent-page parent-form-page">
      <ParentHeader student={session.student} />
      <section className="parent-section-card parent-form-card">
        <p className="parent-auth-eyebrow">我的账号</p>
        <h1>账号设置</h1>
        <div className="parent-account-info">
          <span>登录账号</span>
          <strong>{session.account.username}</strong>
        </div>
        {params.success ? <p className="parent-message success-text">{params.success}</p> : null}
        {params.error ? <p className="parent-message error-text">{params.error}</p> : null}
        <form action={bindParentPhoneAction} className="parent-auth-form">
          <label>
            <span>绑定家长手机号</span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              defaultValue={session.account.phone}
              placeholder="用于找回密码"
            />
          </label>
          <button className="button button-primary" type="submit">保存手机号</button>
        </form>
        <Link className="parent-secondary-link" href="/parent/password">修改密码</Link>
      </section>
      <ParentNavigation active="profile" />
    </div>
  );
}
