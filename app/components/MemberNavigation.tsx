"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MemberNavigation({ canUpload }: { canUpload: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/main", label: "Call a clip" },
    { href: "/main/recent-clips", label: "Recent clips" },
    { href: "/main/invites", label: "My invites" },
    ...(canUpload ? [{ href: "/main/uploaded-videos", label: "Uploaded videos" }] : []),
  ];

  return (
    <nav className="member-nav" aria-label="Member navigation">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
          {item.label}
          <span aria-hidden="true">↗</span>
        </Link>
      ))}
    </nav>
  );
}
