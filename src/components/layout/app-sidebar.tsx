"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Users,
    UserCircle,
    Shield,
    Menu,
    ScrollText,
    Gavel,
    Bug,
    Trophy,
    InfinityIcon,
    Swords,
    FileText,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Settings
} from "lucide-react";
import type { UserContext } from "@/server/actions/user-actions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
    className?: string;
    user: UserContext;
    guildId: string;
};

export function AppSidebar({ className, user, guildId }: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const isActive = (href: string, exact = false) => {
        return exact ? pathname === href : pathname.startsWith(href);
    };

    // Main Navigation Items (available to members based on permissions)
    const NAV_ITEMS = [
        { name: "Vue d'ensemble", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true, visible: true },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, visible: user.canViewMissions },
        { name: "Songes Infinis", href: `/dashboard/${guildId}/songes`, icon: InfinityIcon, visible: user.canViewSonges },
        { name: "Bourse Archis", href: `/dashboard/${guildId}/archimonstres`, icon: Bug, visible: user.canViewArchis },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, visible: user.canViewLadder },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, visible: user.canViewRoster },
        { name: "Mon Profil", href: `/dashboard/${guildId}/profile`, icon: UserCircle, visible: true },
    ];

    // Admin Navigation Items (visible based on granular permissions)
    const ADMIN_ITEMS = [
        { name: "Gestion Droits", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, visible: user.isAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "Validation Missions", href: `/dashboard/${guildId}/missions/validation`, icon: Gavel, visible: user.canValidateMissions },
        { name: "Gestion Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "Logs Audit", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.isAdmin },
    ];

    // Show admin section if user has ANY admin-level permission
    const hasAnyAdminPermission = user.isAdmin || user.canManageMissions || user.canValidateMissions;

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    type NavItemType = { name: string; href: string; icon: React.ElementType; exact?: boolean; visible?: boolean };
    const NavItem = ({ item, onClick }: { item: NavItemType, onClick?: () => void }) => {
        const active = isActive(item.href, item.exact);
        const isAdminItem = ADMIN_ITEMS.some(ai => ai.href === item.href);

        const content = (
            <Link href={item.href} onClick={onClick}>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full gap-3 h-11 font-medium transition-all duration-200",
                        collapsed ? "justify-center px-2" : "justify-start px-3",
                        active
                            ? isAdminItem
                                ? "bg-amber-500/10 text-amber-500 border-r-2 border-amber-500 rounded-r-none"
                                : "bg-primary/10 text-primary border-r-2 border-primary rounded-r-none"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                >
                    <item.icon className={cn(
                        "h-5 w-5 shrink-0",
                        active
                            ? isAdminItem ? "text-amber-500" : "text-primary"
                            : "text-muted-foreground"
                    )} />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                </Button>
            </Link>
        );

        if (collapsed) {
            return (
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        {content}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                        {item.name}
                    </TooltipContent>
                </Tooltip>
            );
        }

        return content;
    };

    const UserSection = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className={cn(
            "border-t border-white/5 pt-4",
            collapsed && !isMobile ? "px-2" : "px-3"
        )}>
            <div className={cn(
                "flex items-center gap-3 p-2 rounded-xl",
                collapsed && !isMobile ? "flex-col" : ""
            )}>
                <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 border-2 border-white/10">
                        <AvatarImage src={user.image} alt={user.name} />
                        <AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
                </div>

                {(!collapsed || isMobile) && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">{user.name}</p>
                        <p
                            className="text-xs truncate"
                            style={{ color: roleColorHex }}
                        >
                            {user.roleName}
                        </p>
                    </div>
                )}

                {/* Notification Bell */}
                {user.id && (
                    <div className="shrink-0">
                        <NotificationBell userId={user.id} />
                    </div>
                )}
            </div>

            {/* Logout Button - Always visible */}
            <Button
                variant="ghost"
                onClick={() => signOut()}
                className={cn(
                    "w-full mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                    collapsed && !isMobile ? "justify-center px-2" : "justify-start gap-3 px-3"
                )}
            >
                <LogOut className="h-4 w-4 shrink-0" />
                {(!collapsed || isMobile) && <span>Déconnexion</span>}
            </Button>
        </div>
    );

    const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className="flex flex-col h-full py-4">
            {/* Logo - REMOVED per user request (Header handles Identity) */}
            <div className={cn(
                "mb-2 flex items-center",
                collapsed && !isMobile ? "justify-center px-2" : "justify-between px-4"
            )}>
                {/* Collapse Toggle (Desktop only) now serves as the 'top' anchor */}
                {!isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCollapsed(!collapsed)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground ml-auto"
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                )}
            </div>

            {/* User Section - Moved to top for visibility */}
            <div className={cn("mb-4", collapsed && !isMobile ? "px-1" : "px-2")}>
                <UserSection isMobile={isMobile} />
            </div>

            {/* Main Navigation */}
            <div className={cn("flex-1 space-y-1", collapsed && !isMobile ? "px-1" : "px-2")}>
                <TooltipProvider>
                    {NAV_ITEMS.filter(item => item.visible).map((item) => (
                        <NavItem
                            key={item.href}
                            item={item}
                            onClick={() => isMobile && setMobileOpen(false)}
                        />
                    ))}

                    {/* Admin Section - Show if user has ANY admin-level permission */}
                    {hasAnyAdminPermission && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            {!collapsed && (
                                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Administration
                                </p>
                            )}
                            {collapsed && !isMobile && (
                                <div className="flex justify-center mb-2">
                                    <div className="h-px w-6 bg-amber-500/50" />
                                </div>
                            )}
                            {ADMIN_ITEMS.filter(item => item.visible !== false).map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={item}
                                    onClick={() => isMobile && setMobileOpen(false)}
                                />
                            ))}
                        </div>
                    )}
                </TooltipProvider>
            </div>

            {/* Footer */}
            <div className={cn(
                "mt-auto pt-4 border-t border-white/5",
                collapsed && !isMobile ? "px-2 text-center" : "px-4"
            )}>
                <p className="text-[10px] text-muted-foreground/40 font-mono">
                    v0.1.0-Alpha
                </p>
                {(!collapsed || isMobile) && (
                    <div className="flex gap-3 text-[10px] text-muted-foreground/60 mt-1">
                        <Link href="#" className="hover:text-primary transition-colors">Légal</Link>
                        <span>•</span>
                        <Link href="#" className="hover:text-primary transition-colors">Confidentialité</Link>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Trigger */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary">
                        SIGILOS
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {user.id && <NotificationBell userId={user.id} />}
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 border-r-border bg-sidebar/95 backdrop-blur-xl w-72">
                            <NavContent isMobile />
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Desktop Sidebar */}
            <div className={cn(
                "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar/50 h-screen sticky top-0 backdrop-blur-xl transition-all duration-300",
                collapsed ? "w-16" : "w-64",
                className
            )}>
                <NavContent />
            </div>
        </>
    );
}
