"use client";

/**
 * Menu d une position — DEUX etapes au clic (demande user du 22/11/2026).
 *
 * Le survol ouvrait une bulle non responsive au premier passage de souris ; on veut un
 * clic, puis deux choix : copier la position, ou voir la carte HD.
 *
 * Monte par le guide interne et le guide public. L overlay ne le monte pas : sa puce
 * copie directement (choix user).
 *
 * Perf : aucun fetch avant le clic sur « Voir la carte » ; la carte est resolue par
 * `/api/rush/map-at`, le worldmap de 1,5 Mo ne part jamais au navigateur.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { safeImageUrl } from "@/lib/security";
import { buildRushMapAtUrl } from "@/lib/rush-map-at";
import { NpcBadge } from "./NpcBadge";

type MapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; imageUrl: string }
  | { status: "none" };

export function RushPositionMenu({
  x,
  y,
  worldId,
  mapId = null,
  npc = null,
  zaap = null,
  open,
  onClose,
}: {
  x: number;
  y: number;
  worldId?: number | null;
  /** Carte HD imposee en God (`pos_tags.mapId`), prioritaire sur la resolution (x,y). */
  mapId?: number | null;
  /** PNJ donneur importe dans la quete (nom + portrait), si la donnee en porte un. */
  npc?: { id?: number | null; name?: string | null; imageUrl?: string | null } | null;
  /** Zaap le plus proche (ou saisi en God) : action « zaap + trajet ». */
  zaap?: { x: number; y: number; name?: string | null } | null;
  open: boolean;
  onClose: () => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const daScope = daScopeProps(useDaTheme());
  const [doc, setDoc] = useState<Document | null>(null);
  const [map, setMap] = useState<MapState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setDoc(null);
      return;
    }
    setDoc(
      anchorRef.current?.ownerDocument ??
        (typeof document !== "undefined" ? document : null),
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const win = doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
    if (!win) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [open, onClose, doc]);

  useEffect(() => {
    if (open) setMap({ status: "idle" });
  }, [open, x, y, worldId, mapId]);

  if (!open) return <span ref={anchorRef} className="hidden" aria-hidden="true" />;

  const cmd = `/travel ${x},${y}`;
  const zaapCmd =
    zaap &&
    Number.isSafeInteger(zaap.x) &&
    Number.isSafeInteger(zaap.y)
      ? `/zaap ${zaap.x},${zaap.y} ; /travel ${x},${y}`
      : null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(cmd, rootRef.current?.ownerDocument ?? doc ?? undefined);
    if (!ok) {
      toast.error("Copie impossible", {
        description: `Selectionne et copie manuellement : ${cmd}`,
        duration: 3000,
      });
      return;
    }
    setCopied(true);
    toast.success(`Copie : ${cmd}`, { duration: 2000 });
    setTimeout(() => setCopied(false), 1200);
  };

  const handleCopyZaap = async () => {
    if (!zaapCmd) return;
    const ok = await copyToClipboard(zaapCmd, rootRef.current?.ownerDocument ?? doc ?? undefined);
    if (!ok) {
      toast.error("Copie impossible", {
        description: `Selectionne et copie manuellement : ${zaapCmd}`,
        duration: 3000,
      });
      return;
    }
    toast.success(`Copie : ${zaapCmd}`, { duration: 2500 });
  };

  const handleMap = () => {
    if (map.status === "loading" || map.status === "ready") return;
    setMap({ status: "loading" });
    const mapUrl = buildRushMapAtUrl({ x, y, worldId, mapId });
    fetch(mapUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { imageUrl?: string } | null) => {
        const url = safeImageUrl(data?.imageUrl);
        setMap(url ? { status: "ready", imageUrl: url } : { status: "none" });
      })
      .catch(() => setMap({ status: "none" }));
  };

  // Portail vers le document PORTEUR (page ou fenêtre PiP) : `document` reste celui de
  // la page principale dans le bundle, même quand la puce vit dans l'overlay.
  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {doc &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3"
            role="dialog"
            aria-modal="true"
            aria-label={`Position ${x}, ${y}`}
          >
      <button type="button" aria-label="Fermer" onClick={onClose} className="fixed inset-0 bg-black/60" />
      <div
        ref={rootRef}
        {...daScope}
        className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-foreground">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            [{x}, {y}]
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-[4px] p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-foreground transition-colors hover:border-border-strong"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? "Copie" : "Copier la position"}
          </button>
          <button
            type="button"
            onClick={handleMap}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-foreground transition-colors hover:border-border-strong"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Voir la carte
          </button>
          {zaapCmd && (
            <button
              type="button"
              onClick={handleCopyZaap}
              title={zaap?.name ? `Zaap ${zaap.name} + trajet` : "Zaap + trajet"}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-info/30 bg-info/10 px-2 py-1 text-[12px] font-semibold text-foreground transition-colors hover:bg-info/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/dofus/icons/zaap.png"
                alt=""
                className="h-3.5 w-3.5 shrink-0 object-contain"
                aria-hidden="true"
                loading="lazy"
              />
              Zaap + trajet
            </button>
          )}
        </div>

        {npc?.name && (
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">PNJ</span>
            <NpcBadge npcId={npc.id} name={npc.name} imageUrl={npc.imageUrl} size="sm" bare />
            <span className="min-w-0 truncate text-[12px] font-medium text-foreground">{npc.name}</span>
          </div>
        )}

        {map.status === "loading" && (
          <p className="px-3 pb-3 text-[11px] text-muted-foreground">Chargement de la carte...</p>
        )}
        {map.status === "none" && (
          <p className="px-3 pb-3 text-[11px] text-muted-foreground">
            Carte indisponible pour cette position.
          </p>
        )}
        {map.status === "ready" && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={map.imageUrl}
              alt={`Carte de la position ${x}, ${y}`}
              loading="lazy"
              decoding="async"
              className="block w-full max-h-[72vh] object-contain"
            />
          </div>
        )}
      </div>
    </div>,
          doc.body,
        )}
    </>
  );
}