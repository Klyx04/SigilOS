"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function RunCardSkeleton() {
    return (
        <Card className="bg-zinc-900/40 border-white/5 overflow-hidden">
            <CardContent className="p-0">
                <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32 bg-white/5" />
                            <Skeleton className="h-4 w-24 bg-white/5" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full bg-white/5" />
                    </div>

                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-8 w-8 rounded-full border-2 border-zinc-950 bg-white/5" />
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-xs">
                            <Skeleton className="h-3 w-12 bg-white/5" />
                            <Skeleton className="h-3 w-8 bg-white/5" />
                        </div>
                        <Skeleton className="h-2 w-full bg-white/5" />
                    </div>
                </div>

                <div className="px-5 py-3 bg-white/5 flex justify-between">
                    <Skeleton className="h-4 w-20 bg-white/5" />
                    <Skeleton className="h-4 w-12 bg-white/5" />
                </div>
            </CardContent>
        </Card>
    );
}

export function SongesGridSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-10 w-24 rounded-lg bg-white/5" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <RunCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
