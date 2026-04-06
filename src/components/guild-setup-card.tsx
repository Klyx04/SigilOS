"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2 } from "lucide-react";
import { onboardGuild } from "@/server/actions/admin-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // Assuming sonner or use a simple alert if not available

type GuildProps = {
    id: string;
    name: string;
    icon: string | null;
    isBotPresent?: boolean;
    clientId?: string;
};

export function GuildSetupCard({ guild, clientId }: { guild: GuildProps, clientId?: string }) {
    const [loading, setLoading] = useState(false);

    // If bot is missing, we need to invite it first
    const needsInvite = guild.isBotPresent === false;

    const handleSetup = async () => {
        if (needsInvite) {
            // Redirect to Discord OAuth2
            if (!clientId) {
                toast.error("Configuration Discord manquante (Client ID)");
                return;
            }

            // Using window.location.origin ensures we redirect back to the correct environment (localhost/beta/prod)
            const redirectUri = encodeURIComponent(`${window.location.origin}/onboarding/success`);
            const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot&redirect_uri=${redirectUri}&response_type=code`;
            
            // Open in a new tab to keep the context, but we list for completion
            window.open(inviteUrl, "_blank");
            return;
        }

        setLoading(true);
        try {
            const result = await onboardGuild(guild.id);
            if (result.success) {
                // Force a hard reload to ensure state is absolutely fresh
                window.location.reload();
            } else {
                console.error(result.error);
                toast.error("Erreur lors du déploiement: " + result.error);
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur inattendue");
            setLoading(false);
        }
    };

    // Auto-refresh when bot is authorized in the other tab
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "sigilos-bot-invited" && event.origin === window.location.origin) {
                window.location.reload();
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <Card className="bg-black/20 border-white/5 border-dashed hover:border-white/20 transition-all cursor-default">
            <CardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Avatar className="h-12 w-12 border-2 border-white/5 grayscale opacity-70">
                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                            {guild.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden opacity-70">
                        <h3 className="font-bold truncate text-foreground">
                            {guild.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {needsInvite ? "Bot absent - Invitation requise" : "Prêt pour déploiement"}
                        </p>
                    </div>
                </div>

                <Button
                    size="sm"
                    variant={needsInvite ? "secondary" : "outline"}
                    className={needsInvite
                        ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40"
                        : "border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                    }
                    onClick={handleSetup}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {loading ? "..." : (needsInvite ? "Inviter le Bot" : "Déployer")}
                </Button>
            </CardContent>
        </Card>
    );
}
