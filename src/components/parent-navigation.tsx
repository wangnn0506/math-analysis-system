import Link from "next/link";

export function ParentNavigation({ active }: { active: string }) {
  const items = [
    { href: "/parent", label: "首页", key: "home", icon: "⌂" },
    { href: "/parent/wrong-books", label: "错题本", key: "wrong-books", icon: "错" },
    { href: "/parent/reports", label: "学情", key: "reports", icon: "学" },
    { href: "/parent/profile", label: "我的", key: "profile", icon: "我" },
  ];
  return (
    <nav className="parent-bottom-nav" aria-label="家长端导航">
      {items.map((item) => (
        <Link className={active === item.key ? "active" : ""} href={item.href} key={item.key}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
