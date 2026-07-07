import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kenko",
  description: "Personal nutrition and body tracking",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-28">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
