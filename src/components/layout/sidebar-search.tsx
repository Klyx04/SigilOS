"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
    Search, 
    LayoutDashboard, 
    Users, 
    Sparkles, 
    BookOpen, 
    ScrollText, 
    Trophy, 
    Compass, 
    Key, 
    Activity, 
    Shield, 
    Command as CommandIcon 
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type NavItem = {
    title: string;
    href: string;
    icon: any;
    category: string;
};

export function SidebarSearch({ guildId }: { guildId: string }) {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        // We only respond to click, not Cmd+K which is for global CommandMenu
    }, []);

    const searchItems: NavItem[] = [
        { title: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, category: "Général" },
        { title: "Documentation", href: `/docs`, icon: BookOpen, category: "Général" },
        
        { title: "Annuaire des membres", href: `/dashboard/${guildId}/members`, icon: Users, category: "Informations" },
        { title: "La Guilde (Hub)", href: `/dashboard/${guildId}/guild-hub`, icon: Sparkles, category: "Informations" },
        { title: "Ressources communautaires", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, category: "Informations" },
        
        { title: "Missions hebdomadaires", href: `/dashboard/${guildId}/missions`, icon: ScrollText, category: "Progression" },
        { title: "Songes Infinis", href: `/dashboard/${guildId}/songes`, icon: Sparkles, category: "Progression" },
        { title: "Ladder / Succès", href: `/dashboard/${guildId}/ladder`, icon: Trophy, category: "Progression" },
        
        { title: "Galerie de Stuff", href: `/dashboard/${guildId}/stuff-hub`, icon: Sparkles, category: "Outils" },
        { title: "Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, icon: Sparkles, category: "Outils" },
        { title: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, icon: Compass, category: "Outils" },
        
        { title: "Centre Admin / Paramètres", href: `/dashboard/${guildId}/admin`, icon: Shield, category: "Supervision" },
    ];

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <div className="px-1 py-2">
            <button
                className="relative h-9 w-full flex items-center justify-start gap-2 rounded-xl border border-white/5 bg-white/[0.01] px-3 text-xs font-medium text-zinc-500 transition-all hover:bg-white/[0.03] hover:border-white/10 hover:text-zinc-400"
                onClick={() => setOpen(true)}
            >
                <Search className="shrink-0 h-3.5 w-3.5" />
                <span className="flex-1 text-left truncate">Navigation Rapide...</span>
                <div className="shrink-0 opacity-20">
                    <CommandIcon className="h-3 w-3" />
                </div>
            </button>
            <CommandDialog 
                open={open} 
                onOpenChange={setOpen}
                className="bg-zinc-950 border-white/10 sm:max-w-[450px] rounded-2xl overflow-hidden p-0 gap-0 shadow-2xl"
            >
                <div className="border-b border-white/5 bg-white/[0.02]">
                    <CommandInput 
                        placeholder="Rechercher une page..." 
                        className="h-12 bg-transparent text-sm border-none focus:ring-0 outline-none"
                    />
                </div>
                <CommandList className="max-h-[350px] premium-scrollbar p-2">
                    <CommandEmpty className="py-8 text-center text-xs text-zinc-600">Aucun résultat.</CommandEmpty>
                    <CommandGroup heading={<span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-2 mb-2 block">Suggestions</span>}>
                         {searchItems.map((item) => (
                            <CommandItem
                                key={item.href + item.title}
                                value={item.title}
                                onSelect={() => runCommand(() => router.push(item.href))}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg data-[selected=true]:bg-white/5 transition-all mb-1"
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/5 bg-white/5">
                                    <item.icon className="h-3.5 w-3.5 text-zinc-500" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-zinc-200">{item.title}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{item.category}</span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
                <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[9px] font-black text-zinc-700 uppercase tracking-widest">
                    <span>Navigation</span>
                    <span className="opacity-50">ESC pour fermer</span>
                </div>
            </CommandDialog>
        </div>
    );
}
