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
  /** Présence temps réel (WebSocket) — simple point de statut. */
  isOnline?: boolean;
  /** Le membre courant (badge « toi »). */
  isSelf?: boolean;
};

type Props = {
  members: AlignmentMember[];
  /** Ouvre le choix d'alignement (masqué si absent). */
  onChangeAlignment?: () => void;
};

type Camp = "bontarien" | "brakmarien";
type Group = { orderId: string; orderName: string; icon: string; members: AlignmentMember[] };

const ORDER_SLUGS = ["vaillant", "attentif", "salvateur", "saignant", "putride", "malsain"];

const ORDER_ICON = (camp: Camp, orderId: string) => {
  const slug = ORDER_SLUGS.find((needle) => orderId.includes(needle)) ?? ORDER_SLUGS[0];
  return `/ordres/${camp === "bontarien" ? "bontarien" : "brakmarien"}/${slug}.png`;
};

/** Titre de tranche (« Mètre des Illusions »…) depuis la source unique des Ordres. */
function trancheTitle(camp: Camp, orderId: string, level: number): string {
  if (!level) return "";
  const orders = (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[camp] || [];
  const order = orders.find((o) => o.id === orderId);
  if (!order) return "";
  const steps = getAlignmentLevelSteps(order as never) as Array<{ level: number; title?: string }>;
  return steps.find((s) => s.level === level)?.title ?? "";
}

function groupByOrder(camp: Camp, members: AlignmentMember[]): Group[] {
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

function Avatar({ member }: { member: AlignmentMember }) {
  return (
    <span
      className={cn(
        "relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border bg-elevated",
        member.isOnline ? "border-success/60" : "border-border"
      )}
    >
      {member.userAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.userAvatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold text-muted-foreground">
          {member.userName.slice(0, 1).toUpperCase()}
        </span>
      )}
      {member.isOnline && (
        <span
          className="absolute -right-px -bottom-px h-2 w-2 rounded-full border border-background bg-success"
          aria-label="En ligne"
        />
      )}
    </span>
  );
}

function SelfBadge() {
  return (
    <span className="shrink-0 rounded-[3px] border border-accent/40 bg-accent/10 px-1 text-[9px] font-semibold text-accent">
      toi
    </span>
  );
}

function MemberRow({ member, camp }: { member: AlignmentMember; camp: Camp | null }) {
  const level = member.alignmentLevel ?? 0;
  const title = camp && member.alignmentOrder ? trancheTitle(camp, member.alignmentOrder, level) : "";
  return (
    <li className="flex items-center gap-2.5 rounded-[4px] px-1.5 py-1.5 transition-colors hover:bg-elevated">
      <Avatar member={member} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-foreground">{member.userName}</span>
          {member.isSelf && <SelfBadge />}
        </span>
        {title && <span className="block truncate text-[10px] text-muted-foreground">{title}</span>}
      </span>
      {level > 0 && (
        <span
          className="shrink-0 rounded-[3px] border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground"
          title={`Tranche ${level}`}
        >
          {`T${level}`}
        </span>
      )}
    </li>
  );
}

function SummaryCell({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className={cn("h-5 w-5 object-contain", value === 0 && "opacity-45")} />
      <span className="min-w-0">
        <span className={cn("block font-mono text-[13px] font-semibold tabular-nums", tone)}>{value}</span>
        <span className="block truncate text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

function OrderCard({ group, camp }: { group: Group; camp: Camp }) {
  return (
    <div className="overflow-hidden rounded-[6px] border border-border bg-surface/40">
      <p className="flex items-center gap-1.5 border-b border-border/70 px-2 py-1 text-[10px] font-semibold text-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={group.icon} alt="" className="h-3.5 w-3.5 object-contain" />
        <span className="truncate">{group.orderName}</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          {group.members.length}
        </span>
      </p>
      <ul className="p-0.5">
        {group.members.map((member) => (
          <MemberRow key={`${member.profileId}-${member.userName}`} member={member} camp={camp} />
        ))}
      </ul>
    </div>
  );
}

function CampSection({ camp, members }: { camp: Camp; members: AlignmentMember[] }) {
  if (!members.length) return null;
  const alignment = getAlignment(camp);
  const groups = groupByOrder(camp, members);
  return (
    <section>
      <header className="flex items-center gap-2 px-1 pt-1 pb-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={alignment?.icon ?? "/ordres/neutre.png"} alt="" className="h-4 w-4 object-contain" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {alignment?.name ?? camp}
        </h3>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          {members.length}
        </span>
      </header>
      <div className="space-y-1">
        {groups.map((group) => (
          <OrderCard key={group.orderId} group={group} camp={camp} />
        ))}
      </div>
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
  const selfNeutre = neutres.some((m) => m.isSelf);

  return (
    <div className="flex min-h-0 flex-col">
      {/* Synthèse : une ligne, trois camps, aucune couleur décorative. */}
      <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border">
        <SummaryCell icon="/ordres/bonta.png" label="Bontariens" value={bontariens.length} tone="text-info" />
        <SummaryCell icon="/ordres/brakmar.png" label="Brâkmariens" value={brakmariens.length} tone="text-danger" />
        <SummaryCell icon="/ordres/neutre.png" label="Neutres" value={neutres.length} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 py-2">
        {members.length === 0 && (
          <div className="mx-auto max-w-[16rem] py-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ordres/neutre.png" alt="" className="mx-auto mb-2 h-8 w-8 object-contain opacity-60" />
            <p className="text-[12px] font-semibold text-foreground">Aucun alignement renseigné</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Les membres n&apos;ont pas encore indiqué leur cité. Chacun peut le faire depuis son profil.
            </p>
          </div>
        )}

        <CampSection camp="bontarien" members={bontariens} />
        <CampSection camp="brakmarien" members={brakmariens} />

        {neutres.length > 0 && (
          <section>
            <header className="flex items-center gap-2 px-1 pt-1 pb-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ordres/neutre.png" alt="" className="h-4 w-4 object-contain opacity-80" />
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Neutres
              </h3>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {neutres.length}
              </span>
            </header>
            <div className="overflow-hidden rounded-[6px] border border-border bg-surface/40">
              <ul className="p-0.5">
                {neutres.map((member) => (
                  <MemberRow
                    key={`${member.profileId}-${member.userName}`}
                    member={member}
                    camp={null}
                  />
                ))}
              </ul>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground">
              L&apos;alignement se choisit en jeu (quête d&apos;alignement), puis se renseigne sur ton
              profil.
            </p>
          </section>
        )}

        {onChangeAlignment && (
          <button
            type="button"
            onClick={onChangeAlignment}
            className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-elevated"
          >
            {selfNeutre ? "Choisir mon alignement" : "Modifier mon alignement"}
          </button>
        )}
      </div>
    </div>
  );
}
