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
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/5", className)}>

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
                        className="w-60 bg-zinc-950 border-zinc-800 text-zinc-200 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                        align="start"
                    >
                        <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                            Changer de guilde
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {userGuilds.map((g) => (
                            <DropdownMenuItem key={g.id} asChild>
                                <Link
                                    href={`/dashboard/${g.id}`}
                                    className="flex items-center gap-2 cursor-pointer focus:bg-white/5 focus:text-white"
                                >
                                    <Avatar className="h-5 w-5 rounded-md border border-white/10">
                                        <AvatarImage src={g.iconUrl || undefined} />
                                        <AvatarFallback className="text-[8px] bg-zinc-900 text-zinc-500">
                                            {g.name?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className={cn("text-xs font-medium", g.id === guildId ? "text-primary font-bold" : "")}>
                                        {g.name}
                                    </span>
                                    {g.id === guildId && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem className="text-xs text-zinc-500 cursor-not-allowed opacity-50">
                            <Plus className="h-3 w-3 mr-2" />
                            Rejoindre une guilde
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 2. SCROLLABLE NAVIGATION */}
            <ScrollArea className="flex-1 px-3 py-2 overflow-hidden">
                <nav className="space-y-6">

                    {/* CORE */}
                    <div className="space-y-1">
                        <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Général</h4>
                        {NAV_CORE.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href, item.exact)} />
                        ))}
                    </div>

                    {/* FEATURES */}
                    <div className="space-y-1">
                        <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Fonctionnalités</h4>
                        {NAV_FEATURES.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                        ))}
                    </div>

                    {/* TOOLS */}
                    <div className="space-y-1">
                        <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Outils</h4>
                        {NAV_TOOLS.filter(i => i.visible !== false).map((item) => (
                            <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                        ))}
                    </div>

                    {/* ADMIN */}
                    {hasAnyAdminPermission && (
                        <div className="space-y-1">
                            <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-amber-500/70 mb-2 mt-4 flex items-center gap-2">
                                <Shield className="w-3 h-3" />
                                Administration
                            </h4>
                            {NAV_ADMIN.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </div>
                    )}

                </nav>
            </ScrollArea>

            {/* 3. FOOTER: USER PROFILE */}
            <div className="p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-white/5 group">
                            <div className="flex items-center gap-3 w-full">
                                <div className="relative">
                                    <Avatar className="h-8 w-8 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-xs font-bold text-zinc-400">
                                            {user.name?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                                </div>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-xs font-bold text-zinc-200 truncate w-full group-hover:text-white transition-colors">
                                        {user.name}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 truncate w-full">
                                        {user.roleName || "Membre"}
                                    </span>
                                </div>
                                <Settings className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200" align="end" side="right" sideOffset={10}>
                        <div className="px-2 py-1.5 flex items-center gap-2 text-xs text-zinc-400 bg-white/5 rounded-md mb-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connecté en tant que <span className="font-bold text-white">{user.name}</span>
                        </div>
                        <DropdownMenuSeparator className="bg-white/10" />

                        <DropdownMenuItem asChild>
                            <Link href={`/dashboard/${guildId}/profile`} className="cursor-pointer focus:bg-white/5">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Mon Profil
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-400 focus:bg-red-950/20 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
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
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden",
                isActive
                    ? "bg-white/5 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.02]"
            )}
        >
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}

            <item.icon
                className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? (item.color || "text-primary") : "text-zinc-500 group-hover:text-zinc-300"
                )}
            />
            <span className="text-sm font-medium">{item.name}</span>
        </Link>
    );
}
