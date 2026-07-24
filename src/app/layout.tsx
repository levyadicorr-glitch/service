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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Browser extensions (form-fillers) inject fdprocessedid="..." into
            buttons/inputs/selects before React hydrates, causing hydration
            mismatch warnings. This inline script runs before hydration,
            strips the attribute, and watches for re-injections until shortly
            after load, then disconnects. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var a="fdprocessedid";var s=function(){var e=document.querySelectorAll("["+a+"]");for(var i=0;i<e.length;i++)e[i].removeAttribute(a)};s();var o=new MutationObserver(function(m){for(var i=0;i<m.length;i++){var t=m[i].target;if(t&&t.nodeType===1&&t.hasAttribute(a))t.removeAttribute(a)}});o.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:[a]});window.addEventListener("load",function(){setTimeout(function(){o.disconnect()},3000)});})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
