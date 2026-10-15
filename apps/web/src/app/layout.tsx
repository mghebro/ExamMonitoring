import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam Monitor — Driving Exam Availability Dashboard",
  description: "Real-time driving exam availability monitoring with Telegram alerts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
