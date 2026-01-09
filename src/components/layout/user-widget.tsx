"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Sparkles, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import type { UserContext } from "@/server/actions/user-actions";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function UserWidget({ user, collapsed = false, guildId }: { user: UserContext, collapsed?: boolean, guildId?: string }) {
    if (!user.isAuthenticated) return null;

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col justify-center" : "justify-between w-full")}>

            {/* The Main Profile Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className={cn(
                        "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-accent/50 hover:border-border group flex-1",
                        collapsed ? "justify-center" : "min-w-0"
                    )}>
                        <div className="relative shrink-0">
                            <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-primary/50 transition-all">
                                <AvatarImage src={user.image} alt={user.name} />
                                <AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {/* Status Dot */}
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-sidebar shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>

                        {!collapsed && (
                            <div className="flex flex-col text-left overflow-hidden min-w-0">
                                <span className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                    {user.name}
                                </span>
                                <span
                                    className="text-xs font-medium truncate px-1.5 py-0.5 rounded-full bg-white/5 w-fit mt-0.5"
                                    style={{
                                        color: roleColorHex,
                                        borderColor: `${roleColorHex}33`,
                                        backgroundColor: `${roleColorHex}11`
                                    }}
                                >
                                    {user.roleName}
                                </span>
                            </div>
                        )}

                        {!collapsed && (
                            <Settings className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={10}>
                    {user.roleName && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-sm mb-2 mx-1 mt-1 text-center border border-white/5">
                            Vous êtes <span className="font-bold" style={{ color: roleColorHex }}>{user.roleName}</span>
                        </div>
                    )}
                    {user.canManageProfile && (
                        <DropdownMenuItem asChild>
                            <Link href={guildId ? `/dashboard/${guildId}/profile` : "/dashboard/profile"} className="cursor-pointer">
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Mon Profil</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {user.isAdmin && guildId && (
                        <DropdownMenuItem asChild>
                            <Link href={`/dashboard/${guildId}/admin`} className="cursor-pointer">
                                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                                <span>Administration</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Déconnexion</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell (Right side if expanded, Bottom/Top if collapsed?) */}
            {/* If collapsed, maybe hide it or put it in column. Parent is flex-col if collapsed. */}

            {user.id && (
                <div className="shrink-0">
                    <NotificationBell userId={user.id} />
                </div>
            )}
        </div>
    );
}
