"use client";

interface DofusProgressRingProps {
    percent: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    isObtained?: boolean;
    showText?: boolean;
}

export function DofusProgressRing({
    percent,
    size = 80,
    strokeWidth = 6,
    color = "#10b981",
    isObtained = false,
    showText = true,
}: DofusProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    const displayColor = isObtained ? "#fbbf24" : color;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                style={{ transform: "rotate(-90deg)" }}
                aria-hidden="true"
            >
                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={displayColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                        filter: isObtained
                            ? `drop-shadow(0 0 6px ${displayColor}99)`
                            : percent > 0
                            ? `drop-shadow(0 0 4px ${displayColor}66)`
                            : "none",
                    }}
                />
            </svg>
            {showText && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {isObtained ? (
                        <span className="text-lg" aria-label="Obtenu">✓</span>
                    ) : (
                        <span
                            className="text-xs font-bold tabular-nums"
                            style={{ color: percent > 0 ? displayColor : "rgba(255,255,255,0.4)" }}
                        >
                            {percent}%
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
