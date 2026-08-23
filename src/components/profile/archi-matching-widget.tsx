"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Gift, Copy, Check, Bug } from "lucide-react";
import { getProfileMatchingArchis, type ProfileMatchData } from "@/server/actions/ocre-actions";
import { toast } from "sonner";

interface ArchiMatchingWidgetProps {
    guildId: string;
    profileId: string;
    ownerDisplayName: string;
}

export function ArchiMatchingWidget({
    guildId,
    profileId,
    ownerDisplayName
}: ArchiMatchingWidgetProps) {
    const [matchData, setMatchData] = useState<ProfileMatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedMsg, setCopiedMsg] = useState(false);

    const loadMatches = async () => {
        setLoading(true);
        setError(null);
        const result = await getProfileMatchingArchis({ guildId, targetProfileId: profileId });

        if (result.success) {
            setMatchData(result.data ?? null);
        } else {
            setError(result.error || "Erreur lors du chargement");
        }
        setLoading(false);
    };

    useEffect(() => {
        loadMatches();
    }, [guildId, profileId]);

    const handleCopyMP = () => {
        if (!matchData || matchData.matches.length === 0) return;

        const monsterNames = matchData.matches.slice(0, 3).map(m => m.nom).join(", ");
        const extra = matchData.matches.length > 3 ? ` et ${matchData.matches.length - 3} autres` : "";
        const message = `/w ${ownerDisplayName} Salut ! Tu aurais un de ces archis à échanger ? ${monsterNames}${extra} :)`;

        navigator.clipboard.writeText(message);
        setCopiedMsg(true);
        toast.success("Message copié !");
        setTimeout(() => setCopiedMsg(false), 2000);
    };

    // Don't render anything while loading, if no data, or if no matches.
    // This avoids a flash of an empty "Échanges possibles" card at the bottom
    // of the member profile while the matching data is being fetched.
    if (loading || !matchData || matchData.matches.length === 0) {
        return null;
    }

    return (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Gift className="h-5 w-5 text-primary" />
                    Échanges possibles
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{error}</p>
                ) : matchData && matchData.matches.length > 0 ? (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{ownerDisplayName}</span> a{" "}
                            <span className="text-primary font-semibold">{matchData.matches.length}</span>{" "}
                            archi{matchData.matches.length > 1 ? "s" : ""} que vous recherchez :
                        </p>

                        <ScrollArea className="h-[160px]">
                            <div className="grid grid-cols-2 gap-2 pr-2">
                                {matchData.matches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/50"
                                    >
                                        {match.imageUrl && (
                                            <div className="relative w-8 h-8 shrink-0 rounded overflow-hidden bg-black/20">
                                                <Image
                                                    src={match.imageUrl}
                                                    alt={match.nom}
                                                    fill
                                                    className="object-contain"
                                                    sizes="32px"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{match.nom}</p>
                                            <p className="text-caption text-muted-foreground truncate">
                                                {match.zone}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 text-caption px-1.5 bg-warning/10 text-warning border-warning/30"
                                        >
                                            x{match.ownerQuantite}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="flex gap-2 pt-2 border-t border-border/30">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2"
                                onClick={handleCopyMP}
                            >
                                {copiedMsg ? (
                                    <Check className="h-4 w-4 text-success" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                                Copier MP
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                className="flex-1 gap-2"
                                asChild
                            >
                                <Link href={`/dashboard/${guildId}/archimonstres`}>
                                    <Bug className="h-4 w-4" />
                                    Bourse
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
