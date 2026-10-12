"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Info, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { BRAND_ICONS } from "@/lib/source-icons";
import { useOcreWriteQueue } from "@/hooks/use-ocre-write-queue";
import { OcreMonsterThumb, OcreTargetStepper } from "@/components/ocre/OcreTargetBits";
import {
  buildOcrePlan,
  metamobProfileUrl,
  ocreRequiredCopies,
  soulStoneLevelLabel,
  toOcrePanelData,
  unavailableOcrePanelData,
  type OcrePanelData,
  type SoulStone,
} from "@/lib/ocre-soul-stones";
import { SoulStoneTiles, StoneImage } from "@/components/ocre/OcreSoulStonesPanel";

interface RushOverlayOcreModalProps {
  guildId: string;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onClose: () => void;
  /**
   * Données déjà chargées par l'appelant (dashboard → PiP, page overlay interne).
   * Absentes ⇒ l'overlay charge lui-même à l'ouverture (aucun aller-retour Metamob
   * au démarrage de la fenêtre de jeu).
   */
  initial?: OcrePanelData | null;
}

/** Chip compacte « pierre requise » d'une cible (miniature + info-bulle). */
function StoneChip({ stone }: { stone: SoulStone }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[3px] border border-border bg-background p-0.5"
      title={`${stone.name} — ${soulStoneLevelLabel(stone)}`}
    >
      <StoneImage stone={stone} className="h-4 w-4" />
    </span>
  );
}

/** Jauge compacte « possédés / total » (le picto vient de nos assets). */
function ProgressLine({
  label,
  owned,
  total,
  icon,
}: {
  label: string;
  owned: number;
  total: number;
  icon: string;
}) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
      <span className="w-[86px] shrink-0 text-[10px] font-semibold text-muted-foreground">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface">
        <span
          className={cn("block h-full rounded-full transition-all", pct >= 100 ? "bg-success" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="shrink-0 text-[10px] font-bold tabular-nums text-foreground">
        {owned}/{total}
      </span>
    </div>
  );
}

/**
 * Panneau « Quête Ocre » de l'overlay interne : progression Metamob du membre
 * (archimonstres + gardiens possédés ou non) et **pierres d'âme à prévoir**.
 *
 * Règles de calcul : `@/lib/ocre-soul-stones` (règle pure, partagée avec le dashboard).
 * Images : uniquement nos assets locaux (WebP siphonnés + pictos du jeu).
 */
