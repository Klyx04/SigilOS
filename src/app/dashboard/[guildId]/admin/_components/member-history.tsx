import { db } from "@/lib/prisma";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UserX, LogOut, ShieldAlert } from "lucide-react";
import { HistoryWipeButton } from "./history-wipe-button";

interface MemberHistoryProps {
    guildId: string;
}

export async function MemberHistory({ guildId }: MemberHistoryProps) {
    const historicalProfiles = await db.userProfile.findMany({
        where: {
            guild: { discordGuildId: guildId },
            status: { in: ["ARCHIVED", "BANNED"] }
        },
        orderBy: { archivedAt: "desc" },
        take: 10
    });

    return (
        <div className="bg-surface/50 border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-surface/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <UserX className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Historique Récent (Fantômes)</h3>
                </div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">RGPD Compliant</span>
            </div>

            <div className="divide-y divide-border">
                {historicalProfiles.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        Aucun membre archivé ou banni pour le moment.
                    </div>
                ) : (
                    historicalProfiles.map((profile) => (
                        <div key={profile.id} className="p-4 flex items-center justify-between hover:bg-elevated/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${profile.status === "BANNED" ? "bg-danger/10" : "bg-elevated"
                                    }`}>
                                    {profile.status === "BANNED" ? (
                                        <ShieldAlert className="w-4 h-4 text-danger" />
                                    ) : (
                                        <LogOut className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <div className="font-medium text-foreground">
                                        {profile.discordNickname}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {profile.archiveReason === "BANNED" ? "Banni définitivement" :
                                            profile.archiveReason === "KICKED" ? "Exclu de la guilde" : "Départ volontaire"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">
                                        {profile.archivedAt ? format(profile.archivedAt, "d MMMM yyyy", { locale: fr }) : "Date inconnue"}
                                    </div>
                                    <div className="text-caption text-muted-foreground uppercase tracking-tighter">
                                        {profile.status === "BANNED" ? "Données Nettoyées" : "Rétention 90j"}
                                    </div>
                                </div>

                                {profile.status === "ARCHIVED" && (
                                    <HistoryWipeButton
                                        profileId={profile.id}
                                        guildId={guildId}
                                        nickname={profile.discordNickname || "Anonyme"}
                                    />
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-surface/30 text-center border-t border-border">
                <p className="text-caption text-muted-foreground italic">
                    Note: Les profils bannis n'ont plus aucune donnée associée (succès, métiers, activitées) par sécurité.
                </p>
            </div>
        </div>
    );
}
