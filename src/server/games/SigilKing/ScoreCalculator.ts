/**
 * Sigil King — Score Calculator
 * 
 * Scoring rules:
 * - Exact bid (bid >= 1): +20 × bid
 * - Bid 0 success: +10 × round_number  
 * - Failed bid: -10 × abs(bid - tricks_won)
 * - Bonus: Éniripsa captures Ogrest → +50
 * - Bonus: Incarnation captures Ogrest → +30
 * - Storm mode: bid = all cards AND success → score × 2
 */

import type { BonusType } from "./TrickResolver";

export interface RoundPlayerResult {
    playerId: string;
    bid: number;
    tricksWon: number;
    bonusPoints: number;
    roundScore: number;
    totalScore: number;
}

export class ScoreCalculator {
    calculateRoundScore(
        bid: number,
        tricksWon: number,
        round: number,
        stormMode: boolean
    ): number {
        let score = 0;

        if (bid === 0) {
            // Bid 0: risky but rewarding
            score = tricksWon === 0 ? 10 * round : -10 * round;
        } else if (tricksWon === bid) {
            // Exact bid
            score = 20 * bid;
            // Storm mode: bid == round (all tricks) → double score
            if (stormMode && bid === round) score *= 2;
        } else {
            // Failed bid
            score = -10 * Math.abs(bid - tricksWon);
        }

        return score;
    }

    calculateBonusPoints(bonuses: BonusType[]): number {
        return bonuses.reduce((total, bonus) => {
            if (bonus === "eniripsa_captures_ogrest") return total + 50;
            if (bonus === "incarnation_captures_ogrest") return total + 30;
            return total;
        }, 0);
    }
}
