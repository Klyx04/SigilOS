"use client";

import { useEffect, useRef } from "react";
import { usePathname, useParams } from "next/navigation";
import { logTelemetryEvent } from "@/server/actions/telemetry-actions";

export function TelemetryTracker() {
    const pathname = usePathname();
    const params = useParams();
    const lastPathRef = useRef<string | null>(null);

    const guildId = params?.guildId as string | undefined;

    // 1. PAGE_VIEW Tracking
    useEffect(() => {
        if (!pathname) return;
        
        // Prevent double logging of the same route path on first render/hydration
        if (lastPathRef.current === pathname) return;
        lastPathRef.current = pathname;

        // Skip tracking the admin page itself to avoid infinite logging loops or admin telemetry clutter if needed, 
        // but tracking the general /dashboard paths is exactly what the user wants.
        // We will track everything, except maybe the god panel itself to avoid self-monitoring clutter.
        if (pathname.startsWith("/god")) return;

        const recordPageView = async () => {
            try {
                let userAgentDetails = {};
                if (typeof window !== "undefined") {
                    userAgentDetails = {
                        userAgent: window.navigator.userAgent,
                        language: window.navigator.language,
                        screen: `${window.screen.width}x${window.screen.height}`,
                    };
                }

                await logTelemetryEvent({
                    guildId: guildId || null,
                    path: pathname,
                    eventType: "PAGE_VIEW",
                    details: userAgentDetails,
                });
            } catch (err) {
                // Fail silently to not impact user experience
            }
        };

        // Defer telemetry execution slightly to avoid blocking hydration/render cycles
        const timer = setTimeout(recordPageView, 1000);
        return () => clearTimeout(timer);
    }, [pathname, guildId]);

    // 2. INTERACTION (Click) Tracking
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleGlobalClick = async (event: MouseEvent) => {
            try {
                let target = event.target as HTMLElement | null;
                
                // Traverse up the DOM tree to find an element with tracking attribute
                let telemetryId: string | null = null;
                let elementLabel: string | null = null;

                while (target && target !== document.body) {
                    if (target.getAttribute("data-telemetry-id")) {
                        telemetryId = target.getAttribute("data-telemetry-id");
                        elementLabel = target.innerText || target.getAttribute("aria-label") || target.getAttribute("title");
                        break;
                    }
                    // Auto-track certain buttons or links even if they don't have the attribute, 
                    // if they are clearly interactive and have an ID or specific attributes.
                    if (
                        (target.tagName === "BUTTON" || target.tagName === "A") && 
                        (target.id || target.getAttribute("href"))
                    ) {
                        // Limit auto-tracked buttons to specific dashboards or actions
                        const href = target.getAttribute("href");
                        const id = target.id;
                        if (id) {
                            telemetryId = `auto:${target.tagName.toLowerCase()}:${id}`;
                        } else if (href && (href.startsWith("/dashboard") || href.includes("tab="))) {
                            telemetryId = `auto:nav:${href}`;
                        }
                        elementLabel = target.innerText || target.getAttribute("aria-label");
                        break;
                    }
                    target = target.parentElement;
                }

                if (telemetryId) {
                    await logTelemetryEvent({
                        guildId: guildId || null,
                        path: pathname || "unknown",
                        eventType: "INTERACTION",
                        elementId: telemetryId,
                        details: {
                            label: elementLabel?.trim().substring(0, 50) || null,
                            tagName: target?.tagName || null,
                        }
                    });
                }
            } catch (err) {
                // Fail silently
            }
        };

        window.addEventListener("click", handleGlobalClick, { capture: true });
        return () => window.removeEventListener("click", handleGlobalClick, { capture: true });
    }, [pathname, guildId]);

    return null;
}
