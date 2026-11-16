import Link from "next/link";
import { LearnCta } from "@/components/HomeWidgets";
import { ExploreWorkspace } from "@/components/home/ExploreWorkspace";
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
            <span className="mt-1 block text-xs text-ink-2">{tags.join(" · ")}</span>
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Explore history through connections</h1>
            <p className="mt-1 text-ink-2">A map of events, people and places, and how they link.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LearnCta />
            <Link href={flagship.href} className="btn btn-secondary">Follow a story</Link>
          </div>
        </div>
        <div className="mt-4 max-w-2xl">
          <SearchBox placeholder="Search people, places, events…" />
        </div>

        <div className="mt-5"><ExploreWorkspace /></div>

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
