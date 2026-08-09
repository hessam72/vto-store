"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AboutLangToggle from "./AboutLangToggle";
import { BackIcon } from "./icons";
import { ABOUT_HOME_HREF, ABOUT_LOGO, type AboutCopy, type Lang } from "./content";

/** Logo, falling back to a gold wordmark until the image file exists. */
function BrandMark({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="about-wordmark about-gold">{name}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ABOUT_LOGO} alt={name} onError={() => setFailed(true)} />
  );
}

export default function AboutHeader({
  copy,
  lang,
  onLang,
}: {
  copy: AboutCopy;
  lang: Lang;
  onLang: (next: Lang) => void;
}) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="about-header" data-ab-stuck={stuck ? "" : undefined}>
      {/* Physical left/right positioning rather than flex order: it is immune
          to the wrapper's dir and keeps the brand on the left and the controls
          on the right in both languages. */}
      <div className="about-header-inner">
        <Link href={ABOUT_HOME_HREF} className="about-brand" aria-label={copy.brand.name}>
          <BrandMark name={copy.brand.name} />
        </Link>

        <div className="about-header-actions">
          <Link href={ABOUT_HOME_HREF} className="about-home-link">
            <BackIcon />
            <span className="about-home-label">{copy.ui.home}</span>
          </Link>

          <AboutLangToggle lang={lang} onChange={onLang} label={copy.ui.langLabel} />
        </div>
      </div>
    </header>
  );
}
