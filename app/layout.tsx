import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const maru = Zen_Maru_Gothic({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap", variable: "--font-maru", preload: false });

export const metadata: Metadata = {
  title: "日別目標トラッカー",
  description: "毎日の習慣と目標をチェックする",
  applicationName: "日別目標トラッカー",
  appleWebApp: { capable: true, title: "日別目標", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#140b1c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${maru.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
