"use client";

import { motion } from "framer-motion";

interface StatProgressProps {
    value: number;
    color?: string;
    glowColor?: string;
}

export function StatProgress({ value, color = "bg-info", glowColor = "rgba(168,85,247,0.5)" }: StatProgressProps) {
    return (
        <div className="mt-2 h-1.5 w-full bg-surface rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className={`h-full ${color}`}
                style={{
                    boxShadow: `0 0 8px ${glowColor}`
                }}
            />
        </div>
    );
}
