"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { LogOut, Shield } from "lucide-react";

export function SuperAdminHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo & Title */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center group-hover:bg-amber-500/30 transition-all ">
                            <Shield className="w-4 h-4 text-amber-500 drop-shadow-sm" />
                        </div>
                        <span className="font-black text-xl tracking-tight text-white/95 drop-shadow-sm">
                            Sigil<span className="text-amber-500">OS</span> <span className="text-xs font-mono text-amber-500/70 ml-2 tracking-widest uppercase">GOD_MODE</span>
                        </span>
                    </Link>
                    
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 font-bold transition-all rounded-xl"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Déconnexion
                    </Button>
                </div>
            </div>
        </header>
    );
}
