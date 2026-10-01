"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

interface GuideTocSidebarProps {
  /** ID du conteneur contenant le .reg-doc à parser */
  contentId?: string;
  className?: string;
}

/**
 * Sidebar Table of Contents sticky.
 * Parse les h2/h3 du contenu rendu côté client et propose un scrollspy.
 */
export function GuideTocSidebar({ contentId = "guide-content", className }: GuideTocSidebarProps) {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // 1. Parse headings après le montage du DOM
  useEffect(() => {
    const container = document.getElementById(contentId);
    if (!container) return;

    // Petite attente pour laisser DocContent appliquer ses ids
    const timer = setTimeout(() => {
      const headings = Array.from(container.querySelectorAll("h2, h3"));
      const parsed: TocEntry[] = headings
        .filter((h) => h.id)
        .map((h) => ({
          id: h.id,
          text: h.textContent?.replace(/\s*#$/, "").trim() ?? "",
          level: h.tagName === "H2" ? 2 : 3,
        }));
      setEntries(parsed);
    }, 200);

    return () => clearTimeout(timer);
  }, [contentId]);

  // 2. Scrollspy
  useEffect(() => {
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0% -70% 0%", threshold: 0 }
    );

    entries.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Table des matières"
      className={cn("space-y-1", className)}
    >
      <p className="reg-eyebrow mb-3 text-[11px]">Sur cette page</p>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById(entry.id);
            if (el) {
              const y = el.getBoundingClientRect().top + window.scrollY - 85;
              window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
              setActiveId(entry.id);
              if (window.history?.pushState) {
                window.history.pushState(null, "", `#${entry.id}`);
              }
            }
          }}
          className={cn(
            "block py-0.5 text-[13px] leading-snug transition-colors duration-150",
            entry.level === 3 ? "pl-3" : "pl-0",
            activeId === entry.id
              ? "font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "inline-block border-l-2 pl-2 transition-colors duration-150",
              activeId === entry.id ? "border-accent" : "border-transparent"
            )}
          >
            {entry.text}
          </span>
        </a>
      ))}
    </nav>
  );
}
