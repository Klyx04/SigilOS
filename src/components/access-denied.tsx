import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
                <ShieldAlert className="w-24 h-24 text-red-500 relative z-10" />
            </div>

            <div className="space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-red-500 font-serif">
                    Halte là, voyageur !
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                    Cette zone est réservée aux Empereurs et aux Officiers du Sigil.
                    Vos accréditations ne vous permettent pas d'entrer.
                </p>
            </div>

            <div className="flex gap-4">
                <Button asChild variant="default" className="bg-primary hover:bg-primary/90">
                    <Link href="/dashboard">
                        Retourner en lieu sûr
                    </Link>
                </Button>
            </div>
        </div>
    );
}
