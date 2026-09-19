import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";

import { SiteNav } from "@/components/SiteNav";
import { AuthProvider } from "@/lib/auth";

import "./globals.css";

const display = Libre_Baskerville({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ARZIVE — notebooks & Study with Arzive",
  description:
    "Research-backed notebooks and Study with Arzive: scan notes, generate practice exams and flashcards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <AuthProvider>
          <SiteNav />
          <div className="flex-1">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
