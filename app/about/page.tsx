import type { Metadata } from "next";
import AboutPage from "@/components/about/AboutPage";

/**
 * The only app-specific file in the About feature — everything else lives in
 * the portable `components/about` module.
 */

export const metadata: Metadata = {
  title: "درباره ما | شهر واقعیت مجازی امید",
  description:
    "شهر واقعیت مجازی امید مجموعه‌ای از راهکارهای هوشمند مبتنی بر فناوری‌های سه‌بعدی، واقعیت افزوده و WebGL است؛ نمایشگاه‌های سه‌بعدی، بازدید مجازی املاک، پرو مجازی جواهرات و رزرو خدمات.",
  keywords: [
    "درباره ما",
    "شهر واقعیت مجازی امید",
    "واقعیت افزوده",
    "واقعیت مجازی",
    "نمایشگاه سه‌بعدی",
    "شوروم مجازی",
    "Omid Virtual City",
  ],
  openGraph: {
    title: "درباره ما | شهر واقعیت مجازی امید — About Omid Virtual City",
    description:
      "راهکارهای سه‌بعدی، AR و VR برای کسب‌وکارها. / 3D, AR and VR solutions for business.",
    type: "website",
  },
};

export default function About() {
  return <AboutPage />;
}
