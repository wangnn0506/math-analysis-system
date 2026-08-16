import Link from "next/link";

export default function NotFound() {
  return (
    <div className="centered-state">
      <div className="empty-icon">?</div>
      <h1>没有找到这个页面</h1>
      <p>内容可能已被删除，或者链接地址有误。</p>
      <Link className="button button-primary" href="/">
        返回工作台
      </Link>
    </div>
  );
}
