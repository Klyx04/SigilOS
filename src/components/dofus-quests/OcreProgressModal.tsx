"use client";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Eye, EyeOff, Info, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_ICONS } from "@/lib/source-icons";
import { useOcreWriteQueue } from "@/hooks/use-ocre-write-queue";
import { OcreMonsterThumb, OcreTargetStepper } from "@/components/ocre/OcreTargetBits";
import { metamobProfileUrl, type OcreMonsterLite } from "@/lib/ocre-soul-stones";

/**
 * Modale « Mon Ocre » (ouverte depuis le guide) — registre + vocabulaire partagés.
 *
 * Ce qui a été retiré volontairement (déslop) : le titre en capitales ultra-trackées, la
 * surface `rounded-[2rem]`, la forêt de classes CSS dédiées (`.ocre-row*`, `.ocre-tab*`,
 * `.ocre-state*` — supprimées de `guide-styles.css`) et les écritures Metamob « à la
 * volée » sans file (rafales possibles).
 *
 * Désormais : jetons de thème, **nos** WebP locaux (`OcreMonsterThumb`), libellés
 * identiques à l'overlay (« À capturer », « À capturer ×1/2 », « Possédé ×2 ») et la
 * **même file d'écriture** (`useOcreWriteQueue`) — optimiste, sérialisée, mise en pause
 * dès qu'une limite est renvoyée (rate limit serveur ou 429 Metamob).
 */

export type { OcreMonsterLite };

type Tab = "all" | "boss" | "archi";

export default function OcreProgressModal({
  open,
  onOpenChange,
  monsters,
  bossCount,
  archiCount,
  metamobPseudo,
  guildId,
  requiredCopies = 1,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monsters: OcreMonsterLite[];
  bossCount?: { gathered?: number; total?: number };
  archiCount?: { gathered?: number; total?: number };
  metamobPseudo?: string | null;
  guildId: string;
  /** Copies exigées par la quête (parallelQuests) : sert au premier « + ». */
  requiredCopies?: number;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [hideOwned, setHideOwned] = useState(false);

  const {
    monsters: list,
    adoptServerList,
    changeQuantity,
    pendingIds,
    busy,
    notice,
  } = useOcreWriteQueue({ guildId, monsters, requiredCopies });

  // Les données serveur font foi dès qu'elles changent (rafraîchissement du guide).
  useEffect(() => { adoptServerList(monsters); }, [monsters, adoptServerList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = list.filter((m) => m.type === "boss" || m.type === "archimonstre");
    if (tab === "boss") out = out.filter((m) => m.type === "boss");
    if (tab === "archi") out = out.filter((m) => m.type === "archimonstre");
    if (q) {
      out = out.filter((m) =>
        `${m.nameFr} ${m.zone ?? ""} ${m.subzone ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (hideOwned) out = out.filter((m) => m.owned <= 0);
    // À capturer d'abord (c'est l'action), puis par nom.
    return [...out].sort((a, b) => {
      const aNeeded = a.owned <= 0 ? 0 : 1;
      const bNeeded = b.owned <= 0 ? 0 : 1;
      if (aNeeded !== bNeeded) return aNeeded - bNeeded;
      return a.nameFr.localeCompare(b.nameFr, "fr");
    });
  }, [list, query, tab, hideOwned]);

  const bossOwned = bossCount?.gathered ?? list.filter((m) => m.type === "boss" && m.owned > 0).length;
  const archiOwned = archiCount?.gathered ?? list.filter((m) => m.type === "archimonstre" && m.owned > 0).length;
  const bossTotal = bossCount?.total ?? 0;
  const archiTotal = archiCount?.total ?? 0;

  const countByTab = (t: Tab) => {
    if (t === "boss") return `${bossOwned}/${bossTotal}`;
    if (t === "archi") return `${archiOwned}/${archiTotal}`;
    return `${bossOwned + archiOwned}/${bossTotal + archiTotal}`;
  };

  const profileUrl = metamobProfileUrl(metamobPseudo);
  const segCls = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
      active
        ? "border-warning/50 bg-warning/10 text-warning"
        : "border-border bg-surface text-muted-foreground hover:text-foreground"
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border border-border bg-background p-0 text-foreground outline-none">
        <DialogHeader className="space-y-3 border-b border-border px-5 pb-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/dofus/icons/archimonster.png" alt="" className="h-4 w-4 object-contain" />
              Mon Ocre
            </DialogTitle>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Metamob · {metamobPseudo || "—"}
              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvrir mon profil Metamob"
                  title="Mon profil Metamob"
                  className="rounded-md p-1 transition-colors hover:bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BRAND_ICONS.metamob.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" />
                </a>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Rechercher dans ma collection Ocre"
                placeholder="Rechercher un gardien ou un archimonstre…"
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Effacer la recherche"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <a
              href={`/dashboard/${guildId}/quete-ocre`}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-warning/90 transition-colors hover:text-warning"
            >
              Quête complète <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "boss", "archi"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={segCls(tab === t)}
              >
                {t === "all" ? "Tout" : t === "boss" ? "Gardiens" : "Archis"}
                <span className="tabular-nums opacity-80">{countByTab(t)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHideOwned((v) => !v)}
              aria-pressed={hideOwned}
              className={cn(segCls(hideOwned), "ml-auto")}
              title={hideOwned ? "Afficher aussi ceux déjà capturés" : "Masquer ceux déjà capturés"}
            >
              {hideOwned ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span className="whitespace-nowrap">{hideOwned ? "Masqués" : "Masquer les possédés"}</span>
            </button>
          </div>


          {/* Retour d'écriture DANS la modale (mêmes règles que l'overlay). */}
          {(busy || notice) && (
            <p
              className={cn(
                "flex items-center gap-1 text-[11px]",
                notice?.kind === "error" ? "text-danger" : "text-muted-foreground"
              )}
              role={notice?.kind === "error" ? "alert" : "status"}
            >
              {busy ? (
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Info className="h-3 w-3" aria-hidden="true" />
              )}
              {busy ? "Enregistrement sur Metamob…" : notice?.text}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[440px] px-2 py-2 no-scrollbar">
          {filtered.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              {query
                ? "Aucune cible ne correspond à la recherche."
                : hideOwned
                  ? "Tout est déjà capturé."
                  : "Aucune cible dans cette catégorie."}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-surface px-2.5 py-2",
                    m.owned > 0 ? "border-border" : "border-warning/25"
                  )}
                >
                  <OcreMonsterThumb id={m.id} type={m.type} dimmed={m.owned > 0} className="h-8 w-8" />

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-semibold text-foreground">{m.nameFr}</span>
                    {(m.zone || m.subzone) && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {[m.zone, m.subzone].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>

                  <OcreTargetStepper
                    owned={m.owned}
                    requiredCopies={requiredCopies}
                    pending={pendingIds.includes(m.id)}
                    label={m.nameFr}
                    onStep={(delta) => changeQuantity(m, delta)}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

