import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "What's the Call?",
  description: "Community decisions on fencing actions",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the nonce opts pages into dynamic rendering; cached HTML must never
  // reuse a CSP nonce across visitors.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        nonce={nonce} strategy="beforeInteractive" />}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
