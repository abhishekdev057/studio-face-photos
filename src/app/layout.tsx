import type { Metadata } from "next";
import { Outfit } from "next/font/google"; // Switch to Outfit
import "./globals.css";
import Navbar from "@/components/Navbar";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Aura | Face Recognition Workspaces",
  description: "Organize workspaces, match faces, and let guests access only their own photos with a selfie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} flex min-h-screen flex-col bg-[#f4f7fb] font-sans text-slate-950 antialiased selection:bg-slate-950 selection:text-white`}
      >
        <div className="pointer-events-none fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.22),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(191,219,254,0.42),_transparent_28%),linear-gradient(180deg,#f9fbff,#f4f7fb,#eef3f9)]" />
        <Navbar />
        <main className="relative z-10 flex-1">{children}</main>
      </body>
    </html>
  );
}
