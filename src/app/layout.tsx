import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "拾题 · 高中数学错题整理",
    template: "%s · 拾题",
  },
  description: "教师上传试卷、录入错题号并自动生成学生错题文档。",
};

const navigation = [
  { href: "/", label: "工作台", icon: "⌂" },
  { href: "/students", label: "学生名单", icon: "人" },
  { href: "/documents", label: "试卷文档", icon: "卷" },
  { href: "/wrong-books", label: "生成错题集", icon: "集" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                拾
              </span>
              <span>
                <strong>拾题</strong>
                <small>数学错题整理</small>
              </span>
            </Link>
            <nav className="navigation" aria-label="主导航">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="sidebar-note">
              <span className="sidebar-note-icon">i</span>
              <div>
                <strong>当前版本</strong>
                <p>图片试卷按题号裁图，公式与图形保留原样。</p>
              </div>
            </div>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
