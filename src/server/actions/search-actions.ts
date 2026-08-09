"use server";
import { logger } from "@/lib/logger";


import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { MissionStatus } from "@prisma/client";

export type SearchResult = {
    id: string;
    title: string;
    subtitle?: string;
    type: "MEMBER" | "MISSION" | "PAGE" | "GAME_DATA" | "SERVICE" | "VAULT" | "LOAN" | "SKIN" | "EVENT" | "ACTION";
    href: string;
    icon?: string;
};

export async function globalSearch(query: string, guildId: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    if (!guildId || !/^\d+$/.test(guildId)) return [];

    const ctx = await getUserContext(guildId);
    
    if (!ctx.isAuthenticated || !ctx.isMember) {
        return [];
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 1. Search Members (Profiles) — scoped strictly to the requested guild
    if (ctx.canViewRoster) {
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                OR: [
                    { discordNickname: { contains: query, mode: "insensitive" } },
                    { pseudoDofus: { contains: query, mode: "insensitive" } },
                    { ankamaId: { contains: query, mode: "insensitive" } },
                ],
            },
            take: 5,
        });

        members.forEach((m) => {
            results.push({
                id: m.id,
                title: m.discordNickname || m.pseudoDofus || "Membre",
                subtitle: m.pseudoDofus ? `Dofus: ${m.pseudoDofus}` : "Membre de guilde",
                type: "MEMBER",
                href: `/dashboard/${guildId}/profile/${m.userId === ctx.id ? "" : m.id}`,
            });
        });
    }

    // 2. Search Missions — scoped strictly to the requested guild
    if (ctx.canViewMissions) {
        const missions = await db.mission.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                title: { contains: query, mode: "insensitive" },
            },
            take: 5,
        });

        missions.forEach((m) => {
            results.push({
                id: m.id,
                title: m.title || "Mission",
                subtitle: `Mission Tier ${m.tier}`,
                type: "MISSION",
                href: `/dashboard/${guildId}/missions`,
            });
        });
    }

    // 3. Static Pages (Match query against titles and keywords)
    const pages = [
        { title: "Missions hebdomadaires", href: `/dashboard/${guildId}/missions`, perm: ctx.canViewMissions, keywords: ["mission", "hebdo", "quete"] },
        { title: "Ladder", href: `/dashboard/${guildId}/ladder`, perm: ctx.canViewLadder, keywords: ["classement", "score", "succes", "top"] },
        { title: "Songes", href: `/dashboard/${guildId}/songes`, perm: ctx.canViewSonges, keywords: ["songe", "etage", "reve"] },
        { title: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, perm: ctx.canViewOcre, keywords: ["ocre", "archi", "monstre", "ame"] },
        { title: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, perm: ctx.canViewMissions, keywords: ["donjon", "dj", "boss"] },
        { title: "Profil", href: `/dashboard/${guildId}/profile`, perm: ctx.canViewProfile, keywords: ["profil", "perso", "compte", "absence"] },
        { title: "Annuaire des membres", href: `/dashboard/${guildId}/members`, perm: ctx.canViewRoster, keywords: ["annuaire", "membre", "joueur", "roster"] },
        { title: "La Guilde (Hub)", href: `/dashboard/${guildId}/guild-hub`, perm: ctx.isMember, keywords: ["hub", "guilde", "kama", "banque"] },
        { title: "Ressources communautaires", href: `/dashboard/${guildId}/ressources`, perm: ctx.isMember, keywords: ["doc", "tuto", "aide", "ressource"] },
        { title: "Galerie de Stuff", href: `/dashboard/${guildId}/stuff-hub`, perm: ctx.isMember, keywords: ["stuff", "skin", "equipement", "mode"] },
        { title: "Services & Artisans", href: `/dashboard/${guildId}/services`, perm: ctx.isMember, keywords: ["artisan", "metier", "craft", "passage", "coffre", "pret"] },
        { title: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, perm: ctx.isMember, keywords: ["carte", "map", "monde", "avis", "recherche"] },
        { title: "Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, perm: ctx.isMember, keywords: ["jeu", "mini", "gartic", "geoguess"] },
        { title: "Validation", href: `/dashboard/${guildId}/admin/validation`, perm: ctx.canValidateMissions, keywords: ["valider", "admin"] },
        { title: "Paramètres Admin", href: `/dashboard/${guildId}/admin/settings`, perm: ctx.isAdmin, keywords: ["parametre", "admin", "config"] },
    ];

    pages.forEach((p) => {
        if (p.perm && (p.title.toLowerCase().includes(lowerQuery) || p.keywords?.some(k => k.toLowerCase().includes(lowerQuery)))) {
            results.push({
                id: p.href,
                title: p.title,
                type: "PAGE",
                href: p.href,
            });
        }
    });

    // 4. Intelligent Game Data Search (Dungeons, Monsters, Bounties)
    if (ctx.isMember && query.length >= 3) {
        // Find in Dungeons
        const dungeons = await db.dungeon.findMany({
            where: { 
                OR: [
                    { name: { contains: query, mode: "insensitive" } }, 
                    { bossName: { contains: query, mode: "insensitive" } }
                ] 
            },
            take: 3
        });
        dungeons.forEach(d => {
            results.push({
                id: `dj-${d.id}`,
                title: d.name,
                subtitle: `Donjon Nv. ${d.level} — Boss: ${d.bossName}`,
                type: "GAME_DATA",
                href: `/dashboard/${guildId}/donjons-et-quetes?search=${encodeURIComponent(d.name)}`,
            });
        });

        // Find in Bounties
        const bounties = await db.bounty.findMany({
             where: { name: { contains: query, mode: "insensitive" } },
             take: 2
        });
        bounties.forEach(b => {
             results.push({
                 id: `b-${b.id}`,
                 title: b.name,
                 subtitle: `Avis de recherche Nv. ${b.level} — ${b.zoneName || "Zone Inconnue"}`,
                 type: "GAME_DATA",
                 href: `/dashboard/${guildId}/worldmap?bounty=${encodeURIComponent(b.name)}`,
             });
        });

        // Find in Zones
        const zones = await db.zone.findMany({
            where: { name: { contains: query, mode: "insensitive" } },
            take: 2
        });
        zones.forEach(z => {
             results.push({
                 id: `z-${z.id}`,
                 title: z.name,
                 subtitle: `Zone Nv. ${z.level}`,
                 type: "GAME_DATA",
                 href: `/dashboard/${guildId}/worldmap?zone=${encodeURIComponent(z.name)}`,
             });
        });

        // Find in Ocre Monsters (Archimonstres, etc)
        const ocreMonsters = await db.ocreMonsterTemplate.findMany({
            where: { name: { contains: query, mode: "insensitive" } },
            take: 3
        });
        ocreMonsters.forEach(m => {
             results.push({
                 id: `ocre-${m.id}`,
                 title: m.name,
                 subtitle: `Quête Ocre — ${m.type === "ARCHIMONSTRE" ? "Archimonstre" : m.type === "BOSS" ? "Gardien de Donjon" : "Monstre"}`,
                 type: "GAME_DATA",
                 href: `/dashboard/${guildId}/quete-ocre?search=${encodeURIComponent(m.name)}`,
             });
        });
    }

    // 5. Search in Guild Services / Offerings
    if (ctx.isMember && ctx.canViewServices) {
        const services = await db.serviceListing.findMany({
            where: {
                guildId,
                status: "ACTIVE",
                OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } }
                ]
            },
            take: 3,
            include: { profile: true }
        });

        services.forEach(s => {
            results.push({
                id: `svc-${s.id}`,
                title: s.title,
                subtitle: `Service par ${s.profile.pseudoDofus || "Membre"}`,
                type: "SERVICE",
                href: `/dashboard/${guildId}/services`,
            });
        });

        // Vault
        const vaultEntries = await db.vaultEntry.findMany({
            where: { guildId, action: "DEPOSIT", itemName: { contains: query, mode: "insensitive" } },
            take: 2
        });
        vaultEntries.forEach(v => {
             results.push({
                 id: `vault-${v.id}`,
                 title: v.itemName,
                 subtitle: `Disponible dans le Coffre de Guilde (${v.quantity}x)`,
                 type: "VAULT",
                 href: `/dashboard/${guildId}/services`,
             });
        });

        // Loans
        const loans = await db.guildLoan.findMany({
             where: { guildId, status: "ACTIVE", OR: [{ linkedItemName: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] },
             take: 2,
             include: { lender: true }
        });
        loans.forEach(l => {
             results.push({
                 id: `loan-${l.id}`,
                 title: l.linkedItemName || l.description,
                 subtitle: `Prêt proposé par ${l.lender.pseudoDofus || "Membre"}`,
                 type: "LOAN",
                 href: `/dashboard/${guildId}/services`,
             });
        });
    }

    if (ctx.isMember && ctx.canViewStuffGallery) {
        // Skins
        const skins = await db.userSkin.findMany({
             where: { profile: { guildId }, name: { contains: query, mode: "insensitive" } },
             take: 2,
             include: { profile: true }
        });
        skins.forEach(s => {
             results.push({
                 id: `skin-${s.id}`,
                 title: s.name,
                 subtitle: `Galerie de Stuff — Proposé par ${s.profile.pseudoDofus || "Membre"}`,
                 type: "SKIN",
                 href: `/dashboard/${guildId}/stuff-hub`,
             });
        });
    }

    if (ctx.isMember && ctx.canViewCalendar) {
        // Events
        const events = await db.guildEvent.findMany({
             where: { guildId, title: { contains: query, mode: "insensitive" } },
             take: 2
        });
        events.forEach(e => {
             results.push({
                 id: `evt-${e.id}`,
                 title: e.title,
                 subtitle: `Événement programmé`,
                 type: "EVENT",
                 href: `/dashboard/${guildId}/calendar`,
             });
        });
    }

    // 6. Quick Actions
    const quickActions = [
        { title: "Créer une mission", action: "Gestion", href: `/dashboard/${guildId}/missions/manage`, perm: ctx.canManageMissions },
        { title: "Proposer un service", action: "Services", href: `/dashboard/${guildId}/services`, perm: ctx.canViewServices },
        { title: "Déclarer une absence", action: "Profil", href: `/dashboard/${guildId}/profile`, perm: ctx.isMember },
        { title: "Créer un événement", action: "Calendrier", href: `/dashboard/${guildId}/calendar`, perm: ctx.canManageCalendar },
        { title: "Faire un don de kamas", action: "Hub", href: `/dashboard/${guildId}/guild-hub`, perm: ctx.isMember },
    ];

    quickActions.forEach(a => {
        if (a.perm && a.title.toLowerCase().includes(lowerQuery)) {
            results.push({
                id: `qa-${a.title}`,
                title: a.title,
                subtitle: `Action Rapide — ${a.action}`,
                type: "ACTION",
                href: a.href,
            });
        }
    });

    return results;
}
