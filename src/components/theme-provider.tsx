"use client";

import * as React from "react";

interface ThemeContextValue {
    themes: string[];
    forcedTheme?: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    theme?: string;
    resolvedTheme?: string;
    systemTheme?: "dark" | "light";
}

const ThemeContext = React.createContext<ThemeContextValue>({
    themes: ["dark"],
    forcedTheme: "dark",
    setTheme: () => {},
    theme: "dark",
    resolvedTheme: "dark",
    systemTheme: "dark",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const value = React.useMemo<ThemeContextValue>(
        () => ({
            themes: ["dark"],
            forcedTheme: "dark",
            setTheme: () => {},
            theme: "dark",
            resolvedTheme: "dark",
            systemTheme: "dark",
        }),
        [],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return React.useContext(ThemeContext);
}
