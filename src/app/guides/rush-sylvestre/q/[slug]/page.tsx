import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicRushQuest } from "@/server/public-rush-quest";
import { constraintsToInfos } from "@/lib/rush-constraints";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { RUSH_ORDER_CODES } from "@/lib/rush-order-codes";
import { GameIcon } from "@/components/shared/game-icon";

type PageProps = { params: Promise<{ slug: string }> };

// Même cache ISR que la page du guide : le contenu est public et sans données
// personnelles. Publier / dépublier invalide le chemin (`revalidatePath`).
export const revalidate = 3600;

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-caption text-muted-foreground">
      {children}
    </span>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const quest = await getPublicRushQuest(slug);
  if (!quest) {
    return { title: "Quête introuvable — Rush Sylvestre", robots: { index: false, follow: false } };
  }
  const description =
    (quest.tips ?? "").replace(/\s+/g, " ").trim().slice(0, 155) ||
    `${quest.name} — ${quest.blockTitle} du guide Rush Sylvestre.`;
  return {
    title: `${quest.name} — Rush Sylvestre`,
    description,
    alternates: { canonical: `/guides/rush-sylvestre/q/${quest.slug}` },
    robots: quest.guideUnderConstruction
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: { title: `${quest.name} — Rush Sylvestre`, description, type: "article" },
  };
}

export default async function RushPublicQuestPage({ params }: PageProps) {
  const { slug } = await params;
  const quest = await getPublicRushQuest(slug);
  if (!quest) notFound();

  const order = RUSH_ORDER_CODES.find((row) => row.code === quest.alignOrderCode);
  const dofusClass = DOFUS_CLASSES.find((row) => row.id === quest.classReq);
  const constraints = quest.constraints ? constraintsToInfos(quest.constraints) : [];
  const accent = quest.accentColor
    ? ({ "--da-acc": quest.accentColor } as CSSProperties)
    : undefined;

  return (
    <div data-da="wakfu" data-block="custom" style={accent}>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <nav
          aria-label="Fil d'Ariane"
          className="mb-5 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground"
        >
          <Link href="/guides" className="hover:text-foreground">Guides</Link>
          <span aria-hidden="true">/</span>
          <Link href="/guides/rush-sylvestre" className="hover:text-foreground">Rush Sylvestre</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate">{quest.blockTitle}</span>
        </nav>

        {quest.guideUnderConstruction && (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Ce guide est encore en construction : certaines informations peuvent changer.
          </p>
        )}

        <header className="mb-6">
          <p className="da-kicker">{quest.chapterLabel} · {quest.blockTitle}</p>
          <h1 className="da-title mt-2 text-2xl sm:text-3xl">{quest.name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quest.alignReq && (
              <Chip>{quest.alignReq === "bontarien" ? "Bontarien" : "Brâkmarien"}</Chip>
            )}
            {order && <Chip>{order.label}</Chip>}
            {quest.alignLevelReq != null && <Chip>Palier {quest.alignLevelReq}</Chip>}
            {dofusClass && <Chip>{dofusClass.name}</Chip>}
          </div>
        </header>

        {quest.tips && (
          <section className="da-card mb-4 p-4">
            <h2 className="da-title text-base">Conseils</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{quest.tips}</p>
          </section>
        )}
        {quest.note && (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            {quest.note}
          </p>
        )}

        {constraints.length > 0 && (
          <section className="da-card mb-4 p-4">
            <h2 className="da-title text-base">Conditions</h2>
            <ul className="mt-2 space-y-1.5">
              {constraints.map((info) => (
                <li
                  key={`${info.kind}-${info.text}`}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <GameIcon src={info.icon} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong className="text-foreground">{info.label} :</strong> {info.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {quest.resources.length > 0 && (
          <section className="da-card mb-4 p-4">
            <h2 className="da-title text-base">Ressources à prévoir</h2>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {quest.resources.map((resource) => (
                <li key={resource.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{resource.name}</span>
                  <span className="shrink-0 text-muted-foreground">×{resource.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {quest.dungeons.length > 0 && (
          <section className="da-card mb-4 p-4">
            <h2 className="da-title text-base">Donjons</h2>
            <ul className="mt-2 space-y-1">
              {quest.dungeons.map((dungeon) => (
                <li key={dungeon.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{dungeon.name}</span> · {dungeon.bossName} · niveau {dungeon.level}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {quest.prev ? (
            <Link
              href={`/guides/rush-sylvestre/q/${quest.prev.slug}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← {quest.prev.name}
            </Link>
          ) : <span />}
          {quest.next ? (
            <Link
              href={`/guides/rush-sylvestre/q/${quest.next.slug}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {quest.next.name} →
            </Link>
          ) : <span />}
        </nav>

        <p className="mt-6 text-center">
          <Link
            href="/guides/rush-sylvestre"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Voir le guide complet
          </Link>
        </p>
      </main>
    </div>
  );
}
