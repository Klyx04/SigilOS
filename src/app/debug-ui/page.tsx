import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugUIPage() {
    return (
        <div className="relative h-screen w-full overflow-hidden bg-black flex items-center justify-center p-10">
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full opacity-50">
                <div className="z-10 text-white font-bold text-2xl mb-10">Aurora Should be Moving</div>
            </AuroraBackground>

            <div className="z-20 grid grid-cols-2 gap-10">
                <Card className="w-[300px] h-[200px] bg-zinc-900 border-zinc-800 relative overflow-hidden flex items-center justify-center">
                    <BorderBeam size={200} duration={5} delay={0} colorFrom="#ff0000" colorTo="#0000ff" />
                    <span className="text-white z-10 font-mono">Border Beam Test</span>
                </Card>

                <Card className="w-[300px] h-[200px] bg-zinc-900 border-zinc-800 hover:scale-105 transition-transform duration-300 flex items-center justify-center group">
                    <span className="text-zinc-500 group-hover:text-white transition-colors">Hover Me</span>
                </Card>
            </div>
        </div>
    );
}
