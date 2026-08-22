import type { Metadata } from "next";
import Link from "next/link";
import { recoverParentPasswordAction } from "../actions";

export const metadata: Metadata = { title: "找回密码" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function ParentRecoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <div className="parent-auth-page">
      <div className="parent-auth-card">
        <div className="parent-auth-logo">拾题</div>
        <p className="parent-auth-eyebrow">找回密码</p>
        <h1>使用绑定手机号找回</h1>
        <p className="parent-auth-description">验证通过后，密码会重置为 123456，登录后请立即修改。</p>
        {params.error ? <p className="parent-message error-text">{params.error}</p> : null}
        <form action={recoverParentPasswordAction} className="parent-auth-form">
          <label>
            <span>账号</span>
            <input name="username" required autoComplete="username" />
          </label>
          <label>
            <span>绑定手机号</span>
            <input name="phone" type="tel" required inputMode="numeric" />
          </label>
          <button className="button button-primary button-large" type="submit">找回密码</button>
        </form>
        <Link className="parent-back-link" href="/parent/login">返回登录</Link>
      </div>
    </div>
  );
}
