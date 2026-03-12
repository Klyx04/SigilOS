/**
 * CardComponent — Unified card wrapper
 * Routes to NumberedCard or SpecialCard based on type.
 */
import { memo } from "react";
import { NumberedCard, Suit } from "./NumberedCard";
import { SpecialCard, CardType } from "./SpecialCard";
import { motion } from "framer-motion";

export interface Card {
    id: string;
    type: CardType | "elemental";
    suit?: Suit;
    value?: number;
    name: string;
}

interface Props {
    card: Card;
    size?: "sm" | "md" | "lg";
    playable?: boolean;
    selected?: boolean;
    sramChoice?: "incarnation" | "pandawa";
    onClick?: () => void;
}

export const CardComponent = memo(function CardComponent({ card, size = "md", playable = true, selected = false, sramChoice, onClick }: Props) {
    if (card.type === "elemental" && card.suit && card.value !== undefined) {
        return (
            <NumberedCard
                suit={card.suit}
                value={card.value}
                cardId={card.id}
                size={size}
                playable={playable}
                selected={selected}
                onClick={onClick}
            />
        );
    }

    return (
        <SpecialCard
            type={card.type as CardType}
            name={card.name}
            cardId={card.id}
            size={size}
            playable={playable}
            selected={selected}
            sramChoice={sramChoice}
            onClick={onClick}
        />
    );
});

// Card back (deck face-down)
const DIM = { sm: { w: 56, h: 84 }, md: { w: 80, h: 120 }, lg: { w: 110, h: 165 } };

export const CardBack = memo(function CardBack({ size = "md", cardId }: { size?: "sm" | "md" | "lg"; cardId?: string }) {
    const { w, h } = DIM[size];
    return (
        <motion.div
            layoutId={cardId}
            style={{ width: w, height: h }}
            className="relative rounded-lg overflow-hidden border border-amber-900 shadow-xl"
        >
            <img 
                src="/images/sigil-king/assets-table/card-back.png" 
                className="w-full h-full object-cover" 
                alt="Sigil King Card Back"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </motion.div>
    );
});
