
import { UserProfile, User } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Hammer } from "lucide-react";

interface MemberCardProps {
    profile: UserProfile & { user: User };
}

export function MemberCard({ profile: rawProfile }: MemberCardProps) {
    const profile = rawProfile as any;
    const jobs = Array.isArray(profile.metiers) ? (profile.metiers as string[]) : [];
    const topJobs = jobs.slice(0, 3);
    const remaining = jobs.length - 3;

    return (
        <Card className="bg-zinc-900/40 border-white/5 hover:border-primary/50 transition-all group overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Optional: Add Actions or Status dot */}
            </div>

            <CardContent className="p-6 flex flex-col items-center gap-4">
                <Avatar className="w-20 h-20 border-2 border-white/10 group-hover:border-primary transition-all">
                    <AvatarImage src={profile.user.image || ""} />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                        {profile.user.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                </Avatar>

                <div className="text-center space-y-1 w-full">
                    <h3 className="font-bold text-lg truncate text-white">
                        {profile.pseudoDofus || profile.user.name}
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium">
                        {profile.classe || "Aventurier"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2 min-h-[1.5rem]">
                    {jobs.length > 0 ? (
                        <>
                            {topJobs.map(job => (
                                <Badge key={job} variant="secondary" className="bg-white/5 hover:bg-white/10 text-[10px] px-2 py-0.5 border-white/5">
                                    <Hammer className="w-3 h-3 mr-1 opacity-50" />
                                    {job}
                                </Badge>
                            ))}
                            {remaining > 0 && (
                                <span className="text-xs text-muted-foreground">+{remaining}</span>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-zinc-600 italic">Aucun métier déclaré</span>
                    )}
                </div>
            </CardContent>

            <CardFooter className="p-3 bg-black/20 border-t border-white/5 flex justify-between text-xs text-muted-foreground">
                <div className="flex gap-3 w-full justify-center">
                    <span>✨ {profile.xp} XP</span>
                    <span>🪙 {profile.guildatons} G</span>
                </div>
            </CardFooter>
        </Card>
    );
}
