import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { MusicProvider } from "@/components/Music";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
});

const ui = Inter({
  subsets: ["latin"],
  variable: "--font-ui-loaded",
});

export const metadata: Metadata = {
  title: "Solace",
  description: "Some things need somewhere to go.",
  appleWebApp: { capable: true, title: "Solace", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#131120",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <MusicProvider>{children}</MusicProvider>
      </body>
    </html>
  );
}
