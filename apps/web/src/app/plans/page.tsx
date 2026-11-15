import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Membership plans (proposed) · TIMEWISE", description: "A proposed membership model. Nothing is for sale yet." };

// Prices are a proposal to test, kept in one place so they're easy to change.
const PRICES = { monthly: "€4.99", yearly: "€39", pack: "€5–9" };

const ROWS: [string, string, string][] = [
  ["Public atlas and event summaries", "✓", "✓"],
  ["Source links and evidence, on every record", "✓", "✓"],
  ["Report an issue", "✓", "✓"],
  ["One complete flagship story", "✓", "✓"],
  ["Daily challenge", "✓", "✓"],
  ["Bookmarks and notes (in this browser)", "✓", "✓"],
  ["Full story and detective-case library", "–", "✓ when published"],
  ["Challenge archive and personal review", "–", "✓"],
  ["Unlimited collections and notes", "–", "✓"],
  ["Progress on all your devices", "–", "When accounts exist"],
];

const INTEREST = `https://github.com/AngelikiGram/timewise/issues/new?${new URLSearchParams({
  title: "Interest: Timewise Passport",
  body: "I'd consider a Timewise Passport membership.\n\n**What would make it worth paying for?**\n\n\n**Which price would you pay?** (monthly / yearly / a single story pack)\n",
  labels: "membership-interest",
})}`;

export default function PlansPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <p className="eyebrow">Membership · a proposal</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">How TIMEWISE might pay for itself</h1>
        <div role="note" className="mt-5 rounded-lg border-2 border-bronze/60 bg-paper-2 p-4 leading-relaxed">
          <strong>Nothing is for sale.</strong> These plans are a proposal we&rsquo;re testing. No payments are taken, no paid features exist yet, and there is no publishing schedule for new stories. Historical accuracy and access to sources will always be free.
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="card flex flex-col p-6" aria-labelledby="explorer">
            <h2 id="explorer" className="font-serif text-3xl">Explorer</h2>
            <p className="mt-1 text-2xl font-semibold">Free</p>
            <p className="mt-2 text-ink-2">Everything on the site today. No account needed.</p>
            <Link href="/" className="btn btn-secondary mt-auto self-start">Keep exploring</Link>
          </section>
          <section className="card flex flex-col border-bronze/60 p-6" aria-labelledby="passport">
            <h2 id="passport" className="font-serif text-3xl">Timewise Passport</h2>
            <p className="mt-1 text-2xl font-semibold">{PRICES.monthly} <span className="text-base font-normal text-ink-2">per month</span></p>
            <p className="text-ink-2">or {PRICES.yearly} per year, billed once a year. Proposed prices.</p>
            <p className="mt-2 text-ink-2">For a growing library of stories and cases, once there&rsquo;s enough of it to be worth paying for.</p>
            <p className="mt-4 text-sm text-ink-2">Single story packs, proposed at {PRICES.pack} each, paid once.</p>
            <a href={INTEREST} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5 self-start">Tell us you&rsquo;re interested</a>
            <p className="mt-2 text-xs text-ink-2">Opens a public form on GitHub (a free GitHub account is needed). It registers interest only: no payment, no commitment.</p>
          </section>
        </div>

        <section className="mt-10" aria-labelledby="compare">
          <h2 id="compare" className="font-serif text-2xl">Compare</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-line text-sm">
                  <th scope="col" className="py-2 pr-4 font-semibold">Feature</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Explorer (free)</th>
                  <th scope="col" className="py-2 font-semibold">Passport (proposed)</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([f, a, b]) => (
                  <tr key={f} className="border-b border-line">
                    <th scope="row" className="py-2.5 pr-4 font-normal">{f}</th>
                    <td className="py-2.5 pr-4">{a === "–" ? <span className="text-ink-2" aria-label="Not included">–</span> : a}</td>
                    <td className="py-2.5">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-xl">What&rsquo;s needed first</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              <li>Enough checked stories and cases to fill a library.</li>
              <li>Accounts and storage, so progress follows you between devices.</li>
              <li>A payment provider, connected only when there&rsquo;s something to sell.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-xl">What stays free</h2>
            <p className="mt-2 text-ink-2">The atlas, every summary, every source link, review statuses, issue reports and one complete story. Paying would never be needed to check whether something is true.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
