"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface DocContentProps {
    content: string;
    className?: string;
}

export function DocContent({ content, className }: DocContentProps) {
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [processedContent, setProcessedContent] = React.useState(content);

    // 1. Process Headings to add IDs for TOC anchoring
    React.useEffect(() => {
        if (!content) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const headings = doc.querySelectorAll('h2, h3');

        headings.forEach(h => {
            if (!h.id) {
                h.id = (h.textContent || "").toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            }
        });

        setProcessedContent(doc.body.innerHTML);
    }, [content]);

    // 2. Code Copy Logic (Market Standard UX)
    React.useEffect(() => {
        if (!contentRef.current) return;

        const preBlocks = contentRef.current.querySelectorAll('pre');
        preBlocks.forEach((pre) => {
            if (pre.querySelector('.copy-button')) return;

            // Wrapper for positioning
            pre.style.position = 'relative';
            pre.classList.add('group'); // Enable hover utility

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
    }, [processedContent]);

    if (!content) return null;

    return (
        <div
            className={cn(
                "doc-preview-content prose prose-zinc dark:prose-invert max-w-none",
                // Headers - Modern & Gradient
                "prose-headings:font-black prose-headings:tracking-tight prose-headings:mb-6 prose-headings:mt-10",
                "prose-h1:text-4xl prose-h1:text-transparent prose-h1:bg-clip-text prose-h1:bg-gradient-to-r prose-h1:from-white prose-h1:to-zinc-400 prose-h1:mb-8",
                "prose-h2:text-2xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2 prose-h2:text-indigo-300",
                "prose-h3:text-xl prose-h3:text-white",

                // Text & Layout
                "prose-p:leading-relaxed prose-p:text-zinc-300 prose-p:mb-6",
                "prose-strong:text-white prose-strong:font-bold",

                // Lists
                "prose-ul:list-disc prose-ul:ml-6 prose-ul:marker:text-indigo-500",
                "prose-ol:list-decimal prose-ol:ml-6 prose-ol:marker:text-emerald-500",
                "prose-li:pl-2 prose-li:my-2",

                // Links
                "prose-a:text-indigo-400 prose-a:font-medium prose-a:no-underline hover:prose-a:text-indigo-300 hover:prose-a:underline hover:prose-a:decoration-2 hover:prose-a:underline-offset-4 transition-all",

                // Code Blocks
                "prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
                "prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-white/5 prose-pre:rounded-xl prose-pre:p-4 prose-pre:shadow-lg",

                // Callouts / Alerts - Market Standard
                "[&_.callout]:my-8 [&_.callout]:p-6 [&_.callout]:rounded-xl [&_.callout]:border-l-4 [&_.callout]:bg-opacity-5 [&_.callout]:backdrop-blur-sm",
                "[&_.callout-info]:bg-blue-500/10 [&_.callout-info]:border-blue-500 [&_.callout-info]:text-blue-100",
                "[&_.callout-tip]:bg-emerald-500/10 [&_.callout-tip]:border-emerald-500 [&_.callout-tip]:text-emerald-100",
                "[&_.callout-warning]:bg-amber-500/10 [&_.callout-warning]:border-amber-500 [&_.callout-warning]:text-amber-100",
                "[&_.callout-danger]:bg-red-500/10 [&_.callout-danger]:border-red-500 [&_.callout-danger]:text-red-100",
                "[&_.callout\ strong]:text-white [&_.callout\ strong]:font-black [&_.callout\ strong]:uppercase [&_.callout\ strong]:tracking-widest [&_.callout\ strong]:text-xs [&_.callout\ strong]:mb-2 [&_.callout\ strong]:block",

                // Table of Contents anchoring
                "scroll-mt-32",

                className
            )}
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: processedContent }}
        />
    );
}
