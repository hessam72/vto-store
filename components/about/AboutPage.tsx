"use client";

import { useEffect, useRef, useState } from "react";
import "./about.css";

import AboutHeader from "./AboutHeader";
import AboutHero from "./AboutHero";
import AboutIntro from "./AboutIntro";
import AboutMission from "./AboutMission";
import AboutServices from "./AboutServices";
import AboutVision from "./AboutVision";
import AboutFooter from "./AboutFooter";
import { ABOUT, type Lang } from "./content";

const STORAGE_KEY = "about:lang";
/** Matches the .about-shell opacity transition in about.css. */
const FADE_MS = 180;

/**
 * Bilingual About page — the single entry point of the portable
 * `components/about` module.
 *
 * Language is owned here rather than by the app's routing, because the host
 * layout is a single-locale document (`<html lang="fa" dir="rtl">`). Flipping
 * `lang`/`dir` on this wrapper scopes the second language to this page alone
 * and leaves the rest of the site untouched.
 */
export default function AboutPage({ defaultLang = "fa" }: { defaultLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [fading, setFading] = useState(false);
  const timer = useRef<number | null>(null);

  const copy = ABOUT[lang];

  // Read the stored preference only after mount. The server rendered
  // `defaultLang`, so reading localStorage during render would desync
  // hydration — this costs one extra paint and buys a stable first render.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can throw in private mode / with cookies blocked.
    }
    if (stored === "fa" || stored === "en") setLang(stored);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // The route's static metadata is Persian; keep the tab label honest when the
  // reader switches. Next restores its own title on navigation away.
  useEffect(() => {
    document.title = `${copy.hero.eyebrow} | ${copy.brand.name}`;
  }, [copy]);

  function changeLang(next: Lang) {
    if (next === lang) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the switch still applies for this visit.
    }

    // Dim, swap, restore — so the change reads as deliberate rather than as a
    // hard cut between two scripts.
    if (timer.current !== null) window.clearTimeout(timer.current);
    setFading(true);
    timer.current = window.setTimeout(() => {
      setLang(next);
      setFading(false);
      timer.current = null;
    }, FADE_MS);
  }

  return (
    <div
      className="about-root"
      lang={lang}
      dir={lang === "fa" ? "rtl" : "ltr"}
      data-ab-fading={fading ? "" : undefined}
    >
      <a href="#about-main" className="about-skip">
        {copy.ui.skip}
      </a>

      <div className="about-shell">
        <AboutHeader copy={copy} lang={lang} onLang={changeLang} />

        <main id="about-main">
          <AboutHero copy={copy} />
          <AboutIntro copy={copy} />
          <AboutMission copy={copy} />
          <AboutServices copy={copy} />
          <AboutVision copy={copy} />
        </main>

        <AboutFooter copy={copy} lang={lang} onLang={changeLang} />
      </div>
    </div>
  );
}
