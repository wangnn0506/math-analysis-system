import type { Metadata } from "next";
import Link from "next/link";
import { loginParentAction } from "../actions";

export const metadata: Metadata = { title: "家长登录" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <div className="parent-auth-page">
      <div className="parent-auth-card">
        <div className="parent-auth-logo">拾题</div>
        <p className="parent-auth-eyebrow">家长端</p>
        <h1>登录孩子的学习空间</h1>
        <p className="parent-auth-description">查看错题本、学情报告和教师精选试卷。</p>
        {params.success ? <p className="parent-message success-text">{params.success}</p> : null}
        {params.error ? <p className="parent-message error-text">{params.error}</p> : null}
        <form action={loginParentAction} className="parent-auth-form">
          <label>
            <span>账号</span>
            <input name="username" required autoComplete="username" placeholder="姓名拼音 + 学号" />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button className="button button-primary button-large" type="submit">
            登录
          </button>
        </form>
        <div className="parent-auth-links">
          <Link href="/parent/recover">忘记密码？</Link>
          <span>初始密码：123456</span>
        </div>
        <p className="parent-auth-footnote">账号由教师创建，登录后请立即修改初始密码。</p>
      </div>
    </div>
  );
}
