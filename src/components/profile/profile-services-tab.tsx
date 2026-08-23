"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, ArrowRight, Tag, Coins, Calendar, Sparkles, Swords } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getJob, getClass } from "@/lib/dofus-assets";

interface ActiveService {
    id: string;
    title: string;
    category: string;
    price: string | null;
    description: string | null;
    imageUrl?: string | null;
    professions?: string[] | null;
    dungeonName?: string | null;
    dungeonImageUrl?: string | null;
    dofusItemIconUrl?: string | null;
    dofusItemName?: string | null;
    createdAt: string;
}

interface ProfileServicesTabProps {
    guildId: string;
    activeServices?: ActiveService[];
    readOnly?: boolean;
}

export function ProfileServicesTab({ guildId, activeServices = [], readOnly = false }: ProfileServicesTabProps) {
    const hasServices = activeServices.length > 0;

    // Résout les icônes métiers/classes selon la catégorie du service
    const resolveProfessionIcons = (service: ActiveService): string[] => {
        const profs = service.professions || [];
        if (service.category === "FORGEMAGIE" || service.category === "METIER") {
            return profs.map(p => getJob(p)?.icon).filter(Boolean) as string[];
        }
        if (service.category === "TUTORAT") {
            return profs.map(p => getClass(p)?.icon || p).filter(Boolean) as string[];
        }
        return [];
    };

    return (
        <Card className="p-6 bg-background/60 border border-border rounded-3xl space-y-6 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-wider">Services Proposés</h3>
                        <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Listings actifs sur la plateforme</p>
                    </div>
                </div>

                <Button asChild variant="ghost" size="sm" className="text-xs font-black uppercase tracking-wider text-warning hover:text-warning bg-warning/10 hover:bg-warning/20 border border-warning/20 rounded-xl">
                    <Link href={`/dashboard/${guildId}/services`}>
                        Voir le module Services <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                </Button>
            </div>

            {/* Empty State */}
            {!hasServices ? (
                <div className="p-10 rounded-2xl bg-black/40 border border-border flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <Wrench className="w-7 h-7 text-warning" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                        <h4 className="text-sm font-black text-foreground uppercase tracking-wider">Aucun service proposé actuellement</h4>
                        <p className="text-xs text-muted-foreground">
                            {readOnly
                                ? "Ce membre n'a aucune annonce de service active sur le marché de guilde."
                                : "Vous n'avez pas encore publié de service (Passeur, FM, Prêt d'équipement, Tutorat...)."}
                        </p>
                    </div>

                    {!readOnly && (
                        <Button asChild variant="sigil" className="mt-2 text-xs font-black uppercase tracking-wider h-10 px-5">
                            <Link href={`/dashboard/${guildId}/services`}>
                                Proposer un service <Sparkles className="w-3.5 h-3.5 ml-2" />
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeServices.map(service => {
                        const profIcons = resolveProfessionIcons(service);
                        return (
                            <div
                                key={service.id}
                                className="p-5 rounded-2xl bg-black/40 border border-border hover:border-warning/40 transition-all space-y-3 relative group"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Miniature du service (icône item / image donjon / icône métier) */}
                                    <div className="relative h-12 w-12 rounded-xl shrink-0 overflow-hidden border border-border bg-surface flex items-center justify-center shadow-inner">
                                        {service.imageUrl ? (
                                            <Image
                                                src={service.imageUrl}
                                                alt={service.title}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : profIcons.length > 0 ? (
                                            <Image
                                                src={profIcons[0]}
                                                alt={service.title}
                                                fill
                                                className="object-contain p-1"
                                            />
                                        ) : service.category === "PASSAGE_DONJON" ? (
                                            <Swords className="w-5 h-5 text-info" />
                                        ) : (
                                            <Wrench className="w-5 h-5 text-warning" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <span className="inline-flex items-center gap-1 text-caption font-black uppercase tracking-wider text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20 mb-1.5">
                                            <Tag className="w-3 h-3" /> {service.category}
                                        </span>
                                        <h4 className="text-sm font-black text-foreground group-hover:text-warning transition-colors leading-tight">
                                            {service.title}
                                        </h4>
                                    </div>

                                    {service.price !== null && service.price !== "" && (
                                        <span className="flex items-center gap-1 text-xs font-black text-warning bg-warning/10 px-2.5 py-1 rounded-xl border border-warning/20 shrink-0 font-mono">
                                            <Coins className="w-3.5 h-3.5" />
                                            {Number(service.price).toLocaleString("fr-FR")} K
                                        </span>
                                    )}
                                </div>

                                {/* Icônes métiers/classes supplémentaires */}
                                {profIcons.length > 1 && (
                                    <div className="flex flex-wrap gap-1.5 pl-1">
                                        {profIcons.slice(1).map((icon, i) => (
                                            <div key={i} className="relative h-6 w-6 rounded-md overflow-hidden border border-border bg-surface">
                                                <Image src={icon} alt={`métier ${i}`} fill className="object-contain" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {service.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                        {service.description}
                                    </p>
                                )}

                                <div className="pt-2 border-t border-border flex items-center justify-between text-caption text-muted-foreground font-medium">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Publié {formatDistanceToNow(new Date(service.createdAt), { addSuffix: true, locale: fr })}
                                    </span>
                                    <Link href={`/dashboard/${guildId}/services`} className="text-warning font-bold hover:underline">
                                        Consulter →
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}