import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/layout/LenisProvider";
import CustomCursor from "@/components/ui/CustomCursor";

export const metadata: Metadata = {
  title: "لومینا - پاساژ دیجیتال شهر امید",
  description:
    "نمایشگاه سه‌بعدی و امتحان مجازی جواهرات؛ هر قطعه را پیش از خرید، روی خود ببینید. زیبایی را پیش از خرید تجربه کنید.",
  keywords: ["جواهرات", "نمایشگاه سه‌بعدی", "امتحان مجازی", "ویترین مجازی", "گردنبند", "گوشواره", "انگشتر", "ساعت"],
  authors: [{ name: "ویترین مجازی شهر امید" }],
  openGraph: {
    title: "لومینا - پاساژ دیجیتال شهر امید",
    description: "نمایشگاه سه‌بعدی و امتحان مجازی جواهرات",
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
