import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/layout/LenisProvider";
import CustomCursor from "@/components/ui/CustomCursor";

export const metadata: Metadata = {
  title: "AURUM — Where Timeless Gold Meets Digital Art",
  description:
    "Experience luxury jewelry through cinematic storytelling, immersive 3D environments, and augmented reality. Enter the Gold Museum.",
  keywords: ["luxury jewelry", "gold", "3D experience", "digital museum", "AR jewelry"],
  authors: [{ name: "AURUM" }],
  openGraph: {
    title: "AURUM — The Gold Museum",
    description: "A cinematic digital museum for luxury jewelry.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060608",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <LenisProvider>
          {/* Cinematic film grain overlay */}
          <div className="grain-overlay" aria-hidden="true" />

          {/* Custom luxury cursor */}
          <CustomCursor />

          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
