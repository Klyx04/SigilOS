"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Calendar,
    Users,
    ScrollText,
    Sparkles,
    Crown,
    Trophy,
    Key,
    Compass,
    Shield,
    Settings,
    Gavel,
    Swords,
    FileText,
    ChevronDown,
    LogOut,
    ChevronsUpDown,
    Plus,
    Hammer
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type UserContext } from "@/server/actions/user-actions";
import { type GuildHeaderData } from "@/server/actions/guild-actions";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AppSidebarProps {
    guildId: string;
    user: UserContext;
    guildData: GuildHeaderData;
    userGuilds?: { id: string; name: string; iconUrl: string | null }[];
    className?: string; // For mobile sheet handling
}

export function AppSidebar({
    guildId,
    user,
    guildData,
    userGuilds = [],
    className
}: AppSidebarProps) {
    const pathname = usePathname();

    const isActive = (href: string, exact = false) => {
        return exact ? pathname === href : pathname.startsWith(href);
    };

    // --- NAVIGATION GROUPS ---

    const NAV_CORE = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: BookOpen },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, visible: user.isMember || user.canViewCalendar },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, visible: user.canViewRoster },
    ];

    const NAV_FEATURES = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "text-emerald-400", visible: user.canViewMissions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "text-fuchsia-400", visible: user.canViewSonges },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, icon: Crown, color: "text-amber-400", visible: user.canViewArchis },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "text-yellow-400", visible: user.canViewLadder },
    ];

    const NAV_TOOLS = [
        { name: "Services", href: `/dashboard/${guildId}/passages`, icon: Key, color: "text-orange-400", visible: true },
        { name: "Recherche", href: `/dashboard/${guildId}/finder`, icon: Compass, visible: true },
        { name: "Documentation", href: `/docs`, icon: BookOpen, visible: true },
        { name: "Mon Profil", href: `/dashboard/${guildId}/profile`, icon: Users, visible: true },
    ];

    const NAV_ADMIN = [
        { name: "Gestion Droits", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, visible: user.isAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "Éditer Présentation", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "Centre Validation", href: `/dashboard/${guildId}/admin/validation`, icon: Gavel, visible: user.canValidateMissions || user.isAdmin },
        { name: "Gestion Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "Logs", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.isAdmin },
    ];

    const hasAnyAdminPermission = user.isAdmin || user.canManageMissions || user.canValidateMissions || user.canEditPresentation;

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.5)]", className)}>

            {/* 1. HEADER: BRAND & GUILD SWITCHER */}
            <div className="p-4 pb-2 space-y-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 px-2 group/brand hover:opacity-80 transition-opacity">
                    <div className="relative h-8 w-8">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-lg font-black tracking-[0.2em] text-white leading-none font-heading">
                        SIGIL<span className="text-primary">OS</span>
                    </span>
                </Link>

                {/* Guild Switcher */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-between h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-left px-3 group"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-6 w-6 rounded-md border border-white/10">
                                    <AvatarImage src={guildData.iconUrl || undefined} />
                                    <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-400">
                                        {guildData.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-zinc-200 truncate group-hover:text-white transition-colors">
                                        {guildData.name}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                                        Guilde Active
                                    </span>
                                </div>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-zinc-500 shrink-0" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-64 bg-zinc-950 border-zinc-500/20 text-zinc-200 shadow-[0_0_40px_rgba(0,0,0,0.8)] p-1 backdrop-blur-3xl"
                        align="start"
                        sideOffset={8}
                    >
                        <DropdownMenuLabel className="px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black">
                            Changer de guilde
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/5 mx-1" />
                        <div className="space-y-0.5 p-1">
                            {userGuilds.map((g) => (
                                <DropdownMenuItem key={g.id} asChild>
                                    <Link
                                        href={`/dashboard/${g.id}`}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                                            g.id === guildId
                                                ? "bg-primary/10 border border-primary/20 text-white"
                                                : "hover:bg-white/5 text-zinc-400 hover:text-zinc-100"
                                        )}
                                    >
                                        <Avatar className="h-6 w-6 rounded-md border border-white/10">
                                            <AvatarImage src={g.iconUrl || undefined} />
                                            <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-500">
                                                {g.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className={cn("text-xs font-black truncate", g.id === guildId ? "text-primary" : "")}>
                                                {g.name}
                                            </span>
                                            {g.id === guildId && <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest">Connecté</span>}
                                        </div>
                                        {g.id === guildId && (
                                            <div className="ml-auto w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                                        )}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </div>
                        <DropdownMenuSeparator className="bg-white/5 mx-1" />
                        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest cursor-not-allowed opacity-50">
                            <Plus className="h-3.5 w-3.5" />
                            Rejoindre une guilde
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 2. SCROLLABLE NAVIGATION */}
            <ScrollArea className="flex-1 px-3 py-4 overflow-hidden">
                <nav className="space-y-8">

                    {/* CORE */}
                    <div className="space-y-1.5 peer">
                        <div className="flex items-center gap-2 px-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-zinc-700/50 to-transparent" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Général</h4>
                        </div>
                        {NAV_CORE.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href, item.exact)} />
                        ))}
                    </div>

                    {/* FEATURES */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-zinc-700/50 to-transparent" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Fonctionnalités</h4>
                        </div>
                        {NAV_FEATURES.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                        ))}
                    </div>

                    {/* TOOLS */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-zinc-700/50 to-transparent" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Outils</h4>
                        </div>
                        {NAV_TOOLS.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                        ))}
                    </div>

                    {/* ADMIN */}
                    {hasAnyAdminPermission && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60 flex items-center gap-2">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </h4>
                            </div>
                            {NAV_ADMIN.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </div>
                    )}

                </nav>
            </ScrollArea>

            {/* 3. FOOTER: USER ISLAND */}
            <div className="p-4 mt-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-auto p-2 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 rounded-xl transition-all duration-300 group/island"
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="relative">
                                    <Avatar className="h-9 w-9 rounded-lg border border-white/10 group-hover/island:border-primary/50 transition-all duration-500 shadow-xl group-hover/island:shadow-primary/10">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-xs font-black text-zinc-400">
                                            {user.name?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                </div>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-xs font-black text-zinc-200 truncate w-full group-hover/island:text-white transition-colors">
                                        {user.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-500 truncate w-full uppercase tracking-tighter">
                                        {user.roleName || "Membre"}
                                    </span>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 text-zinc-500 group-hover/island:text-white transition-all shrink-0" />
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl" align="end" side="right" sideOffset={12}>
                        <div className="px-2 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 rounded-md mb-1 mx-1 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Session Active</span>
                        </div>
                        <DropdownMenuSeparator className="bg-white/10" />

                        <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
                            <Link href={`/dashboard/${guildId}/profile`}>
                                <LayoutDashboard className="mr-2 h-4 w-4 text-zinc-500" />
                                <span className="font-bold">Mon Profil</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem className="focus:bg-white/5 cursor-pointer">
                            <Settings className="mr-2 h-4 w-4 text-zinc-500" />
                            <span className="font-bold">Paramètres</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => signOut()} className="text-rose-400 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span className="font-black">Déconnexion</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function NavItem({ item, isActive }: { item: any; isActive: boolean }) {
    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative overflow-hidden",
                isActive
                    ? "bg-white/[0.04] text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/10"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
            )}
        >
            {/* Active Glow Indicator */}
            {isActive && (
                <div className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)]",
                    item.color ? item.color.replace("text-", "bg-") : "bg-primary"
                )} />
            )}

            <item.icon
                className={cn(
                    "h-4 w-4 shrink-0 transition-all duration-300",
                    isActive
                        ? cn(item.color || "text-primary", "scale-110 drop-shadow-[0_0_8px_currentColor]")
                        : cn(item.color ? `${item.color} opacity-40 group-hover:opacity-80` : "text-zinc-500 group-hover:text-zinc-300", "group-hover:scale-110")
                )}
            />
            <span className={cn(
                "text-sm transition-all duration-300",
                isActive ? "font-black tracking-tight" : "font-bold"
            )}>
                {item.name}
            </span>

            {/* Subtle light effect on hover */}
            {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
        </Link>
    );
}
