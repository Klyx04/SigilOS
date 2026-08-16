"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
    variant?: "default" | "ghost";
    className?: string;
}

export function SignOutButton({ variant = "default", className = "" }: SignOutButtonProps) {
    const baseStyles = "px-6 py-2 rounded-lg transition-colors font-medium flex items-center gap-2";
    const variantStyles = variant === "ghost"
        ? "bg-elevated hover:bg-muted text-foreground"
        : "bg-background text-foreground hover:bg-surface font-bold";

    return (
        <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`${baseStyles} ${variantStyles} ${className}`}
        >
            <LogOut className="w-4 h-4" />
            Se déconnecter
        </button>
    );
}
