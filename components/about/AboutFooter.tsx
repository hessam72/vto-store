"use client";

import Link from "next/link";
import AboutLangToggle from "./AboutLangToggle";
import { BackIcon } from "./icons";
import { ABOUT_HOME_HREF, type AboutCopy, type Lang } from "./content";

export default function AboutFooter({
  copy,
  lang,
  onLang,
}: {
  copy: AboutCopy;
  lang: Lang;
  onLang: (next: Lang) => void;
}) {
  return (
    <footer className="about-footer">
      <div className="about-footer-inner">
        <span className="about-footer-name about-gold">{copy.brand.name}</span>
        <p className="about-footer-note">{copy.footer.note}</p>

        {/* Repeated here so the language switch is reachable at the end of a
            long page without scrolling back to the header. */}
        <div className="about-footer-actions">
          <Link href={ABOUT_HOME_HREF} className="about-home-link">
            <BackIcon />
            <span>{copy.ui.backHome}</span>
          </Link>

          <AboutLangToggle lang={lang} onChange={onLang} label={copy.ui.langLabel} />
        </div>
      </div>
    </footer>
  );
}
