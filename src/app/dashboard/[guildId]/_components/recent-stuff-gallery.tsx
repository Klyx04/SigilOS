"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Sparkles, 
    ArrowRight,
    Library
} from "lucide-react";
import Link from "next/link";
import { GalleryBuild } from "@/server/actions/gallery-actions";
import NextImage from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function RecentStuffGallery({ 
    guildId,
    builds = []
}: { 
    guildId: string;
    builds?: GalleryBuild[];
}) {
    // Take 9 builds for a nice 3x3 grid to fill space
    const displayBuilds = (builds || []).slice(0, 9);

    return (
        <Card className="glass-premium border-white/5 h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 flex items-center gap-2">
                        <Library className="w-3 h-3" />
                        Derniers Stuff de la Galerie
                    </CardTitle>
                    <Link href={`/dashboard/${guildId}/galerie-stuff`} className="text-[8px] font-black text-zinc-600 hover:text-blue-400 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-md transition-all">
                        Explorer
                    </Link>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 px-6 pb-6">
                {displayBuilds.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {displayBuilds.map((build) => (
                            <Link key={build.id} href={`/dashboard/${guildId}/galerie-stuff`}>
                                <div className="aspect-[4/3] rounded-xl overflow-hidden relative border border-white/5 hover:border-blue-500/30 transition-all group/item bg-zinc-900">
                                    {build.previewData?.thumbnailUrl ? (
                                        <NextImage 
                                            src={build.previewData.thumbnailUrl} 
                                            alt={build.name} 
                                            fill 
                                            className="object-cover transition-transform duration-700 group-hover/item:scale-110"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center p-4">
                                            <p className="text-[10px] font-black text-zinc-700 text-center uppercase italic leading-tight">{build.name}</p>
                                        </div>
                                    )}
                                    
                                    {/* Overlay Info */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 translate-y-2 group-hover/item:translate-y-0 opacity-0 group-hover/item:opacity-100 transition-all">
                                        <p className="text-[8px] font-black text-white truncate uppercase italic">{build.name}</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Avatar className="h-2 w-2">
                                                <AvatarImage src={build.author?.image ?? undefined} />
                                                <AvatarFallback className="text-[4px]">{build.author?.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[7px] text-zinc-400 font-bold truncate">par {build.author?.name}</span>
                                        </div>
                                    </div>

                                    {/* Votes Badge */}
                                    <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-md px-1 py-0.5 flex items-center gap-1">
                                        <span className="text-[8px] font-black text-blue-400">★ {build.votesCount}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-zinc-600 italic border border-dashed border-white/5 rounded-2xl h-full">
                        <Sparkles className="w-8 h-8 opacity-20 mb-2" />
                        <p className="text-[10px] uppercase font-black tracking-widest text-center">La galerie est vide</p>
                    </div>
                )}
                
                {displayBuilds.length > 0 && (
                    <Link href={`/dashboard/${guildId}/galerie-stuff`} className="flex items-center justify-center gap-2 text-[10px] font-black text-zinc-600 hover:text-blue-400 uppercase tracking-widest pt-5 transition-colors">
                        Parcourir la galerie <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
