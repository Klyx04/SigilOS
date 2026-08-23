"use client";

import data from '@emoji-mart/data'
import dynamic from 'next/dynamic'

const Picker = dynamic(() => import('@emoji-mart/react'), {
    ssr: false,
    loading: () => <div className="w-[352px] h-[435px] bg-surface rounded-xl animate-pulse" />
})
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

// i18n configuration for French
const i18n = {
    search: 'Rechercher',
    search_no_results: 'Aucun résultat trouvé',
    categories: {
        search: 'Résultats de recherche',
        recent: 'Fréquemment utilisés',
        smileys: 'Sourires et émotions',
        people: 'Personnes et corps',
        nature: 'Animaux et nature',
        foods: 'Nourriture et boissons',
        activity: 'Activités',
        places: 'Voyages et lieux',
        objects: 'Objets',
        symbols: 'Symboles',
        flags: 'Drapeaux',
        custom: 'Personnalisés',
    },
};

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
    const { theme } = useTheme();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className="inline-block">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:bg-surface hover:text-foreground transition-all"
                        title="Insérer un Emoji"
                    >
                        <Smile className="w-4 h-4" />
                    </Button>
                </div>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-auto p-0 bg-transparent border-none shadow-none overflow-visible rounded-2xl"
            >
                <div className="animate-in zoom-in-95 duration-200">
                    <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        locale="fr"
                        i18n={i18n}
                        set="native"
                        previewPosition="none"
                        skinTonePosition="none"
                        navPosition="top"
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
