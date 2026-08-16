"use client";

// =============================================================================
// PROGRESS RING - Animated circular progress indicator
// =============================================================================

import { motion } from "framer-motion";

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    label?: string;
    sublabel?: string;
    showPercentage?: boolean;
}

export function ProgressRing({
    progress,
    size = 120,
    strokeWidth = 8,
    label,
    sublabel,
    showPercentage = true,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    // Color gradient based on progress
    const getColor = () => {
        if (progress >= 90) return "stroke-emerald-500";
        if (progress >= 75) return "stroke-amber-400";
        if (progress >= 50) return "stroke-amber-500";
        return "stroke-amber-600";
    };

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Background ring */}
            <svg className="absolute transform -rotate-90" width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className="stroke-muted/30"
                />
            </svg>

            {/* Animated progress ring */}
            <svg className="absolute transform -rotate-90" width={size} height={size}>
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className={getColor()}
                    style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeDasharray={circumference}
                />
            </svg>

            {/* Center content */}
            <div className="absolute flex flex-col items-center justify-center text-center">
                {showPercentage && (
                    <motion.span
                        className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        {Math.round(progress)}%
                    </motion.span>
                )}
                {label && (
                    <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
                )}
                {sublabel && (
                    <span className="text-caption text-muted-foreground/70">{sublabel}</span>
                )}
            </div>
        </div>
    );
}
