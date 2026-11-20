import Link from "next/link";
import { artistOf, PEOPLE, TOPICS, WORKS, type Credit } from "@/lib/explore";
import { Icon, type IconName } from "../icons";

/** Three more ways in, beside the four: a place, a cause, a game. */
export function MoreWays() {
  const ways: { href: string; icon: IconName; title: string; text: string }[] = [
    { href: "/explore/place", icon: "place", title: "Explain this place", text: "Any city through the centuries, and a short guide for a visit." },
    { href: "/explore/why", icon: "cause", title: "Why did this happen?", text: "Causes and consequences as a network you grow by clicking." },
    { href: "/challenges/timeline", icon: "sequence", title: "Build your own timeline", text: "Put real events in order, then see where they fall." },
    { href: "/challenges/fact-or-myth", icon: "checked", title: "Fact or myth?", text: "Supported, uncertain, or marked wrong? Check the record." },
  ];
  return (
    <section className="mt-10" aria-labelledby="more-ways" data-testid="more-ways">
      <h2 id="more-ways" className="font-serif text-2xl">Or try</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ways.map((w) => <li key={w.href}><Link href={w.href} className="card card-link flex h-full items-start gap-3 p-4"><Icon name={w.icon} size={24} className="mt-0.5 shrink-0 text-bronze" /><span><span className="block font-serif text-lg leading-tight">{w.title}</span><span className="mt-0.5 block text-sm text-ink-2">{w.text}</span></span></Link></li>)}
      </ul>
    </section>
  );
}

/** One invitation, four ways in. Each card shows a real image from the collection, credited. */
export function BeginCards() {
  const nouveau = WORKS.filter((w) => w.image && w.year && w.year >= 1895 && w.year <= 1910).sort((a, b) => b.links - a.links);
  const portrait = PEOPLE.find((p) => p.image && p.label === "Gustav Klimt") ?? PEOPLE.find((p) => p.image);
  const year = nouveau.find((w) => w.year === 1900) ?? nouveau[1];
  const thing = nouveau[0];
  const cards: { href: string; icon: IconName; title: string; text: string; image?: Credit; alt: string }[] = [
    { href: `/explore/thing?id=${TOPICS[0]?.id ?? ""}`, icon: "network", title: "Follow a thing", text: "A style, a kind of building, a movement: where and when it spread.", image: thing?.image, alt: thing?.label ?? "" },
    { href: `/explore/year?y=${year?.year ?? 1900}`, icon: "timeline", title: "Explore a year", text: "One year in different places at once.", image: year?.image, alt: year?.label ?? "" },
    { href: "/explore/life", icon: "person", title: "Follow a life", text: "Anyone on Wikidata: their years, works, places and people.", image: portrait?.image, alt: portrait ? `Portrait of ${portrait.label}` : "" },
    { href: "/explore/interests", icon: "idea", title: "Follow your interests", text: "Pick what you care about; journeys combine the other three.", alt: "" },
  ];
  return (
    <section aria-labelledby="begin" data-testid="begin">
      <h2 id="begin" className="font-serif text-3xl">Where would you like to begin?</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.title}>
            <Link href={c.href} className="card card-link group flex h-full flex-col overflow-hidden" data-testid="begin-card">
              <span className="relative block h-40 overflow-hidden bg-paper-3">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image.url} alt={c.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
                ) : <span className="grid h-full place-items-center text-bronze"><Icon name={c.icon} size={56} /></span>}
                <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-bronze shadow"><Icon name={c.icon} size={20} /></span>
              </span>
              <span className="flex flex-1 flex-col p-4">
                <span className="font-serif text-xl leading-tight">{c.title}</span>
                <span className="mt-1 text-sm text-ink-2">{c.text}</span>
                {c.image && <span className="mt-auto truncate pt-2 text-[11px] text-ink-2">{c.alt}: {[artistOf(c.image.artist), c.image.license].filter(Boolean).join(", ")}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
