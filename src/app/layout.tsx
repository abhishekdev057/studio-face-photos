import type { Metadata } from "next";
import { Outfit } from "next/font/google"; // Switch to Outfit
import "./globals.css";
import Navbar from "@/components/Navbar";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Aura | Event Photos",
  description: "Find your event photos instantly with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} font-sans antialiased min-h-screen flex flex-col bg-zinc-950 text-white selection:bg-cyan-500/30 selection:text-cyan-200`}
      >
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />
        <Navbar />
        <main className="flex-1 relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
