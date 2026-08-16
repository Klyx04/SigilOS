import { getGuildPresentation } from "@/server/actions/presentation-actions";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Users, MessageSquare, Swords, Globe, Calendar, Server, BookOpen, Eye, EyeOff, Sparkles } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import AccessDenied from "@/components/access-denied";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function GuildMemberPresentationPage({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId, false);
    const user = await getUserContext(guildId);

    if (!user.canViewPresentation) {
        return <AccessDenied />;
    }

    if (!guild) {
        notFound();
    }

    const canEdit = user.isAdmin || user.canEditPresentation;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="presentation-header">
            <UnifiedModuleHeader
                title="Présentation de la Guilde"
                description="Informations visibles par les membres et le public."
                icon={BookOpen}
                iconColor="#a855f7"
                backHref={`/dashboard/${guildId}`}
                actions={
                    <div className="flex items-center gap-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-caption font-black uppercase tracking-widest transition-all",
                                        guild.isRecruiting
                                            ? "bg-success/10 border-success/20 text-success"
                                            : "bg-muted/10 border-border text-muted-foreground"
                                    )}>
                                        <div className={cn("w-1.5 h-1.5 rounded-full", guild.isRecruiting ? "bg-success animate-pulse" : "bg-muted")} />
                                        {guild.isRecruiting ? "Public" : "Désactivé"}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-surface border-border text-caption font-medium text-foreground">
                                    {guild.isRecruiting
                                        ? "Visible dans l'annuaire public"
                                        : "Caché. Activez-le dans la configuration."}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <Link href={`/guilds/${guildId}`} target="_blank" data-tour="presentation-public">
                            <Button variant="outline" size="sm" className="gap-2 border-border hover:bg-surface h-9">
                                <ExternalLink className="w-4 h-4" />
                                <span className="hidden md:inline">Voir page publique</span>
                            </Button>
                        </Link>
                        <ModuleTourReplayButton phase="presentation" />
                        {canEdit && (
                            <Link href={`/dashboard/${guildId}/admin/presentation`}>
                                <Button size="sm" className="gap-2 bg-info hover:bg-info font-black h-9">
                                    <Edit className="w-4 h-4" />
                                    Modifier
                                </Button>
                            </Link>
                        )}
                    </div>
                }
            />
            </div>

            {!guild.history && (
                <Alert className="bg-info/5 border-info/20 text-info">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle className="text-xs font-black uppercase tracking-widest">Page non configurée</AlertTitle>
                    <AlertDescription className="text-sm font-medium opacity-80">
                        Votre présentation est actuellement vide. Personnalisez votre histoire et votre équipe pour attirer de nouvelles recrues !
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="presentation-board">
                {/* Main Info Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Banner & Logo */}
                    <Card className="overflow-hidden border-border bg-surface/50">
                        <div className="relative h-48 md:h-64 w-full">
                            {guild.bannerType === "custom" && guild.bannerUrl ? (
                                <Image
                                    src={guild.bannerUrl}
                                    alt="Guild Banner"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-linear-to-r from-zinc-800 to-zinc-900 flex items-center justify-center">
                                    <Globe className="w-12 h-12 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="pt-6 px-6 pb-6">
                            <h2 className="text-2xl font-bold text-foreground mb-2">{guild.name}</h2>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                                {guild.server && (
                                    <div className="flex items-center gap-1.5">
                                        <Server className="w-4 h-4" />
                                        <span>{guild.server}</span>
                                    </div>
                                )}
                                {guild.foundedDate && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        <span>Guilde fondée le {new Date(guild.foundedDate).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {guild.activities?.map((activity) => (
                                    <Badge key={activity} variant="secondary" className="bg-elevated text-foreground">
                                        {activity}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* History */}
                    {guild.history ? (
                        <Card className="border-border bg-surface/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-info" />
                                    Histoire
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-invert prose-zinc max-w-none">
                                    <p className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
                                        {guild.history}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-border border-dashed bg-surface/20 py-12 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-4">
                                <BookOpen className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-sm font-bold text-muted-foreground mb-1">Aucune histoire racontée</h3>
                            <p className="text-xs text-muted-foreground max-w-xs">Partagez l'épopée de votre guilde avec le monde.</p>
                        </Card>
                    )}

                    {/* Guild Photo */}
                    {guild.photoUrl && (
                        <Card className="overflow-hidden border-border bg-surface/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <span className="text-xl">🖼️</span>
                                    La Guilde en Image
                                </CardTitle>
                            </CardHeader>
                            <div className="relative aspect-video w-full">
                                <Image
                                    src={guild.photoUrl}
                                    alt={`Photo de la guilde ${guild.name}`}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </Card>
                    )}
                </div>

                {/* Sidebar Info Column */}
                <div className="space-y-6">
                    {/* Organization */}
                    <Card className="border-border bg-surface/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-info" />
                                Organisation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {guild.founder && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                                    <span className="text-xl">👑</span>
                                    <div>
                                        <p className="text-xs font-medium text-warning uppercase tracking-wider">Fondateur</p>
                                        <p className="font-medium text-foreground">{guild.founder}</p>
                                    </div>
                                </div>
                            )}

                            {(guild.coLeaders ?? []).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1">Co-leaders</p>
                                    {guild.coLeaders?.map((leader, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                            <span className="text-sm">⭐</span>
                                            <p className="text-sm font-medium text-foreground">{leader}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(guild.team ?? []).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1">Bras Droits</p>
                                    {guild.team?.map((member, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-info/5 border border-info/10">
                                            <span className="text-sm">🛡️</span>
                                            <p className="text-sm font-medium text-foreground">{member}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recruitment Info */}
                    <Card className="border-border bg-surface/50" data-tour="presentation-recrutement">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Swords className="w-5 h-5 text-pink-400" />
                                Recrutement
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-elevated/50">
                                <span className="text-sm text-muted-foreground">État</span>
                                <Badge variant={guild.isRecruiting ? "default" : "secondary"} className={guild.isRecruiting ? "bg-success/20 text-success hover:bg-success/20" : ""}>
                                    {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                </Badge>
                            </div>

                            {guild.minLevel && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-elevated/50">
                                    <span className="text-sm text-muted-foreground">Niveau min.</span>
                                    <span className="font-mono font-medium text-foreground">{guild.minLevel}</span>
                                </div>
                            )}

                            {guild.minSuccesses && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-elevated/50">
                                    <span className="text-sm text-muted-foreground">Succès min.</span>
                                    <span className="font-mono font-medium text-foreground">{guild.minSuccesses}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Socials */}
                    {guild.discord && (
                        <Card className="border-border bg-surface/50" data-tour="presentation-communication">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-info" />
                                    Communication
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Link href={guild.discord} target="_blank" className="block">
                                    <Button variant="outline" className="w-full gap-2 border-info/20 hover:bg-info/10 hover:text-info">
                                        Rejoindre le Discord
                                        <ExternalLink className="w-3 h-3" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function Shield(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
    );
}
