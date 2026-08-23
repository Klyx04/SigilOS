import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            animation: {
                aurora: "aurora 60s linear infinite",
                "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
                "bounce-in": "bounceIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)",
                "slide-up": "slideUp 0.3s ease-out",
                "timer-pulse": "timerPulse 1s ease-in-out infinite",
                "correct-flash": "correctFlash 0.5s ease-in-out",
                "page-flip": "pageFlip 0.6s ease-in-out",
            },
            keyframes: {
                aurora: {
                    from: { backgroundPosition: "50% 50%, 50% 50%" },
                    to: { backgroundPosition: "350% 50%, 350% 50%" },
                },
                "border-beam": {
                    "100%": {
                        "offset-distance": "100%",
                    },
                },
                bounceIn: {
                    "0%": { transform: "scale(0.3)", opacity: "0" },
                    "50%": { transform: "scale(1.05)" },
                    "100%": { transform: "scale(1)", opacity: "1" },
                },
                slideUp: {
                    "0%": { transform: "translateY(20px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
                timerPulse: {
                    "0%, 100%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.1)" },
                },
                correctFlash: {
                    "0%": { backgroundColor: "transparent" },
                    "50%": { backgroundColor: "rgba(46,204,113,0.4)" },
                    "100%": { backgroundColor: "transparent" },
                },
                pageFlip: {
                    "0%": { transform: "perspective(600px) rotateY(-90deg)", opacity: "0" },
                    "100%": { transform: "perspective(600px) rotateY(0deg)", opacity: "1" },
                },
            },
        }
    },
    plugins: [animate, typography],
};
export default config;
