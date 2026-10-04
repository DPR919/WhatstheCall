import type { ReactNode } from "react";
import Link from "next/link";
import { SiteBrand } from "./SiteBrand";

type AuthShellProps = {
  eyebrow: string;
  heading: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ eyebrow, heading, description, children }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <SiteBrand />
        <div className="auth-aside-copy">
          <p className="eyebrow">A community for thoughtful calls</p>
          <h2>Every action is worth a closer look.</h2>
          <p>Watch the moment, make your call, and see how other fencing minds read the same action.</p>
        </div>
        <div className="auth-aside-foot">Watch &nbsp; / &nbsp; Decide &nbsp; / &nbsp; Compare</div>
      </aside>
      <div className="auth-main">
        <div className="auth-top"><Link href="/" className="text-link">← Back to home</Link></div>
        <div className="auth-content">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{heading}</h1>
          <p className="lede">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
