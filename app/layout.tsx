import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拼豆像素工坊｜照片转拼豆图纸",
  description: "上传照片，选择拼豆品牌，自动生成带网格、色号和材料清单的高清拼豆图纸。",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
