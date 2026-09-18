import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";

import "./globals.css";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
});

const sans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Plugga — anteckningar blir quiz",
  description:
    "Ladda upp föreläsningsanteckningar och få studiefrågor. Svensk MVP för AI-plugg.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
