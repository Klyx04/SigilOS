"use client";

import { cn } from "@/lib/utils";

interface DocContentProps {
    content: string;
    className?: string;
}

export function DocContent({ content, className }: DocContentProps) {
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

                // Quotes / Callouts
                "prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-500/5 prose-blockquote:pl-6 prose-blockquote:py-4 prose-blockquote:rounded-r-lg prose-blockquote:italic prose-blockquote:text-zinc-300 prose-blockquote:not-italic",

                // Media
                "prose-img:rounded-xl prose-img:shadow-2xl prose-img:border prose-img:border-white/10 prose-img:my-8",

                // Tables
                "prose-table:w-full prose-table:my-8 prose-table:border-collapse",
                "prose-thead:bg-white/5 prose-thead:border-b prose-thead:border-white/10",
                "prose-th:p-4 prose-th:text-left prose-th:font-bold prose-th:text-white",
                "prose-td:p-4 prose-td:border-b prose-td:border-white/5 prose-td:text-zinc-300",

                className
            )}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}
