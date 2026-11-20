"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { interestOf, PEOPLE, suggestFor, TOPICS } from "@/lib/explore";
import { recentOf, useExplorer } from "@/lib/explorer";
import { useProgress } from "@/lib/progress";
import { recommendedPaths } from "@/lib/recommend";
import { Icon } from "../icons";
import { BadgeToast, ExplorerPanel, LevelBar } from "./Gamify";
import { ModeBar, SaveInterest } from "./shared";

const MODE_ICON = { thing: "network", life: "person", year: "timeline" } as const;
const MODE_LABEL = { thing: "Follow a thing", life: "Follow a life", year: "Explore a year" } as const;

/** Follow your interests: what you saved and explored, journeys that combine the other ways in, and your explorer profile. */
export function InterestsView() {
  const tab = useSearchParams().get("tab") === "profile" ? "profile" : "for-you";
  const router = useRouter();
  const p = useProgress();
  const name = p.profile?.name;
  const tabs = [{ id: "for-you", label: "For you", icon: "idea" as const }, { id: "profile", label: "Your profile & badges", icon: "person" as const }];
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="interests-view">
      <BadgeToast />
      <ModeBar on="interests" here={{ href: "/explore/interests", label: "Your interests", mode: "interests" }} />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{name ? `${name}'s interests` : "Your interests"}</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Save things and people you care about. Suggestions combine them with what you&rsquo;ve explored: a thing to follow, a life, a year. Every page you open earns XP and badges.</p>
        </div>
        <LevelBar compact />
      </div>
      <div role="tablist" aria-label="Interests and profile" className="mt-5 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-testid={`tab-${t.id}`} onClick={() => router.replace(t.id === "profile" ? "/explore/interests?tab=profile" : "/explore/interests", { scroll: false })}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-bronze text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
            <Icon name={t.icon} size={16} />{t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">{tab === "profile" ? <ProfileTab /> : <ForYou />}</div>
    </div>
  );
}

function ForYou() {
  const p = useProgress();
  const e = useExplorer();
  const mine = p.interests ?? [];
  const suggestions = suggestFor(mine, e.names);
  // From what you explored but didn't save: the prebuilt lives and things lead on into the other modes.
  const explored = [...recentOf(e.lives, 4).map((x) => ({ ...x, key: interestOf.person(x.id) })), ...recentOf(e.things, 3).map((x) => ({ ...x, key: interestOf.topic(x.id) }))].filter((x) => !mine.includes(x.key));
  const because = suggestFor(explored.map((x) => x.key), Object.fromEntries(explored.map((x) => [x.key, x.label]))).filter((s) => !suggestions.some((o) => o.href === s.href) && !explored.some((x) => s.href.endsWith(`=${x.id}`)));
  const paths = recommendedPaths(p);
  const custom = mine.filter((k) => { const [kind, id] = k.split(":"); return (kind === "person" && !PEOPLE.some((x) => x.id === id)) || (kind === "topic" && !TOPICS.some((x) => x.id === id)); });

  return (
    <>
      <section aria-labelledby="pick">
        <h2 id="pick" className="text-sm font-semibold text-ink-2">Things</h2>
        <div className="mt-2 flex flex-wrap gap-2">{TOPICS.map((t) => <SaveInterest key={t.id} compact kind="topic" id={t.id} label={t.label} />)}</div>
        <h2 className="mt-4 text-sm font-semibold text-ink-2">People</h2>
        <div className="mt-2 flex flex-wrap gap-2">{PEOPLE.map((x) => <SaveInterest key={x.id} compact kind="person" id={x.id} label={x.label} />)}</div>
        {custom.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-semibold text-ink-2">Saved from your searches</h2>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="custom-interests">{custom.map((k) => { const [kind, id] = k.split(":"); return <SaveInterest key={k} compact kind={kind as "person" | "topic"} id={id} label={e.names[k] ?? id} />; })}</div>
          </>
        )}
        <p className="mt-3 text-sm text-ink-2">Anyone or anything else: <Link href="/explore/life" className="link">search a life</Link> or <Link href="/explore/thing" className="link">a thing</Link> and press Save to interests.</p>
      </section>

      <section className="mt-8" aria-labelledby="for-you">
        <h2 id="for-you" className="font-serif text-2xl">Suggested for you</h2>
        {suggestions.length ? <Cards list={suggestions.slice(0, 9)} testId="suggestions" /> : <p className="mt-2 text-sm text-ink-2">Add a thing or a person above, and suggestions appear here.</p>}
      </section>

      {because.length > 0 && (
        <section className="mt-8" aria-labelledby="because">
          <h2 id="because" className="font-serif text-2xl">Because you explored {explored.slice(0, 2).map((x) => x.label).join(" and ")}</h2>
          <Cards list={because.slice(0, 6)} testId="because-suggestions" />
        </section>
      )}

      <section className="mt-8" aria-labelledby="lessons-for-you">
        <h2 id="lessons-for-you" className="font-serif text-2xl">Lessons to go with them</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{paths.map(({ path, why }) => <li key={path.id}><Link href={`/learn?path=${path.id}`} className="card card-link block h-full p-4"><span className="text-xs font-semibold text-bronze">{why}</span><span className="mt-1 block font-serif text-lg leading-tight">{path.title}</span></Link></li>)}</ul>
      </section>
    </>
  );
}

function Cards({ list, testId }: { list: ReturnType<typeof suggestFor>; testId: string }) {
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {list.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className="card card-link flex h-full items-start gap-3 p-4">
            <Icon name={MODE_ICON[s.mode]} size={22} className="mt-0.5 shrink-0 text-bronze" />
            <span><span className="block text-xs font-semibold text-bronze">{MODE_LABEL[s.mode]}</span><span className="block font-serif text-lg leading-tight">{s.title}</span><span className="block text-sm text-ink-2">{s.why}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProfileTab() {
  return (
    <div className="grid gap-6">
      <ExplorerPanel />
      <Link href="/profile" className="card card-link flex items-center gap-3 p-4"><Icon name="book" size={22} className="text-bronze" /><span className="flex-1"><span className="block font-serif text-lg">Your learning profile</span><span className="block text-sm text-ink-2">Lessons, streaks, learning map, sharing and your saved data.</span></span><Icon name="forward" size={16} /></Link>
    </div>
  );
}
