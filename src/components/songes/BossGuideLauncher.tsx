"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { BossGuide } from "@/components/songes/BossGuide";

export function BossGuideLauncher() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                variant="outline"
                className="h-14 px-8 text-lg gap-3 border-fuchsia-500/30 hover:border-fuchsia-500/80 hover:bg-fuchsia-950/30 text-fuchsia-300 font-black uppercase tracking-wider flex-1 min-w-[240px] shadow-[0_0_20px_rgba(217,70,239,0.1)] hover:shadow-[0_0_25px_rgba(217,70,239,0.2)] transition-all"
            >
                <BookOpen className="w-6 h-6 shadow-fuchsia-500/50 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" />
                Guide Boss Songes
            </Button>

            <BossGuide isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
