import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Users, Swords, Globe, Calendar, Server, BookOpen, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GuildPresentation } from "@/server/actions/presentation-actions";

export default function PresentationContent({ 
    guild, 
    user, 
    guildId 
}: { 
    guild: GuildPresentation, 
    user: any, 
    guildId: string 
}) {
    const canEdit = user.isAdmin || user.canEditPresentation;

    return (
        <div className="space-y-6">
            <div className="flex justify-end mb-4">
                <div className="flex items-center gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full border text-caption font-black uppercase tracking-widest transition-all",
                                    guild.isRecruiting
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-zinc-500/10 border-white/10 text-zinc-500"
                                )}>
                                    <div className={cn("w-1.5 h-1.5 rounded-full", guild.isRecruiting ? "bg-emerald-500 animate-pulse" : "bg-zinc-600")} />
                                    {guild.isRecruiting ? "Public" : "Désactivé"}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-900 border-white/10 text-caption font-medium text-zinc-300">
                                {guild.isRecruiting
                                    ? "Visible dans l'annuaire public"
                                    : "Caché. Activez-le dans la configuration."}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Link href={`/guilds/${guildId}`} target="_blank">
                        <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5 h-9">
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden md:inline">Voir page publique</span>
                        </Button>
                    </Link>
                    {canEdit && (
                        <Link href={`/dashboard/${guildId}/admin/presentation`}>
                            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-500 font-bold h-9">
                                <Edit className="w-4 h-4" />
                                Modifier
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {!guild.history && (
                <Alert className="bg-emerald-500/5 border-emerald-500/20 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle className="text-xs font-black uppercase tracking-widest">Page non configurée</AlertTitle>
                    <AlertDescription className="text-sm font-medium opacity-80">
                        Votre présentation est actuellement vide. Personnalisez votre histoire et votre équipe pour attirer de nouvelles recrues !
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Banner & Logo */}
                    <Card className="overflow-hidden border-zinc-800 bg-zinc-900/50">
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
                                    <Globe className="w-12 h-12 text-zinc-700" />
                                </div>
                            )}
                        </div>
                        <div className="pt-6 px-6 pb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">{guild.name}</h2>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mb-4">
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
                                    <Badge key={activity} variant="secondary" className="bg-zinc-800 text-zinc-300">
                                        {activity}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* History */}
                    {guild.history ? (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-emerald-400" />
                                    Histoire
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-invert prose-zinc max-w-none">
                                    <p className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                                        {guild.history}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-zinc-800 border-dashed bg-zinc-900/20 py-12 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <BookOpen className="w-6 h-6 text-zinc-600" />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-400 mb-1">Aucune histoire racontée</h3>
                            <p className="text-xs text-zinc-500 max-w-xs">Partagez l'épopée de votre guilde avec le monde.</p>
                        </Card>
                    )}

                    {/* Guild Photo */}
                    {guild.photoUrl && (
                        <Card className="overflow-hidden border-zinc-800 bg-zinc-900/50">
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
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-400" />
                                Organisation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {guild.founder && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <span className="text-xl">👑</span>
                                    <div>
                                        <p className="text-xs font-medium text-amber-500 uppercase tracking-wider">Fondateur</p>
                                        <p className="font-medium text-white">{guild.founder}</p>
                                    </div>
                                </div>
                            )}

                            {(guild.coLeaders ?? []).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider pl-1">Co-leaders</p>
                                    {guild.coLeaders?.map((leader, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                            <span className="text-sm">⭐</span>
                                            <p className="text-sm font-medium text-zinc-200">{leader}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(guild.team ?? []).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider pl-1">Bras Droits</p>
                                    {guild.team?.map((member, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                                            <span className="text-sm">🛡️</span>
                                            <p className="text-sm font-medium text-zinc-200">{member}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recruitment Info */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Swords className="w-5 h-5 text-emerald-400" />
                                Recrutement
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                                <span className="text-sm text-zinc-400">État</span>
                                <Badge variant={guild.isRecruiting ? "default" : "secondary"} className={guild.isRecruiting ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" : ""}>
                                    {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                </Badge>
                            </div>

                            {guild.minLevel && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                                    <span className="text-sm text-zinc-400">Niveau min.</span>
                                    <span className="font-mono font-medium text-white">{guild.minLevel}</span>
                                </div>
                            )}

                            {guild.minSuccesses && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                                    <span className="text-sm text-zinc-400">Succès min.</span>
                                    <span className="font-mono font-medium text-white">{guild.minSuccesses}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Socials */}
                    {guild.discord && (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <span className="w-5 h-5 flex items-center justify-center">💬</span>
                                    Communication
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Link href={guild.discord} target="_blank" className="block">
                                    <Button variant="outline" className="w-full gap-2 border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-400">
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
