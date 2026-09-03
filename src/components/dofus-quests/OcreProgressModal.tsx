"use client";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, ExternalLink, Eye, EyeOff } from "lucide-react";

/** Version allégée d'OcreMonster (src/lib/metamob-client.ts) — pas de dépendance. */
export type OcreMonsterLite = {
  id: number;
  nameFr: string;
  image?: string;
  type: string; // "boss" | "archimonstre" | "monstre"
  owned: number;
  state?: string; // "POSSEDE" | "DOUBLON" | "MANQUANT"
  zone?: string;
  subzone?: string;
};

type Tab = "all" | "boss" | "archi";

export default function OcreProgressModal({
  open,
  onOpenChange,
  monsters,
  bossCount,
  archiCount,
  metamobPseudo,
  guildId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monsters: OcreMonsterLite[];
  bossCount?: { gathered?: number; total?: number };
  archiCount?: { gathered?: number; total?: number };
  metamobPseudo?: string | null;
  guildId: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [hideOwned, setHideOwned] = useState(false);

  // Copie locale pour re-render immédiat sur +/− (Metamob patché en direct).
  const [monstersList, setMonstersList] = useState<OcreMonsterLite[]>(monsters);
  useEffect(() => setMonstersList(monsters), [monsters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = monstersList.filter(m => m.type === "boss" || m.type === "archimonstre");
    if (tab === "boss") list = list.filter(m => m.type === "boss");
    if (tab === "archi") list = list.filter(m => m.type === "archimonstre");
    if (q) {
      list = list.filter(m =>
        `${m.nameFr} ${m.zone ?? ""} ${m.subzone ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (hideOwned) list = list.filter(m => m.owned <= 0);
    // Possédés en premier, puis tri alphabétique.
    return [...list].sort((a, b) => {
      const aHas = a.owned > 0 ? 0 : 1;
      const bHas = b.owned > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.nameFr.localeCompare(b.nameFr, "fr");
    });
  }, [monstersList, query, tab, hideOwned]);

  const bossOwned = bossCount?.gathered ?? monstersList.filter(m => m.type === "boss" && m.owned > 0).length;
  const archiOwned = archiCount?.gathered ?? monstersList.filter(m => m.type === "archimonstre" && m.owned > 0).length;

  const countByTab = (t: Tab) => {
    if (t === "boss") return `${bossOwned}/${bossCount?.total ?? 51}`;
    if (t === "archi") return `${archiOwned}/${archiCount?.total ?? 286}`;
    return `${bossOwned + archiOwned}/${(bossCount?.total ?? 51) + (archiCount?.total ?? 286)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background/95 border border-border rounded-[2rem] p-0 text-foreground outline-none overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <img src="/assets/icons/ocre.png" alt="Ocre" className="w-4 h-4 object-contain"/>
              Mon Ocre
            </DialogTitle>
            <span className="text-caption font-bold text-muted-foreground">Metamob · {metamobPseudo}</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/60 border border-border">
              <Search size={12} className="text-muted-foreground shrink-0"/>
              <input
                type="text"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs font-semibold text-foreground"
                placeholder="Rechercher un Gardien ou un Archimonstre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Rechercher dans ma collection Ocre"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche" className="text-muted-foreground hover:text-foreground">
                  <X size={12}/>
                </button>
              )}
            </div>
            <a
              href={`/dashboard/${guildId}/quete-ocre`}
              className="inline-flex items-center gap-1 text-caption font-bold text-warning/80 hover:text-warning whitespace-nowrap"
            >
              Quête complète <ExternalLink size={11}/>
            </a>
          </div>
          {/* Onglets */}
          <div className="flex gap-1.5 mt-3">
            {(["all", "boss", "archi"] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                className={`ocre-tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "all" ? "Tous" : t === "boss" ? "Gardiens" : "Archis"}
                <span className="ocre-tab-count">{countByTab(t)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHideOwned(v => !v)}
              className={`inline-flex items-center gap-1.5 ml-auto px-2.5 py-1.5 rounded-lg border text-caption font-bold transition-colors ${
                hideOwned
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-border bg-surface/60 text-muted-foreground hover:text-foreground"
              }`}
              title={hideOwned ? "Afficher aussi ceux déjà en poche" : "Masquer ceux déjà en poche"}
            >
              {hideOwned ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="whitespace-nowrap">{hideOwned ? "Masqués" : "Masquer les possédés"}</span>
            </button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[440px] px-2 py-2 no-scrollbar">
          {filtered.length > 0 && (
            <div className="px-1 pb-1.5 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
              <span>{filtered.length} affiché{filtered.length > 1 ? "s" : ""}</span>
              {hideOwned && <span className="font-bold text-warning/80">Restants à récupérer</span>}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground italic text-sm">
              {query ? "Aucun monstre ne correspond à la recherche" : hideOwned ? "Tout est déjà en poche 🎉" : "Aucun monstre dans cette catégorie"}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(m => {
                const isOwned = m.owned > 0;
                const isDoublon = m.state === "DOUBLON";
                return (
                  <div key={m.id} className={`ocre-row${isOwned ? " owned" : ""}`}>
                    {m.image ? (
                      <img src={m.image} alt="" className="ocre-row-icon"/>
                    ) : (
                      <span className="ocre-row-icon ocre-row-icon-fallback">{m.nameFr.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="ocre-row-name">{m.nameFr}</span>
                      {(m.zone || m.subzone) && (
                        <span className="ocre-row-zone">{[m.zone, m.subzone].filter(Boolean).join(" · ")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (m.owned <= 0) return;
                            const nextQty = Math.max(0, m.owned - 1);
                            setMonstersList(prev => prev.map(x => x.id === m.id ? { ...x, owned: nextQty, state: nextQty > 1 ? "DOUBLON" : nextQty === 1 ? "POSSEDE" : "MANQUANT" } : x));
                            try {
                              const { updateUserMonsterQuantityAction } = await import("@/server/actions/ocre-actions");
                              await updateUserMonsterQuantityAction({ guildId, monsterId: m.id, quantity: nextQty });
                            } catch { }
                          }}
                          disabled={m.owned <= 0}
                          className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-25"
                          title="Retirer (-1 sur Metamob)"
                        >
                          -
                        </button>
                        <span className="text-caption font-bold px-1 min-w-[16px] text-center">{m.owned}</span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const nextQty = m.owned + 1;
                            setMonstersList(prev => prev.map(x => x.id === m.id ? { ...x, owned: nextQty, state: nextQty > 1 ? "DOUBLON" : "POSSEDE" } : x));
                            try {
                              const { updateUserMonsterQuantityAction } = await import("@/server/actions/ocre-actions");
                              await updateUserMonsterQuantityAction({ guildId, monsterId: m.id, quantity: nextQty });
                            } catch { }
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-muted-foreground hover:text-foreground"
                          title="Ajouter (+1 sur Metamob)"
                        >
                          +
                        </button>
                      </div>
                      <span className={`ocre-state ${isOwned ? (isDoublon ? "doublon" : "possede") : "manquant"}`}>
                        {isOwned ? (isDoublon ? `${m.owned} doublon${m.owned > 1 ? "s" : ""}` : "En poche") : "Manquant"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
