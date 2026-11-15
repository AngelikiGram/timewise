import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ChallengePlayer } from "@/components/challenges/ChallengePlayer";
import { CHALLENGES, challengeById } from "@/lib/challenges";

type Props = { params: Promise<{ id: string }> };

export const generateStaticParams = () => CHALLENGES.map((c) => ({ id: c.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = challengeById.get((await params).id);
  return { title: c ? `${c.title} · Challenges · TIMEWISE` : "Challenges · TIMEWISE" };
}

export default async function ChallengePage({ params }: Props) {
  const c = challengeById.get((await params).id);
  if (!c) notFound();
  const i = CHALLENGES.indexOf(c);
  const next = CHALLENGES[(i + 1) % CHALLENGES.length];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/challenges" className="link text-sm">← All challenges</Link>
        <div className="mt-4"><ChallengePlayer challenge={c} /></div>
        <p className="mt-4 text-right"><Link href={`/challenges/${next.id}`} className="btn btn-secondary">Next: {next.title} →</Link></p>
      </main>
    </>
  );
}
