"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

export function BotCheck({ action, onToken }: { action: "login" | "signup" | "recovery"; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  const [failed, setFailed] = useState(false);
  useEffect(() => { callback.current = onToken; }, [onToken]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let id: string | undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (++attempts > 100) { clearInterval(timer); setFailed(true); return; }
      if (!window.turnstile || !container.current) return;
      clearInterval(timer);
      id = window.turnstile.render(container.current, {
        sitekey: siteKey, action,
        callback: (token: string) => { setFailed(false); callback.current(token); },
        "expired-callback": () => callback.current(""),
        "error-callback": () => { callback.current(""); setFailed(true); },
      });
    }, 100);
    return () => { clearInterval(timer); if (id) window.turnstile?.remove(id); };
  }, [action, siteKey]);

  if (!siteKey) return null;
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
    <div className="mb-4"><div ref={container} />{failed && <p role="alert">The security check could not load. Please reload and try again.</p>}</div>
  </>;
}
