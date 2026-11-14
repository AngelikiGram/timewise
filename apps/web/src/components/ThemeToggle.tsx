"use client";

import { useEffect, useState } from "react";

export type Appearance = "light" | "dark";

/** Reads the appearance from <html> and follows changes made elsewhere on the page. */
export function useAppearance(): Appearance {
  const [theme, setTheme] = useState<Appearance>("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function ThemeToggle() {
  const theme = useAppearance();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} appearance`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("timewise-theme", next);
        } catch {}
      }}
      className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-bronze hover:text-bronze"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}
