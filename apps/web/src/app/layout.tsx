import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// These names must differ from Tailwind's own --font-sans / --font-mono:
// globals.css points those at these, and a variable defined in terms of
// itself is circular, resolves to nothing, and drops the whole app to the
// browser's default serif.
const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Data Room",
  description: "A due diligence data room: folders, PDF files, and sharing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme is applied to <html> before paint by next-themes, which the
    // server cannot know about; without this React reports the difference as a
    // hydration error.
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
