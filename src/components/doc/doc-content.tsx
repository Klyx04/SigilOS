"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/security";

interface DocContentProps {
    content: string;
    className?: string;
}

export function DocContent({ content, className }: DocContentProps) {
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Elite Post-Processing (Steps, Zoom, Copy, Callout Icons)
    React.useEffect(() => {
        if (!contentRef.current) return;

        // A. Headings & Anchors Logic
        const headings = contentRef.current.querySelectorAll('h2, h3');
        headings.forEach(h => {
            if (!h.id) {
                h.id = (h.textContent || "").toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            }
            if (!h.querySelector('.anchor-link')) {
                const anchor = document.createElement('a');
                anchor.href = `#${h.id}`;
                anchor.setAttribute('aria-label', `Lien vers la section « ${(h.textContent || "").trim()} »`);
                anchor.className = 'anchor-link';
                anchor.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
                h.appendChild(anchor);
            }
        });

        // B. Callout Enrichment (Auto-Icons)
        const callouts = contentRef.current.querySelectorAll('.callout');
        const icons: Record<string, string> = {
            info: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
            tip: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
            warning: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
            danger: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.27 2.1-6.9 12c-.79 1.38.22 3.1 1.8 3.1h13.8c1.58 0 2.59-1.72 1.8-3.1l-6.9-12a2 2 0 0 0-3.6 0Z"/><path d="M12 7v4"/><path d="M12 15h.01"/></svg>',
            error: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.27 2.1-6.9 12c-.79 1.38.22 3.1 1.8 3.1h13.8c1.58 0 2.59-1.72 1.8-3.1l-6.9-12a2 2 0 0 0-3.6 0Z"/><path d="M12 7v4"/><path d="M12 15h.01"/></svg>',
            important: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
            note: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
            abstract: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
            caution: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
            question: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
            bug: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/></svg>',
            todo: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>',
        };

        callouts.forEach(callout => {
            const classes = Array.from(callout.classList);
            const type = classes.find(c => c.startsWith('callout-'))?.replace('callout-', '');
            const title = callout.querySelector('strong');
            if (title && type && icons[type] && !title.querySelector('.callout-icon')) {
                const icon = document.createElement('span');
                icon.className = 'callout-icon shrink-0';
                icon.innerHTML = icons[type];
                title.prepend(icon);
            }
        });

        // C. Steps Auto-Styling
        const stepLists = contentRef.current.querySelectorAll('.steps');
        stepLists.forEach(list => {
            const items = list.querySelectorAll('li');
            items.forEach((li: any, idx) => {
                if (li.querySelector('.step-number')) return;
                li.classList.add('step-item');
                const num = document.createElement('div');
                num.className = 'step-number';
                num.innerText = (idx + 1).toString();
                li.prepend(num);
            });
        });

        // D. Image Zoom
        const images = contentRef.current.querySelectorAll('img');
        images.forEach((img: any) => {
            img.classList.add('cursor-zoom-in');
            img.onclick = () => {
                if (img.classList.contains('fixed')) {
                    img.className = 'cursor-zoom-in max-w-full';
                    img.style.position = '';
                    img.style.top = '';
                    img.style.left = '';
                    img.style.width = '';
                    img.style.zIndex = '';
                    document.body.style.overflow = '';
                } else {
                    img.classList.add('fixed', 'inset-0', 'm-auto', 'z-[1000]', 'max-w-[90vw]', 'max-h-[90vh]', 'cursor-zoom-out', 'object-contain', 'p-4', 'bg-background/95');
                    document.body.style.overflow = 'hidden';
                }
            };
        });

        // E. Code Copy
        const preBlocks = contentRef.current.querySelectorAll('pre');
        preBlocks.forEach((pre) => {
            if (pre.querySelector('.copy-button')) return;
            pre.style.position = 'relative';
            pre.classList.add('group');

            const button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('aria-label', 'Copier le code');
            button.className = 'copy-button';
            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

            button.onclick = (e) => {
                e.preventDefault();
                const code = pre.querySelector('code')?.innerText || pre.innerText;
                navigator.clipboard.writeText(code);
                toast.success("Code copié !");
                button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check text-success"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
                }, 2000);
            };
            pre.appendChild(button);
        });
    }, [content]);

    if (!content) return null;

    // 🔒 SECURITY FIX: Sanitize HTML to prevent XSS attacks
    // Ref: Security Audit Report #1 - Critical XSS vulnerability
    const sanitizedContent = sanitizeHtml(content) || "";


    return (
        <div
            className={cn(
                // La typographie et le balisage sont désormais portés par
                // `.reg-doc` + `.reg-content` (couche `components` de
                // globals.css) : plus de `prose` / `prose-invert`, plus de
                // soixantaine d'overrides qui imposaient teal + ambre, des
                // callouts `backdrop-blur-xl shadow-2xl` et des tableaux
                // `bg-zinc-800/80` — le tout cassait le thème clair.
                "reg-doc reg-content break-words min-w-0",

                // Callouts / Alertes : `.reg-content .callout*` gère le cadre, la
                // couleur de filet par type et le titre (voir globals.css).

                // Accordéons, ancrages, tableaux, images : traités par
                // `.reg-content` (globals.css).

                className
            )}
            ref={contentRef}
            // nosemgrep
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
}
