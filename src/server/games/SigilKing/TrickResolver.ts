/**
 * Sigil King — Trick Resolution Engine
 * 
 * Hierarchy: Éniripsa > Ogrest > Incarnations > Stasis > Lead Suit > Other > Pandawa
 * 
 * Special cases:
 * - Éniripsa captures Ogrest → +50 bonus
 * - Incarnation captures Ogrest → +30 bonus
 * - Two Incarnations in same trick → first played wins
 * - All Pandawa → first one "wins" (reluctantly)
 * - Devastator → trick cancelled, nobody wins
 * - Alma Mater → steals the trick from natural winner
 * - Sram → player chooses Incarnation or Pandawa role
 */

import type { Card, Suit } from "./Deck";

export interface PlayedCard {
    playerId: string;
    card: Card;
    sramChoice?: "incarnation" | "pandawa";
}

export type BonusType = "eniripsa_captures_ogrest" | "incarnation_captures_ogrest" | null;

export interface TrickOutcome {
    winnerId: string | null; // null = cancelled (Devastator)
    bonusTriggered: BonusType;
}

export class TrickResolver {
    resolve(cards: PlayedCard[]): TrickOutcome {
        if (cards.length === 0) {
            return { winnerId: null, bonusTriggered: null };
        }

        // Case 1: Devastator → trick cancelled
        if (cards.some(pc => pc.card.type === "devastator")) {
            return { winnerId: null, bonusTriggered: null };
        }

        // Natural resolution
        const naturalWinner = this.resolveNatural(cards);
        const bonus = this.checkBonus(cards, naturalWinner.playerId);

        // Case 2: Alma Mater → steals the trick
        const almaMater = cards.find(pc => pc.card.type === "almamater");
        if (almaMater && almaMater.playerId !== naturalWinner.playerId) {
            return { winnerId: almaMater.playerId, bonusTriggered: bonus };
        }

        return { winnerId: naturalWinner.playerId, bonusTriggered: bonus };
    }

    private resolveNatural(cards: PlayedCard[]): PlayedCard {
        // 1. Éniripsa (first played wins among multiple)
        const mermaids = cards.filter(pc => pc.card.type === "eniripsa");
        if (mermaids.length > 0) return mermaids[0];

        // 2. Ogrest
        const ogrest = cards.find(pc => pc.card.type === "ogrest");
        if (ogrest) return ogrest;

        // 3. Incarnations + Sram(incarnation) — first played wins
        const pirates = cards.filter(pc =>
            pc.card.type === "incarnation" ||
            (pc.card.type === "sram" && pc.sramChoice === "incarnation")
        );
        if (pirates.length > 0) return pirates[0];

        // 4. Stasis (trump suit — highest value)
        const stasisCards = cards.filter(pc =>
            pc.card.type === "elemental" && pc.card.suit === "stasis"
        );
        if (stasisCards.length > 0) {
            return stasisCards.reduce((max, pc) =>
                pc.card.value! > max.card.value! ? pc : max
            );
        }

        // 5. Lead suit (highest value)
        const leadSuit = this.getLeadSuit(cards);
        if (leadSuit) {
            const leadCards = cards.filter(pc =>
                pc.card.type === "elemental" && pc.card.suit === leadSuit
            );
            if (leadCards.length > 0) {
                return leadCards.reduce((max, pc) =>
                    pc.card.value! > max.card.value! ? pc : max
                );
            }
        }

        // 6. All Pandawa → first one takes (reluctantly)
        return cards[0];
    }

    getLeadSuit(cards: PlayedCard[]): Suit | null {
        for (const pc of cards) {
            if (pc.card.type === "elemental") return pc.card.suit!;
        }
        return null;
    }

    private checkBonus(cards: PlayedCard[], winnerId: string): BonusType {
        if (!cards.some(pc => pc.card.type === "ogrest")) return null;
        const winner = cards.find(pc => pc.playerId === winnerId);
        if (!winner) return null;
        if (winner.card.type === "eniripsa") return "eniripsa_captures_ogrest";
        if (winner.card.type === "incarnation" ||
            (winner.card.type === "sram" && winner.sramChoice === "incarnation")) {
            return "incarnation_captures_ogrest";
        }
        return null;
    }

    /**
     * Check if a player can legally play a card given the current lead suit and their hand.
     * Rule: must follow lead suit if possible. Special cards can always be played.
     */
    canPlayCard(card: Card, hand: Card[], leadSuit: Suit | null): boolean {
        // Special cards can always be played
        if (card.type !== "elemental") return true;

        // No lead suit yet → anything goes
        if (!leadSuit) return true;

        // Card matches lead suit → always valid
        if (card.suit === leadSuit) return true;

        // Card doesn't match → only valid if player has NO cards of lead suit
        const hasLeadSuit = hand.some(c => c.type === "elemental" && c.suit === leadSuit);
        return !hasLeadSuit;
    }
}
