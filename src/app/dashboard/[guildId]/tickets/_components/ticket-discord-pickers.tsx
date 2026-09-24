"use client";

/**
 * Sélecteurs Discord du module Tickets (client).
 *
 * Pourquoi ce fichier : la configuration des tickets se faisait en **collant des
 * identifiants** (`ID du salon Discord où poster`, rôles « séparés par des virgules »).
 * Un chef de guilde ne connaît pas ses snowflakes. On réutilise donc les briques
 * partagées du dépôt — `DiscordChannelPicker` (salons, cache 5 min, repli saisie
 * manuelle) et `PingRolesSelector` (multi-rôles) — au lieu d'en créer d'autres.
 *
 * Les listes viennent de l'**API Discord** (`getGuildChannelsAction`,
 * `getDiscordRolesAction`) et sont cachées côté client pour éviter un appel par
 * sélecteur monté.
 */

import { useEffect, useState } from "react";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { AlertTriangle } from "lucide-react";

/** Salons textuels (0) + annonces (5). */
export const TICKET_POST_CHANNEL_TYPES = [0, 5];
/** Catégories Discord (4) — pour choisir où **créer** les salons de ticket. */
export const TICKET_CATEGORY_CHANNEL_TYPES = [4];

type Role = { id: string; name: string; color: string };

const ROLE_TTL_MS = 5 * 60 * 1000;
let rolesCache: { guildId: string; roles: Role[]; expiresAt: number } | null = null;
let rolesInFlight: Promise<Role[]> | null = null;

function toHexColor(color: number | string | null | undefined): string {
    const value = typeof color === "number" ? color : Number.parseInt(String(color ?? 0), 10) || 0;
    return `#${value.toString(16).padStart(6, "0")}`;
}

/** Rôles Discord de la guilde (cache 5 min, jamais `@everyone`, erreurs rendues visibles). */
export function useDiscordRoles(guildId: string): { roles: Role[]; failed: boolean; loading: boolean } {
    const [roles, setRoles] = useState<Role[]>(rolesCache?.guildId === guildId ? rolesCache.roles : []);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(rolesCache?.guildId !== guildId);

    useEffect(() => {
        let cancelled = false;

        if (rolesCache && rolesCache.guildId === guildId && Date.now() < rolesCache.expiresAt) {
            setRoles(rolesCache.roles);
            setLoading(false);
            return;
        }

        const load = async (): Promise<Role[]> => {
            if (rolesInFlight) return rolesInFlight;
            rolesInFlight = (async () => {
                try {
                    const res = await getDiscordRolesAction(guildId, { ignoreWhitelist: true });
                    if (!res.success || !res.roles) return [];
                    // `@everyone` n'est jamais proposé : un rôle staff n'est pas tout le serveur.
                    return res.roles
                        .filter((role) => role.name !== "@everyone")
                        .map((role) => ({ id: role.id, name: role.name, color: toHexColor(role.color) }));
                } catch {
                    return [];
                } finally {
                    rolesInFlight = null;
                }
            })();
            return rolesInFlight;
        };

        setLoading(true);
        load().then((list) => {
            if (cancelled) return;
            setRoles(list);
            setFailed(list.length === 0);
            if (list.length > 0) {
                rolesCache = { guildId, roles: list, expiresAt: Date.now() + ROLE_TTL_MS };
            }
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [guildId]);

    return { roles, failed, loading };
}

/** Sélecteur de rôles Discord (liste blanche staff / rôles à notifier). */
export function TicketRolesPicker({
    guildId,
    value,
    onChange,
    description,
}: {
    guildId: string;
    value: string[];
    onChange: (roleIds: string[]) => void;
    description?: string;
}) {
    const { roles, failed, loading } = useDiscordRoles(guildId);

    if (loading) {
        return <div className="text-xs text-muted-foreground">Chargement des rôles Discord…</div>;
    }

    if (failed) {
        return (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                    Liste des rôles injoignable pour le moment — réessaie après avoir vérifié que le bot est bien
                    présent sur le serveur.
                </span>
            </div>
        );
    }

    return (
        <PingRolesSelector
            value={value}
            onChange={onChange}
            roles={roles}
            description={description ?? "Ces rôles voient et traitent les tickets de ce parcours."}
        />
    );
}

/** Sélecteur de catégorie Discord (là où les salons de ticket sont créés). */
export function TicketCategoryPicker({
    guildId,
    value,
    onChange,
}: {
    guildId: string;
    value: string;
    onChange: (channelId: string) => void;
}) {
    return (
        <DiscordChannelPicker
            guildId={guildId}
            value={value}
            onChange={onChange}
            placeholder="Choisir une catégorie…"
            allowEmptyLabel="Aucune (salons à la racine du serveur)"
            allowedTypes={TICKET_CATEGORY_CHANNEL_TYPES}
        />
    );
}
