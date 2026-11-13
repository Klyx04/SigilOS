import type { RushMarkdownBlock, RushMarkdownInline } from "@/lib/rush-markdown";

/**
 * Rendu du **markdown borné** des blocs Rush (12/11/2026).
 *
 * Aucun HTML brut, aucun `dangerouslySetInnerHTML` : le parseur produit des
 * inlines, ce composant les rend en JSX. Les couleurs sont **sémantiques** et
 * passent par les tokens de la DA (`text-gold`, `text-success`, `text-destructive`,
 * `text-warning`, `text-info`) — jamais un hex libre.
 */
const COLOR_CLASS: Record<string, string> = {
  or: "text-gold",
  vert: "text-success",
  danger: "text-destructive",
  ambre: "text-warning",
  info: "text-info",
};

function Inline({ inline }: { inline: RushMarkdownInline }) {
  switch (inline.kind) {
    case "strong":
      return <strong className="font-semibold text-foreground">{inline.text}</strong>;
    case "em":
      return <em>{inline.text}</em>;
    case "color":
      return <span className={COLOR_CLASS[inline.color] ?? ""}>{inline.text}</span>;
    case "link":
      return (
        <a
          href={inline.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {inline.text}
        </a>
      );
    default:
      return <>{inline.text}</>;
  }
}

export function RushMarkdown({
  blocks,
  className,
}: {
  blocks: RushMarkdownBlock[];
  className?: string;
}) {
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Tag = block.level === 2 ? "h4" : "h5";
          return (
            <Tag
              key={index}
              className="mt-3 font-serif text-sm font-semibold text-foreground first:mt-0"
            >
              {block.inlines.map((inline, i) => <Inline key={i} inline={inline} />)}
            </Tag>
          );
        }
        if (block.kind === "list") {
          return (
            <ul
              key={index}
              className="my-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground"
            >
              {block.items.map((item, i) => (
                <li key={i}>
                  {item.map((inline, j) => <Inline key={j} inline={inline} />)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={index}
            className="my-1.5 text-sm leading-relaxed text-muted-foreground first:mt-0"
          >
            {block.inlines.map((inline, i) => <Inline key={i} inline={inline} />)}
          </p>
        );
      })}
    </div>
  );
}
