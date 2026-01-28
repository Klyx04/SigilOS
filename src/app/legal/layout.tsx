import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Scale } from "lucide-react";

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black/95 text-zinc-400 font-sans selection:bg-primary/30">
            <div className="max-w-4xl mx-auto p-6 pt-24 space-y-8">
                <UnifiedModuleHeader
                    title="Documents Légaux"
                    description="Informations légales et contractuelles"
                    icon={Scale}
                    backHref="/dashboard/guest" // Fallback, will likely redirect if logged in
                />
                <div className="prose prose-invert prose-zinc max-w-none bg-zinc-900/50 p-8 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-sm">
                    {children}
                </div>
            </div>
        </div>
    );
}
