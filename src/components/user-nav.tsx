"use client";

import { LogOut, User, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import type { UserContext } from "@/server/actions/user-actions";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function UserNav({ user }: { user: UserContext }) {
    if (!user.isAuthenticated) {
        return (
            <Button onClick={() => window.location.href = "/api/auth/signin"}>
                Connexion
            </Button>
        )
    }

    // Handle role color
    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : undefined;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button id="user-nav-trigger" variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/50 transition-all">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={user.image} alt={user.name} />
                        <AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        {user.roleName && (
                            <div className="flex mt-1">
                                <Badge variant="outline" style={roleColorHex ? { borderColor: roleColorHex, color: roleColorHex } : {}}>
                                    {user.roleName}
                                </Badge>
                            </div>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {user.isMember && (
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/profile" className="cursor-pointer">
                                <User className="mr-2 h-4 w-4" />
                                <span>Mon Profil</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {user.isAdmin && (
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/admin" className="cursor-pointer font-medium">
                                <Sparkles className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                                <span className="text-purple-600 dark:text-purple-100">Administration</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Déconnexion</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
