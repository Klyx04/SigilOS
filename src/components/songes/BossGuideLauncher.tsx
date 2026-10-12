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
                className="h-11 px-5 text-sm gap-2.5 border-fuchsia-500/30 hover:border-fuchsia-500/60 bg-fuchsia-500/5 hover:bg-fuchsia-500/10 text-fuchsia-300 font-bold rounded-xl shadow-sm transition-all"
            >
                <BookOpen className="w-4 h-4 text-fuchsia-400" />
                Guide Boss Songes
            </Button>

            <BossGuide isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
