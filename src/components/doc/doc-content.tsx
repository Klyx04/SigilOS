"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

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
                anchor.className = 'anchor-link opacity-0 group-hover:opacity-100 ml-2 text-zinc-600 hover:text-indigo-400 p-1 transition-all';
                anchor.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
                h.classList.add('group', 'flex', 'items-center');
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
                icon.className = 'callout-icon opacity-80 shrink-0';
                icon.innerHTML = icons[type];
                title.prepend(icon);
                title.classList.add('flex', 'items-center', 'gap-2');
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
            img.classList.add('cursor-zoom-in', 'transition-transform', 'duration-300', 'hover:scale-[1.02]', 'rounded-xl', 'shadow-xl');
            img.onclick = () => {
                if (img.classList.contains('fixed')) {
                    img.className = 'cursor-zoom-in transition-transform duration-300 hover:scale-[1.02] rounded-xl shadow-xl max-w-full';
                    img.style.position = '';
                    img.style.top = '';
                    img.style.left = '';
                    img.style.width = '';
                    img.style.zIndex = '';
                    document.body.style.overflow = '';
                } else {
                    img.classList.add('fixed', 'inset-0', 'm-auto', 'z-[1000]', 'max-w-[90vw]', 'max-h-[90vh]', 'cursor-zoom-out', 'object-contain', 'p-4', 'bg-black/80', 'backdrop-blur-xl');
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
            button.className = 'copy-button absolute top-4 right-4 p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-xl backdrop-blur-md';
            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

            button.onclick = (e) => {
                e.preventDefault();
                const code = pre.querySelector('code')?.innerText || pre.innerText;
                navigator.clipboard.writeText(code);
                toast.success("Code copié !");
                button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
                }, 2000);
            };
            pre.appendChild(button);
        });
    }, [content]);

    if (!content) return null;

    return (
        <div
            className={cn(
                "doc-preview-content prose prose-zinc dark:prose-invert max-w-none",
                // Headers - Modern & Gradient
                "prose-headings:font-black prose-headings:tracking-tight prose-headings:mb-6 prose-headings:mt-10",
                "prose-h1:text-4xl prose-h1:text-white prose-h1:mb-8",
                "prose-h2:text-2xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-3 prose-h2:text-purple-300 prose-h2:tracking-wide",
                "prose-h3:text-xl prose-h3:text-white prose-h3:tracking-tight",

                // Text & Layout
                "prose-p:leading-relaxed prose-p:text-zinc-300 prose-p:mb-6 prose-p:text-[15px]",
                "prose-strong:text-white prose-strong:font-black",

                // Lists
                "prose-ul:list-disc prose-ul:ml-6 prose-ul:marker:text-purple-500",
                "prose-ol:list-decimal prose-ol:ml-6 prose-ol:marker:text-teal-500",
                "prose-li:pl-2 prose-li:my-3",

                // Links
                "prose-a:text-purple-400 prose-a:font-bold prose-a:no-underline hover:prose-a:text-purple-300 hover:prose-a:underline hover:prose-a:decoration-2 hover:prose-a:underline-offset-4 transition-all",

                // Code Blocks
                "prose-code:text-teal-300 prose-code:bg-teal-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
                "prose-pre:bg-[#050505] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-2xl prose-pre:p-6 prose-pre:shadow-2xl",

                // Callouts / Alerts - Elite Standard (GitHub Flavor)
                "[&_.callout]:my-10 [&_.callout]:p-6 [&_.callout]:rounded-2xl [&_.callout]:border-l-[6px] [&_.callout]:bg-white/[0.03] [&_.callout]:backdrop-blur-xl [&_.callout]:shadow-2xl [&_.callout]:transition-all [&_.callout]:relative [&_.callout]:overflow-hidden",
                "[&_.callout:hover]:bg-white/[0.05] [&_.callout:hover]:scale-[1.01]",

                "[&_.callout-info]:border-blue-500 [&_.callout-info]:text-blue-100/90",
                "[&_.callout-tip]:border-emerald-500 [&_.callout-tip]:text-emerald-100/90",
                "[&_.callout-success]:border-emerald-500 [&_.callout-success]:text-emerald-100/90",
                "[&_.callout-warning]:border-amber-500 [&_.callout-warning]:text-amber-100/90",
                "[&_.callout-caution]:border-red-500 [&_.callout-caution]:text-red-100/90",
                "[&_.callout-danger]:border-red-500 [&_.callout-danger]:text-red-100/90",
                "[&_.callout-error]:border-red-500 [&_.callout-error]:text-red-100/90",
                "[&_.callout-important]:border-purple-500 [&_.callout-important]:text-purple-100/90",
                "[&_.callout-note]:border-zinc-500 [&_.callout-note]:text-zinc-200/90",
                "[&_.callout-abstract]:border-cyan-500 [&_.callout-abstract]:text-cyan-100/90",
                "[&_.callout-question]:border-indigo-500 [&_.callout-question]:text-indigo-100/90",
                "[&_.callout-bug]:border-rose-500 [&_.callout-bug]:text-rose-100/90",
                "[&_.callout-todo]:border-teal-500 [&_.callout-todo]:text-teal-100/90",

                "[&_.callout\ strong]:text-white [&_.callout\ strong]:font-black [&_.callout\ strong]:uppercase [&_.callout\ strong]:tracking-widest [&_.callout\ strong]:text-[10px] [&_.callout\ strong]:mb-2",

                // Steps Component (Auto-styling for tutorials)
                "[&_.steps]:relative [&_.steps]:ml-4 [&_.steps]:pl-8 [&_.steps]:border-l-2 [&_.steps]:border-white/5 [&_.steps]:space-y-12 [&_.steps]:py-4",
                "[&_.step-item]:relative",
                "[&_.step-number]:absolute [&_.step-number]:-left-[49px] [&_.step-number]:top-0 [&_.step-number]:w-8 [&_.step-number]:h-8 [&_.step-number]:bg-black [&_.step-number]:border-2 [&_.step-number]:border-purple-500 [&_.step-number]:rounded-full [&_.step-number]:flex [&_.step-number]:items-center [&_.step-number]:justify-center [&_.step-number]:text-xs [&_.step-number]:font-black [&_.step-number]:text-white [&_.step-number]:shadow-[0_0_15px_rgba(168,85,247,0.4)]",

                // Accordions / Details
                "prose-details:bg-white/[0.03] prose-details:border prose-details:border-white/5 prose-details:rounded-2xl prose-details:overflow-hidden prose-details:my-6 prose-details:transition-all",
                "prose-summary:px-6 prose-summary:py-4 prose-summary:font-bold prose-summary:cursor-pointer prose-summary:hover:bg-white/5 prose-summary:list-none prose-summary:flex prose-summary:items-center prose-summary:justify-between prose-summary:after:content-['+'] open:prose-summary:after:content-['-']",
                "[&_details[open]]:bg-white/[0.05]",
                "[&_details_>_div]:p-6 [&_details_>_div]:border-t [&_details_>_div]:border-white/5",

                // Table of Contents anchoring
                "scroll-mt-32",

                className
            )}
            ref={contentRef}
        >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
