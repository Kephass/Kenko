import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Kenko",
  title: "Kenko",
  description: "Personal nutrition and body tracking",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kenko",
  },
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
        {/* reloadOnOnline off: TanStack resumes queued mutations on reconnect instead. */}
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}
