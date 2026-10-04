import Link from "next/link";

export function SiteBrand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="What's The Call? home">
      <span className="brand-mark" aria-hidden="true">?</span>
      <span>What&apos;s the Call?</span>
    </Link>
  );
}
