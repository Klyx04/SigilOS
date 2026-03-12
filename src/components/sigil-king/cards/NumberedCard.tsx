import { memo } from "react";
import { motion } from "framer-motion";

export type Suit = "fire" | "water" | "air" | "earth" | "stasis";

const SUIT_PATHS: Record<Suit, { color: string; path: string }> = {
    fire:   { color: "#E8472A", path: "M12 2 C12 2 8 7 8 11 C8 14.3 9.8 16 12 16 C14.2 16 16 14.3 16 11 C16 7 12 2 12 2Z" },
    water:  { color: "#2A8CE8", path: "M12 3 C9 8 6 10 6 14 C6 17.3 8.7 20 12 20 C15.3 20 18 17.3 18 14 C18 10 15 8 12 3Z" },
    air:    { color: "#7BC96F", path: "M12 4 C12 4 6 8 6 12 C6 14 7 15 8 15 C9 15 10 14 10 13 L10 15 C10 17 11 18 12 18 C13 18 14 17 14 15 L14 13 C14 14 15 15 16 15 C17 15 18 14 18 12 C18 8 12 4 12 4Z" },
    earth:  { color: "#C8960C", path: "M12 3 L15 8 L20 8 L16 12 L18 18 L12 15 L6 18 L8 12 L4 8 L9 8 Z" },
    stasis: { color: "#9B59B6", path: "M12 2 L14 7 L19 7 L15 11 L17 17 L12 13 L7 17 L9 11 L5 7 L10 7 Z M12 6 L13 9 L16 9 L14 11 L15 14 L12 12 L9 14 L10 11 L8 9 L11 9 Z" },
};

const PIP_LAYOUTS: Record<number, { x: number; y: number; r?: number }[]> = {
    1:  [{ x: 50, y: 50 }],
    2:  [{ x: 50, y: 25 }, { x: 50, y: 75, r: 180 }],
    3:  [{ x: 50, y: 20 }, { x: 50, y: 50 }, { x: 50, y: 80, r: 180 }],
    4:  [{ x: 30, y: 25 }, { x: 70, y: 25 }, { x: 30, y: 75, r: 180 }, { x: 70, y: 75, r: 180 }],
    5:  [{ x: 30, y: 25 }, { x: 70, y: 25 }, { x: 50, y: 50 }, { x: 30, y: 75, r: 180 }, { x: 70, y: 75, r: 180 }],
    6:  [{ x: 30, y: 22 }, { x: 70, y: 22 }, { x: 30, y: 50 }, { x: 70, y: 50 }, { x: 30, y: 78, r: 180 }, { x: 70, y: 78, r: 180 }],
    7:  [{ x: 30, y: 20 }, { x: 70, y: 20 }, { x: 50, y: 35 }, { x: 30, y: 50 }, { x: 70, y: 50 }, { x: 30, y: 75, r: 180 }, { x: 70, y: 75, r: 180 }],
    8:  [{ x: 30, y: 20 }, { x: 70, y: 20 }, { x: 50, y: 33 }, { x: 30, y: 50 }, { x: 70, y: 50 }, { x: 50, y: 65, r: 180 }, { x: 30, y: 78, r: 180 }, { x: 70, y: 78, r: 180 }],
    9:  [{ x: 30, y: 18 }, { x: 70, y: 18 }, { x: 30, y: 36 }, { x: 70, y: 36 }, { x: 50, y: 50 }, { x: 30, y: 64, r: 180 }, { x: 70, y: 64, r: 180 }, { x: 30, y: 82, r: 180 }, { x: 70, y: 82, r: 180 }],
    10: [{ x: 30, y: 18 }, { x: 70, y: 18 }, { x: 50, y: 28 }, { x: 30, y: 40 }, { x: 70, y: 40 }, { x: 30, y: 60, r: 180 }, { x: 70, y: 60, r: 180 }, { x: 50, y: 72, r: 180 }, { x: 30, y: 82, r: 180 }, { x: 70, y: 82, r: 180 }],
    11: [{ x: 50, y: 50 }],
    12: [{ x: 50, y: 50 }],
    13: [{ x: 50, y: 50 }],
};

