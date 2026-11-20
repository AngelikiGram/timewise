import Link from "next/link";
import { LearnCta } from "@/components/HomeWidgets";
import { ExploreWorkspace } from "@/components/home/ExploreWorkspace";
import { BeginCards } from "@/components/modes/BeginCards";
import { Icon, type IconName } from "@/components/icons";
import { SearchBox } from "@/components/SearchBox";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import storyIndex from "../../public/data/stories/index.json";

const storyCount = (storyIndex as { stories: unknown[] }).stories.length;
import { STORIES } from "@/lib/stories";

const flagship = STORIES[0];
const detective = STORIES[1];

/** A card under the workspace: a real image where one exists, otherwise an icon, never an illustration. */
function Card({ href, title, tags, icon, image, credit }: { href: string; title: string; tags: string[]; icon: IconName; image?: { url: string; alt: string }; credit?: string }) {
  return (
    <li>
      <Link href={href} className="card card-link group flex h-full flex-col overflow-hidden" data-testid="home-card">
        <span className="relative block h-36 overflow-hidden bg-paper-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={image.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
          ) : (
            <span className="grid h-full place-items-center text-bronze"><Icon name={icon} size={56} /></span>
          )}
        </span>
        <span className="flex flex-1 items-start gap-2 p-4">
          <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-bronze" />
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg leading-tight">{title}</span>
            <span className="mt-1 block text-xs text-ink-2">{tags.join(", ")}</span>
            {credit && <span className="mt-1 block truncate text-[11px] text-ink-2">{credit}</span>}
          </span>
          <Icon name="forward" size={18} className="mt-1 shrink-0 text-ink-2 group-hover:text-bronze" />
        </span>
      </Link>
    </li>
  );
}

export default function Home() {
  const stories = storyCount;
  return (
    <>
      <SiteHeader search={false} />
      <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-6 sm:px-6">
        {/* Hero: a sentence and a ruler of time. Every year on the ruler opens that year. */}
        <section className="grid gap-8 border-b border-line pb-10 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end" aria-labelledby="home-title">
          <div>
            <h1 id="home-title" className="font-serif text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">History, joined up.</h1>
            <p className="mt-4 max-w-xl text-lg text-ink-2">Follow a life, a building style, a city or a war through time and across the map. Every link you see is one a source records.</p>
            <div className="mt-6 max-w-xl"><SearchBox placeholder="A person, a place, an event…" /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LearnCta />
              <Link href={flagship.href} className="btn btn-secondary">Follow a story</Link>
            </div>
            <p className="mt-5 text-sm text-ink-2" data-testid="loop">Learn a short step, connect it in your atlas, practise until it sticks.</p>
          </div>
          <nav aria-label="Jump to a year" className="relative">
            <ol className="relative grid gap-0 border-l-2 border-ink/80 pl-0">
              {([[-490, "The battle of Marathon"], [800, "Charlemagne is crowned"], [1453, "Constantinople falls"], [1789, "Revolution in France"], [1848, "Europe rises up"], [1914, "The Great War begins"], [1969, "Footprints on the Moon"]] as const).map(([y, what]) => (
                <li key={y} className="relative">
                  <Link href={`/explore/year?y=${y}`} className="group flex items-baseline gap-4 py-2 pl-5 hover:bg-paper-2">
                    <span aria-hidden className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-ink bg-paper group-hover:bg-oxblood group-hover:border-oxblood" />
                    <span className="w-24 shrink-0 font-serif text-3xl tabular-nums leading-none group-hover:text-oxblood">{y < 0 ? `${-y} BC` : y}</span>
                    <span className="text-ink-2 group-hover:text-ink group-hover:underline">{what}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-2 pl-5 text-xs text-ink-2">Or any year: see what else was happening, everywhere.</p>
          </nav>
        </section>

        <div className="mt-8"><BeginCards /></div>

        <div className="mt-8"><ExploreWorkspace /></div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card href={flagship.href} title={flagship.title} tags={[flagship.place, flagship.period, `${flagship.minutes} min`]} icon="book" image={flagship.image} credit={flagship.image ? `Image: ${flagship.image.creator}, ${flagship.image.license}` : undefined} />
          <Card href={detective.href} title={detective.title} tags={["Detective case", detective.place, `${detective.minutes} min`]} icon="source" />
          <Card href="/stories" title="Stories by place and era" tags={[`${stories} stories`, "generated from records", "map and timeline"]} icon="place" />
        </ul>
        <p className="mt-6 text-xs text-ink-2">
          Records come from Wikidata and a small hand-checked collection; none of it is complete. <Link href="/about" className="link">How TIMEWISE handles sources</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
