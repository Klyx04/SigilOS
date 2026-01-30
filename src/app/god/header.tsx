"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { LogOut, Shield } from "lucide-react";

export function SuperAdminHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo & Title */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-all">
                            <Shield className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white/90">
                            Sigil<span className="text-amber-500">OS</span> <span className="text-xs font-mono text-amber-500/50 ml-1">GOD_MODE</span>
                        </span>
                    </Link>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="text-zinc-500 hover:text-white"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Déconnexion
                    </Button>
                </div>
            </div>
        </header>
    );
}
