/**
 * Sigil King — Deck Generator & Shuffle
 * 66 cartes (ou 68 avec cartes avancées)
 */

export type Suit = "fire" | "water" | "air" | "earth" | "stasis";

export type CardType =
    | "elemental"
    | "incarnation"
    | "ogrest"
    | "eniripsa"
    | "pandawa"
    | "sram"
    | "devastator"
    | "almamater";

export interface Card {
    id: string;
    type: CardType;
    suit?: Suit;
    value?: number; // 1–13 for elemental
    name: string;
}

const SUITS: Suit[] = ["fire", "water", "air", "earth", "stasis"];

let cardCounter = 0;
function generateCardId(): string {
    return `card_${Date.now()}_${++cardCounter}_${Math.random().toString(36).substring(2, 6)}`;
}

export class Deck {
    static generate(advancedCards = false): Card[] {
        const cards: Card[] = [];
        cardCounter = 0;

        // 65 elemental cards (5 suits × 13 values)
        for (const suit of SUITS) {
            for (let v = 1; v <= 13; v++) {
                cards.push({
                    id: generateCardId(),
                    type: "elemental",
                    suit,
                    value: v,
                    name: `${v} ${suit}`,
                });
            }
        }

        // 5 Incarnations (= Pirates in Skull King)
        const incarnationNames = ["Iop", "Sacrieur", "Roublard", "Crâ", "Osamodas"];
        for (const name of incarnationNames) {
            cards.push({
                id: generateCardId(),
                type: "incarnation",
                name: `Incarnation ${name}`,
            });
        }

        // 1 Ogrest (= Skull King)
        cards.push({ id: generateCardId(), type: "ogrest", name: "Ogrest" });

        // 2 Éniripsa (= Mermaids)
        for (let i = 1; i <= 2; i++) {
            cards.push({ id: generateCardId(), type: "eniripsa", name: `Éniripsa ${i}` });
        }

        // 5 Pandawa (= Escape cards)
        for (let i = 1; i <= 5; i++) {
            cards.push({ id: generateCardId(), type: "pandawa", name: `Pandawa ${i}` });
        }

        // 1 Sram (= Tigress)
        cards.push({ id: generateCardId(), type: "sram", name: "Sram" });

        // Advanced cards (optional)
        if (advancedCards) {
            cards.push({ id: generateCardId(), type: "devastator", name: "Dévastateur" });
            cards.push({ id: generateCardId(), type: "almamater", name: "Alma Mater" });
        }

        return Deck.shuffle(cards);
    }

    static shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    static deal(deck: Card[], playerCount: number, round: number): Card[][] {
        const hands: Card[][] = Array.from({ length: playerCount }, () => []);
        for (let i = 0; i < round; i++) {
            for (let p = 0; p < playerCount; p++) {
                const card = deck.pop();
                if (card) hands[p].push(card);
            }
        }
        return hands;
    }
}
