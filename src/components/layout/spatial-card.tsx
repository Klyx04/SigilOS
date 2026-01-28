import { cn } from "@/lib/utils";

export function SpatialCard({ title, desc, icon: Icon, colorClass }: { title: string, desc: string, icon: any, colorClass: string }) {
    return (
        <div className="group perspective-1000 h-full">
            <div className="relative h-full transition-all duration-500 preserve-3d group-hover:rotate-x-2 group-hover:rotate-y-6">
                <div className="absolute -inset-1 bg-gradient-to-br from-white/10 to-transparent rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative h-full p-8 rounded-[40px] bg-black/60 border border-white/5 backdrop-blur-3xl overflow-hidden flex flex-col">
                    {/* Liquid reflection effect */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                    <div className={cn("p-4 rounded-2xl bg-white/5 w-fit mb-6", colorClass)}>
                        <Icon className="h-8 w-8" />
                    </div>

                    <h3 className="text-3xl font-black italic tracking-tighter mb-4 text-white/90 group-hover:text-white transition-colors">{title}</h3>
                    <p className="text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors flex-1">{desc}</p>

                    <div className="mt-8 flex items-center gap-2">
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className={cn("h-full w-[70%] rounded-full opacity-50", colorClass.replace('text-', 'bg-'))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
