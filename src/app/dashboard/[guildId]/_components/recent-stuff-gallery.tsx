"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight, Sword } from "lucide-react";
import Link from "next/link";
import { GalleryBuild } from "@/server/actions/gallery-actions";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";

export function RecentStuffGallery({ 
    guildId,
    builds = []
}: { 
    guildId: string;
    builds?: GalleryBuild[];
}) {
    // Show up to 2 builds as requested
    const displayBuilds = (builds || []).slice(0, 2);

    return (
        <Card className="glass-premium border-border h-full flex flex-col overflow-hidden group">
            <CardHeader className="pb-4 pt-6 px-6 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-success flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        Derniers Stuff de la Galerie
                    </CardTitle>
                    <Link href={`/dashboard/${guildId}/galerie-stuff`} className="text-caption font-black text-muted-foreground hover:text-success uppercase tracking-widest border border-border px-2 py-1 rounded-md transition-all">
                        Explorer la galerie
                    </Link>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
                {displayBuilds.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                        {displayBuilds.map((build) => (
                            <div key={build.id} className="relative group/item scale-95 hover:scale-100 transition-all duration-300">
                                <DofusbookPreview 
                                    url={build.url} 
                                    title={build.name} 
                                    tags={build.tags} 
                                    classId={build.classId ? Number(build.classId) : undefined} 
                                    initialData={build.previewData as any}
                                    guildId={guildId}
                                    className="!max-w-none !p-4 !rounded-[2rem] shadow-2xl"
                                />
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none z-20">
                                    <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-border text-caption font-black text-success uppercase tracking-widest shadow-2xl">
                                        {build.author.name}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground italic border border-dashed border-border rounded-[2rem]">
                        <Sword className="w-10 h-10 opacity-20 mb-3" />
                        <p className="text-caption uppercase font-black tracking-widest">Aucun stuff partagé</p>
                        <p className="text-caption mt-1 opacity-60">Partagez votre optimisation !</p>
                    </div>
                )}

                {displayBuilds.length > 0 && (
                    <div className="mt-8 flex justify-center">
                        <Link href={`/dashboard/${guildId}/galerie-stuff`} className="flex items-center gap-2 text-caption font-black text-muted-foreground hover:text-foreground uppercase tracking-widest group-hover:text-success transition-colors">
                            Voir toute la galerie <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
