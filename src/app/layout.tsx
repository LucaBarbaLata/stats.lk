import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // latin-ext has Romanian ș and ț
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  // latin-ext has Romanian ș and ț
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "stats.lk", template: "%s · stats.lk" },
  description: "Your Spotify listening stats, all of them, free.",
};

export const viewport: Viewport = {
  themeColor: "#0c0c11",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
