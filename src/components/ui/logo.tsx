import { cn } from "@/lib/utils";

export function SigilOSLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-12 h-12",
    };

    return (
        <div className={cn("relative flex items-center justify-center text-primary", sizeClasses[size], className)}>
            {/* Outer Hexagon with Glow */}
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                <path d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 L50 5Z" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-80" />
                <path d="M50 15 L83 34 V74 L50 93 L17 74 V34 L50 15Z" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" fill="none" />
            </svg>

            {/* Inner Runes/Tech Lines */}
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full animate-pulse-slow">
                <path d="M50 25 V75 M28 38 L72 62 M72 38 L28 62" stroke="cyan" strokeWidth="2" strokeLinecap="round" className="opacity-90 drop-shadow-[0_0_5px_cyan]" />
                <circle cx="50" cy="50" r="4" fill="cyan" className="drop-shadow-[0_0_8px_cyan]" />
            </svg>
        </div>
    );
}
