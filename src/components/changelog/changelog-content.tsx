"use client";

import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/security";

interface ChangelogContentProps {
    content: string;
    className?: string;
}

/**
 * Rendu du contenu d'une release SigilOS (HTML produit par l'éditeur Tiptap du God panel).
 *
 * Variante LÉGÈRE et cohérente pour la modale utilisateur (et l'aperçu God) :
 * - typographie sobre, adaptée à une modale `max-w-2xl` (pas de glow / dégradés lourds),
 * - Aucun conflit de classes prose (DocContent « default » est pensé pour les pages docs
 *   pleine largeur et casse son rendu en modale quand on tente de l'overrider),
 * - tableaux scrollables, code scrollable, images bornées, callouts discrets.
 */
export function ChangelogContent({ content, className }: ChangelogContentProps) {
    if (!content) return null;

    // 🔒 SECURITY : sanitisation HTML centralisée (anti-XSS) — même politique que DocContent.
    const sanitized = sanitizeHtml(content) || "";

    return (
        <div
            className={cn(
                "prose prose-zinc dark:prose-invert max-w-none break-words min-w-0",
                // Headings
                "prose-headings:font-black prose-headings:tracking-tight prose-headings:mb-3 prose-headings:mt-6",
                "prose-h1:text-xl prose-h1:text-white prose-h1:mb-4",
                "prose-h2:text-lg prose-h2:text-amber-400 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2",
                "prose-h3:text-base prose-h3:text-indigo-400",
                // Texte
                "prose-p:text-sm prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-4",
                "prose-strong:text-zinc-100 prose-strong:font-bold",
                // Listes
                "prose-ul:list-disc prose-ul:ml-4 prose-li:text-sm prose-li:text-zinc-300 prose-li:my-1",
                "prose-ol:list-decimal prose-ol:ml-4",
                // Liens
                "prose-a:text-teal-400 prose-a:font-semibold hover:prose-a:underline",
                // Code
                "prose-code:text-emerald-300 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs",
                "prose-pre:bg-[#050505] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:text-xs",
                // Citations / séparateurs
                "prose-blockquote:border-l-2 prose-blockquote:border-zinc-700 prose-blockquote:pl-4 prose-blockquote:text-zinc-400 prose-blockquote:italic",
                "prose-hr:border-white/10 prose-hr:my-4",
                // Callouts : sobre (sans backdrop-blur ni ombre géante)
                "[&_.callout]:my-4 [&_.callout]:p-4 [&_.callout]:rounded-xl [&_.callout]:bg-white/[0.03] [&_.callout]:border [&_.callout]:border-white/10",
                "[&_.callout\\ strong]:text-white [&_.callout\\ strong]:font-bold [&_.callout\\ strong]:uppercase [&_.callout\\ strong]:tracking-wider [&_.callout\\ strong]:text-caption",
                // Images / figures
                "[&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[380px] [&_img]:object-contain [&_img]:rounded-xl [&_img]:border [&_img]:border-white/10 [&_img]:my-3 [&_img]:mx-auto",
                "[&_figure]:my-4 [&_figure]:flex [&_figure]:flex-col [&_figure]:items-center",
                // Tableaux : scroll horizontal dans la modale (ne déborde plus)
                "[&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full [&_table]:text-xs [&_table]:border-collapse",
                "[&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-zinc-200 [&_th]:font-bold",
                "[&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-zinc-300",
                className
            )}
            // nosemgrep
            dangerouslySetInnerHTML={{ __html: sanitized }}
        />
    );
}