export function RushOverlayOcreModal({ guildId, onClose, initial }: RushOverlayOcreModalProps) {
  const [data, setData] = useState<OcrePanelData | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<"needed" | "owned" | "all">("needed");
  const [kind, setKind] = useState<"all" | "archimonstre" | "boss">("all");
  const [query, setQuery] = useState("");
  /** Copies exigées par la quête (parallelQuests) : sert au premier « + ». */
  const requiredCopies = useMemo(() => ocreRequiredCopies(data ?? {}), [data]);

  // ─── Écriture en direct (valider / capturer une cible) ──────────────────────
  // Toute la mécanique (optimiste, file sérialisée, pause sur rate limit, retour arrière)
  // vit dans le hook partagé : overlay et module se comportent EXACTEMENT pareil.
  const {
    monsters,
    adoptServerList,
    changeQuantity,
    pendingIds,
    busy: writeBusy,
    notice,
    setNotice,
  } = useOcreWriteQueue({ guildId, monsters: initial?.monsters ?? [], requiredCopies });

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      // Import paresseux : le module d'actions Ocre est lourd, il n'entre pas dans le
      // bundle de l'overlay tant que le panneau n'est pas ouvert.
      const actions = await import("@/server/actions/ocre-actions");
      if (force) await actions.forceRefreshOcre(guildId).catch(() => null);
      const res = await actions.getMyOcreProgress(guildId);
      if (res.success && res.data) {
        const panel = toOcrePanelData(res.data);
        setData(panel);
        // Le serveur fait foi : on repart de sa liste et on vide les écritures en attente.
        adoptServerList(panel.monsters);
      } else {
        setData(unavailableOcrePanelData());
        setError(res.error === "Compte non lié" ? "Compte Metamob non lié." : "Metamob indisponible.");
      }
    } catch {
      setData(unavailableOcrePanelData());
      setError("Metamob indisponible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  // Données déjà fournies par l'appelant ⇒ aucun chargement réseau à l'ouverture.
  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  // Le plan est recalculé depuis la liste LOCALE : cocher une cible met à jour les
  // pierres à prévoir, les compteurs et les filtres immédiatement.
  const plan = useMemo(
    () => buildOcrePlan({ monsters, currentStep: data?.currentStep ?? 0 }),
    [monsters, data?.currentStep]
  );

  const profileUrl = metamobProfileUrl(data?.pseudo);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plan.targets.filter((t) => {
      if (status !== "all" && (status === "needed") !== t.needed) return false;
      if (kind !== "all" && t.type.toLowerCase() !== kind) return false;
      if (q && !`${t.nameFr} ${t.zone ?? ""} ${t.subzone ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plan.targets, status, kind, query]);

  // Échap ferme le panneau : même comportement que les autres modales du rush.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lastSyncLabel = data?.lastSync
    ? new Date(data.lastSync).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : null;

  /** Style des segments de filtre (même grammaire que les autres filtres du rush). */
  const segCls = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
      active
        ? "border-accent/50 bg-accent/15 text-accent"
        : "border-border bg-surface text-muted-foreground hover:text-foreground"
    );

  /** Un clic sur un nom le copie : prêt à coller dans /w ou dans une recherche.
   * Retour AFFICHÉ DANS LE PANNEAU : `sonner` monte son toaster dans le document
   * PRINCIPAL, donc un toast déclenché depuis la fenêtre PiP reste invisible.
   */
  const copyName = useCallback(async (name: string) => {
    const ok = await copyToClipboard(name);
    setNotice(ok ? { kind: "info", text: `« ${name} » copié.` } : { kind: "error", text: "Copie impossible." });
  }, [setNotice]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2 sm:p-3">
      <button
        type="button"
        aria-label="Fermer la progression Ocre"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative z-10 flex h-full max-h-full w-full max-w-[26rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
        {/* ══ EN-TÊTE ══ */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dofus/icons/archimonster.png" alt="" className="h-5 w-5 shrink-0 object-contain" />
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-semibold text-foreground">Quête Ocre</h2>
              <p className="truncate text-[10px] text-muted-foreground">
                Metamob · {data?.characterName || "—"}
                {data?.serverName ? ` · ${data.serverName}` : ""}
                {data?.isOffline ? " · hors ligne" : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ouvrir mon profil Metamob"
                title={`Mon profil Metamob (${data?.pseudo})`}
                className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_ICONS.metamob.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" />
              </a>
            )}
            <button
              type="button"
              onClick={() => { setRefreshing(true); void load(true); }}
              disabled={loading || refreshing}
              aria-label="Resynchroniser avec Metamob"
              title="Resynchroniser avec Metamob"
              className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (loading || refreshing) && "animate-spin")} />
            </button>
            <a
              href={`/dashboard/${guildId}/quete-ocre`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ouvrir la quête complète"
              title="Ouvrir la quête complète (échanges, troc, zones)"
              className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Lecture de ta progression Metamob…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <AlertTriangle className="h-6 w-6 text-warning" />
            <p className="text-[12px] text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => load(true)}
              className="rounded-[4px] border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-elevated"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {/* ══ PIERRES D'ÂME À PRÉVOIR ══ */}
            <section className="shrink-0 border-b border-border px-3 py-2">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                  Pierres d'âme à prévoir
                </span>
                <span className="text-[12px] font-bold tabular-nums text-accent">
                  {plan.stoneTotal}
                </span>
              </div>

              <SoulStoneTiles plan={plan} />

              <div className="mt-2 space-y-1">
                <ProgressLine
                  label="Archimonstres"
                  owned={plan.archis.owned}
                  total={plan.archis.total}
                  icon="/assets/dofus/icons/archimonster.png"
                />
                <ProgressLine
                  label="Gardiens"
                  owned={plan.bosses.owned}
                  total={plan.bosses.total}
                  icon="/assets/dofus/icons/boss.png"
                />
              </div>

              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {data?.totalSteps ? (
                  <>
                    Étape <span className="font-bold text-foreground">{data.currentStep}</span>
                    <span className="text-muted-foreground">/{data.totalSteps}</span> ·{" "}
                  </>
                ) : null}
                <span className="font-bold text-success">{plan.progress.percent}%</span> de la quête
                {data?.isOffline ? " · snapshot local" : ""}
                {lastSyncLabel ? ` · MAJ ${lastSyncLabel}` : ""}
              </p>
            </section>
            {/* ══ FILTRES ══ */}
            <div className="shrink-0 space-y-1.5 border-b border-border px-3 py-2">
              <div className="flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2 py-1">
                <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Archimonstre, zone, sous-zone…"
                  aria-label="Rechercher une cible de la quête Ocre"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
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

              <div className="flex flex-wrap items-center gap-1">
                {([
                  ["needed", `Restants ${plan.progress.missing}`],
                  ["owned", `Obtenus ${plan.progress.owned}`],
                  ["all", `Tous ${plan.progress.total}`],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    aria-pressed={status === value}
                    className={segCls(status === value)}
                  >
                    {label}
                  </button>
                ))}

                <span className="mx-0.5 h-3.5 w-px bg-border" aria-hidden="true" />

                {([
                  ["all", null, plan.progress.total],
                  ["archimonstre", "/assets/dofus/icons/archimonster.png", plan.archis.total],
                  ["boss", "/assets/dofus/icons/boss.png", plan.bosses.total],
                ] as const).map(([value, icon, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKind(value)}
                    aria-pressed={kind === value}
                    aria-label={value === "all" ? "Toutes les cibles" : value === "archimonstre" ? "Archimonstres" : "Gardiens de donjon"}
                    className={segCls(kind === value)}
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt="" className="h-3 w-3 object-contain" />
                    ) : (
                      "Tout"
                    )}
                    <span className="tabular-nums">{count}</span>
                  </button>
                ))}
              </div>

              {/* Retour DANS le panneau (un toast irait dans la fenêtre principale, pas la PiP) :
                  progression de l'écriture en direct, ou dernière erreur Metamob. */}
              {(writeBusy || notice) && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-[10px]",
                    notice?.kind === "error" ? "text-danger" : "text-muted-foreground"
                  )}
                  role={notice?.kind === "error" ? "alert" : "status"}
                >
                  {writeBusy ? (
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Info className="h-3 w-3" aria-hidden="true" />
                  )}
                  {writeBusy ? "Enregistrement sur Metamob…" : notice?.text}
                </p>
              )}
            </div>

            {/* ══ LISTE DES CIBLES ══ */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
              {visible.length === 0 ? (
                <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
                  {query
                    ? "Aucune cible ne correspond à la recherche."
                    : status === "needed"
                      ? "Plus rien à capturer dans ce filtre."
                      : "Aucune cible dans ce filtre."}
                </p>
              ) : (
                <div className="space-y-1">
                  {visible.map((t) => (
                    <div
                      key={`${t.type}-${t.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-[4px] border bg-surface px-2 py-1.5",
                        t.needed ? "border-warning/25" : "border-border"
                      )}
                    >
                      <OcreMonsterThumb id={t.id} type={t.type} dimmed={!t.needed} />

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => copyName(t.nameFr)}
                          title={`Copier « ${t.nameFr} »`}
                          className="block w-full truncate text-left text-[11px] font-semibold text-foreground transition-colors hover:text-accent"
                        >
                          {t.nameFr}
                        </button>
                        <p className="truncate text-[9px] text-muted-foreground">
                          {t.level > 0 ? `Niv. ${t.level}` : "Niv. ?"}
                          {t.zone ? ` · ${t.zone}` : ""}
                          {t.subzone && t.subzone !== t.zone ? ` · ${t.subzone}` : ""}
                        </p>
                      </div>

                      <StoneChip stone={t.stone} />

                      {/* Validation EN DIRECT : ±1 → Metamob (file sérialisée, optimiste). */}
                      <OcreTargetStepper
                        owned={t.owned}
                        requiredCopies={requiredCopies}
                        pending={pendingIds.includes(t.id)}
                        label={t.nameFr}
                        onStep={(delta) => changeQuantity(t, delta)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
