"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

type Props = {
    guild: {
        name: string;
        iconUrl: string | null;
    };
};

export function PrivateGuildView({ guild }: Props) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black" />

            <Card className="w-full max-w-md bg-zinc-900/50 border-white/10 p-8 relative z-10 backdrop-blur-xl">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full" />
                        <Avatar className="h-24 w-24 border-4 border-zinc-950 shadow-xl relative">
                            <AvatarImage src={guild.iconUrl || undefined} />
                            <AvatarFallback className="text-2xl bg-zinc-800 text-zinc-400">
                                {guild.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-zinc-900 p-1.5 rounded-full border border-white/10">
                            <Lock className="w-5 h-5 text-indigo-400" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white">{guild.name}</h1>
                        <p className="text-zinc-400 text-sm">
                            Cette guilde est privée ou n'a pas encore activé sa page de présentation.
                        </p>
                    </div>

                    <div className="pt-4 w-full">
                        <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 hover:text-white">
                            <Link href="/guilds">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Retour à l'annuaire
                            </Link>
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
