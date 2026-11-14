"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { collection } from "@/lib/collection";
import { search } from "@/lib/search";

const KIND_LABEL = { investigation: "Investigate", event: "Event", place: "Place", theme: "Theme" };

export function SearchBox({ size = "large", placeholder }: { size?: "large" | "compact"; placeholder: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => search(collection, query), [query]);
  const large = size === "large";
  const showEmpty = open && query.trim().length >= 2 && hits.length === 0;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[active]) go(hits[active].href);
        }}
        className={`flex items-center border border-line bg-paper-2 transition-colors focus-within:border-bronze ${large ? "rounded-sm py-2 pl-5 pr-2 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.45)]" : "rounded-full py-0.5 pl-4 pr-1"}`}
      >
        <input
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-label="Search events, places and themes"
          aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-2/70 ${large ? "font-serif text-lg sm:text-2xl" : "text-sm"}`}
        />
        <button
          type="submit"
          disabled={!hits.length}
          className={`shrink-0 bg-navy text-on-accent transition-opacity disabled:opacity-40 dark:bg-bronze ${large ? "rounded-sm px-4 py-2.5 text-sm font-medium sm:px-6" : "rounded-full px-3 py-1 text-xs"}`}
        >
          {large ? "Explore" : "Go"}
        </button>
      </form>
      {open && hits.length > 0 && (
        <ul id={listId} data-testid="search-results" role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-auto border border-line bg-paper-2 shadow-xl">
          {hits.map((hit, i) => (
            <li key={`${hit.kind}-${hit.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(hit.href)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left ${i === active ? "bg-paper-3" : ""}`}
              >
                <span className="eyebrow w-20 shrink-0 !text-xs">{KIND_LABEL[hit.kind]}</span>
                <span className="min-w-0 flex-1 font-serif text-base text-ink">{hit.label}</span>
                <span className="hidden shrink-0 text-xs text-ink-2 sm:inline">{hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <p role="status" className="absolute inset-x-0 top-full z-40 mt-1 border border-line bg-paper-2 px-4 py-3 text-sm text-ink-2 shadow-xl">
          Nothing in the verified collection matches this yet. TIMEWISE doesn&rsquo;t guess: free-form AI answers arrive in a later phase, once they can cite their sources.
        </p>
      )}
    </div>
  );
}
