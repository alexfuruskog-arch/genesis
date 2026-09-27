import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { AuthProvider } from "@/lib/auth";
import { ConvexClientProvider } from "@/lib/convex";

import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ARZIVE — notebooks & Study with Arzive",
  description:
    "Research-backed notebooks and Study with Arzive: scan notes or upload lecture files, then ask, make flashcards, or take a short quiz.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <ConvexClientProvider>
          <AuthProvider>
            <SiteNav />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
