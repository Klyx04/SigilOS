"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { getAlignment, getAlignmentLevelSteps, ORDERS } from "@/lib/dofus-assets";
import { normalizeAlignmentCamp } from "@/lib/rush-route";

/**
 * Membre tel que l'affiche la modale « Alignement de la guilde ».
 * Les champs viennent de `GuideProgressRow` (`alignment`, `alignmentOrder`,
 * `alignmentLevel`) — **déjà chargés** par la page, aucune requête supplémentaire.
 */
export type AlignmentMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
  /** Présence temps réel (WebSocket) — simple surbrillance. */
  isOnline?: boolean;
  /** Le membre courant (badge « toi »). */
  isSelf?: boolean;
};

type Props = {
  members: AlignmentMember[];
  /** Ouvre le choix d'alignement (masqué si absent). */
  onChangeAlignment?: () => void;
};

type Group = { orderId: string; orderName: string; icon: string; members: AlignmentMember[] };

const ORDER_SLUGS: Array<[string, string]> = [
  ["vaillant", "vaillant"],
  ["attentif", "attentif"],
  ["salvateur", "salvateur"],
  ["saignant", "saignant"],
  ["putride", "putride"],
  ["malsain", "malsain"],
];

const ORDER_ICON = (camp: "bontarien" | "brakmarien", orderId: string) => {
  const slug = ORDER_SLUGS.find(([needle]) => orderId.includes(needle))?.[1] ?? "vaillant";
  return `/ordres/${camp === "bontarien" ? "bontarien" : "brakmarien"}/${slug}.png`;
};

/** Titre de tranche (« Mètre des Illusions »…) depuis la source unique des Ordres. */
function trancheTitle(camp: "bontarien" | "brakmarien", orderId: string, level: number): string {
  if (!level) return "";
  const orders = (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[camp] || [];
  const order = orders.find((o) => o.id === orderId);
  if (!order) return "";
  const steps = getAlignmentLevelSteps(order as never) as Array<{ level: number; title?: string }>;
  return steps.find((s) => s.level === level)?.title ?? "";
}

function groupByOrder(camp: "bontarien" | "brakmarien", members: AlignmentMember[]): Group[] {
  const groups = new Map<string, Group>();
  for (const member of members) {
    const orderId = (member.alignmentOrder || "").trim();
    const key = orderId || "__none__";
    if (!groups.has(key)) {
      const orders = (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[camp] || [];
      const order = orders.find((o) => o.id === orderId);
      groups.set(key, {
        orderId: key,
        orderName: (order?.name as string) || "Ordre non renseigné",
        icon: orderId ? ORDER_ICON(camp, orderId) : "/ordres/neutre.png",
        members: [],
      });
    }
    groups.get(key)!.members.push(member);
  }
  for (const group of groups.values()) {
    group.members.sort((a, b) => (b.alignmentLevel ?? 0) - (a.alignmentLevel ?? 0));
  }
  return [...groups.values()].sort((a, b) => b.members.length - a.members.length);
}

function MemberRow({ member, camp }: { member: AlignmentMember; camp: "bontarien" | "brakmarien" }) {
  const level = member.alignmentLevel ?? 0;
  const title = member.alignmentOrder ? trancheTitle(camp, member.alignmentOrder, level) : "";
  return (
    <li className="flex items-center gap-2 rounded-[4px] px-1.5 py-1">
      <span
        className={cn(
          "relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border",
          member.isOnline ? "border-success/60" : "border-border"
        )}
      >
        {member.userAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.userAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {member.userName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[12px] font-semibold text-foreground">{member.userName}</span>
          {member.isSelf && (
            <span className="shrink-0 rounded-[3px] border border-accent/40 bg-accent/10 px-1 text-[9px] font-semibold text-accent">
              toi
            </span>
          )}
        </span>
        {title && <span className="block truncate text-[10px] text-muted-foreground">{title}</span>}
      </span>
      {level > 0 && <span className="shrink-0 font-mono text-[10px] text-warning">{`T${level}`}</span>}
    </li>
  );
}

function CampSection({
  camp,
  members,
}: {
  camp: "bontarien" | "brakmarien";
  members: AlignmentMember[];
}) {
  if (!members.length) return null;
  const alignment = getAlignment(camp);
  const groups = groupByOrder(camp, members);
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={alignment?.icon ?? "/ordres/neutre.png"} alt="" className="h-4 w-4 object-contain" />
        {alignment?.name ?? camp}
        <span className="font-mono tabular-nums text-foreground">{members.length}</span>
      </h3>
      {groups.map((group) => (
        <div key={group.orderId} className="rounded-[4px] border border-border bg-surface/40 p-1">
          <p className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={group.icon} alt="" className="h-3.5 w-3.5 object-contain" />
            <span className="truncate">{group.orderName}</span>
            <span className="ml-auto font-mono tabular-nums text-muted-foreground">
              {group.members.length}
            </span>
          </p>
          <ul>
            {group.members.map((member) => (
              <MemberRow key={`${member.profileId}-${member.userName}`} member={member} camp={camp} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Panneau « Alignement de la guilde » — **une seule implémentation** pour le dashboard
 * et l'overlay (chaque surface fournit son enveloppe : `Dialog` d'un côté, panneau
 * maison sans portail de l'autre, contrainte Picture-in-Picture).
 */
export function GuildAlignmentPanel({ members, onChangeAlignment }: Props) {
  const bontariens = members.filter((m) => normalizeAlignmentCamp(m.alignment) === "bontarien");
  const brakmariens = members.filter((m) => normalizeAlignmentCamp(m.alignment) === "brakmarien");
  const neutres = members.filter((m) => !normalizeAlignmentCamp(m.alignment));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
        <span>
          Bontariens <span className="font-mono font-semibold text-info">{bontariens.length}</span>
        </span>
        <span>
          Brâkmariens <span className="font-mono font-semibold text-danger">{brakmariens.length}</span>
        </span>
        <span>
          Neutres <span className="font-mono font-semibold text-foreground">{neutres.length}</span>
        </span>
        {onChangeAlignment && (
          <button
            type="button"
            onClick={onChangeAlignment}
            className="ml-auto rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-semibold text-foreground transition-colors hover:bg-elevated"
          >
            Modifier le mien
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {members.length === 0 && (
          <p className="py-6 text-center text-[12px] text-muted-foreground">
            Aucun membre n&apos;a encore renseigné son alignement.
          </p>
        )}
        <CampSection camp="bontarien" members={bontariens} />
        <CampSection camp="brakmarien" members={brakmariens} />
        {neutres.length > 0 && (
          <section className="space-y-1">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ordres/neutre.png" alt="" className="h-4 w-4 object-contain opacity-70" />
              Neutres
              <span className="font-mono tabular-nums text-foreground">{neutres.length}</span>
            </h3>
            <p className="px-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {neutres.map((m) => m.userName).join(" · ")}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
