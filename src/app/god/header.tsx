"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { LogOut, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function SuperAdminHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80  shadow-xs">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo & Title */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center group-hover:bg-warning/30 transition-all ">
                            <Shield className="w-4 h-4 text-warning drop-shadow-sm" />
                        </div>
                        <span className="font-semibold text-xl tracking-tight text-foreground drop-shadow-sm">
                            Sigil<span className="text-warning">OS</span> <span className="text-xs font-mono text-warning/70 ml-2 tracking-wide uppercase">GOD_MODE</span>
                        </span>
                    </Link>
                    
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <div className="p-1 rounded-xl bg-surface border border-border shrink-0">
                        <ThemeToggle />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold transition-all rounded-xl"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Déconnexion
                    </Button>
                </div>
            </div>
        </header>
    );
}
