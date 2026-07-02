import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "WiseWheel - מערכת קריאות שירות",
  description: "מערכת לפתיחת וניהול קריאות שירות",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} font-sans h-full bg-gray-50/50`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