const FIGURE_NAMES: Record<number, string> = { 11: "Acolyte", 12: "Champion", 13: "Seigneur" };
const DISPLAY_VALUE = (v: number) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[v] ?? String(v));

const SIZES = {
    sm: { w: 56,  h: 84,  num: "text-[10px]", icon: 10 },
    md: { w: 80,  h: 120, num: "text-[14px]", icon: 14 },
    lg: { w: 110, h: 165, num: "text-[18px]", icon: 20 },
};

const SUIT_COLORS: Record<Suit, string> = {
    fire: "#E8472A",
    water: "#2A8CE8",
    air: "#7BC96F",
    earth: "#C8960C",
    stasis: "#9B59B6",
};

interface Props {
    suit: Suit;
    value: number;
    cardId: string;
    size?: "sm" | "md" | "lg";
    playable?: boolean;
    selected?: boolean;
    onClick?: () => void;
}

export const NumberedCard = memo(function NumberedCard({ suit, value, cardId, size = "md", playable = true, selected = false, onClick }: Props) {
    const dim = SIZES[size];
    const color = SUIT_COLORS[suit];
    const bgSuit = suit;
    
    return (
        <motion.div
            layoutId={cardId}
            style={{ width: dim.w, height: dim.h }}
            className={`relative rounded-lg overflow-hidden border transition-all select-none
                ${!playable ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer"}
                ${selected ? "ring-2 ring-amber-400 z-10 shadow-[0_0_20px_rgba(251,191,36,0.5)]" : "border-white/10 shadow-lg"}`}
            onClick={playable ? onClick : undefined}
            whileHover={playable ? { y: -8, scale: 1.05, transition: { type: "spring", stiffness: 400, damping: 20 } } : {}}
        >
            {/* Background Texture Template */}
            <img 
                src={`/images/sigil-king/cartes-chiffres/bg-${bgSuit}.png`} 
                className="absolute inset-0 w-full h-full object-cover"
                alt=""
            />
            <div className="absolute inset-0 bg-black/10" />

            {/* Corner Rank & Icon (Top Left) */}
            <div className="absolute top-1.5 left-1.5 flex flex-col items-center">
                <span className={`${dim.num} font-black italic leading-none`} style={{ color, fontFamily: "'Cinzel', serif" }}>
                    {DISPLAY_VALUE(value)}
                </span>
                <img 
                    src={`/images/sigil-king/icones-elements/icon-${suit}.png`} 
                    style={{ width: dim.icon, height: dim.icon }}
                    className="mt-0.5"
                    alt=""
                />
            </div>

            {/* Corner Rank & Icon (Bottom Right, Upside Down) */}
            <div className="absolute bottom-1.5 right-1.5 flex flex-col items-center rotate-180">
                <span className={`${dim.num} font-black italic leading-none`} style={{ color, fontFamily: "'Cinzel', serif" }}>
                    {DISPLAY_VALUE(value)}
                </span>
                <img 
                    src={`/images/sigil-king/icones-elements/icon-${suit}.png`} 
                    style={{ width: dim.icon, height: dim.icon }}
                    className="mt-0.5"
                    alt=""
                />
            </div>

            {/* Center Art / Value */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative group">
                    <motion.span 
                        animate={selected ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`font-black italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]
                            ${size === "lg" ? "text-5xl" : size === "md" ? "text-4xl" : "text-2xl"}`}
                        style={{ color, fontFamily: "'Cinzel', serif" }}
                    >
                        {DISPLAY_VALUE(value)}
                    </motion.span>
                    {/* Secondary icon behind big number */}
                    <img 
                        src={`/images/sigil-king/icones-elements/icon-${suit}.png`} 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-10 pointer-events-none"
                        alt=""
                    />
                </div>
            </div>

            {/* Selection Glow Overlay */}
            {selected && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-amber-400/10 pointer-events-none"
                />
            )}
        </motion.div>
    );
});
