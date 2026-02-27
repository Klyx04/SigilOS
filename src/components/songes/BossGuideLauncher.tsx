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
                className="gap-2 border-fuchsia-500/30 hover:border-fuchsia-500/80 hover:bg-fuchsia-950/30 text-fuchsia-300 font-bold"
            >
                <BookOpen className="w-5 h-5 shadow-fuchsia-500/50 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" />
                Guide Boss
            </Button>

            <BossGuide isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
