import React from 'react';

const STAT_ICONS: Record<string, string> = {
    "Vitalité": "🔴", "Intelligence": "🔥", "Chance": "💧", "Agilité": "🍃", "Force": "🟫",
    "Sagesse": "🟣", "Puissance": "💪", "PA": "⚡", "PM": "🏃", "Portée": "👁️",
    "Critique": "❗️", "Soin": "💖", "Dommages": "⚔️", "Initiative": "🆙", "Prospection": "🍀",
    "Fuite": "👣", "Tacle": "🥊", "Esquive": "🛡️", "Retrait": "↘️", "Res.": "🛡️", "Dom.": "⚔️"
};

export function renderTextWithLinks(text: string, mentions?: string[]): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const isSharedItem = text.startsWith("!");
    const remainingText = isSharedItem ? text.slice(1).trim() : text;

    // Special rendering for shared items (Premium Card look)
    if (isSharedItem) {
        const imgMatch = remainingText.match(/!\[([^\]]*)\]\(([^)]*)\)/);
        const allLinks = Array.from(remainingText.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g));
        const linkMatch = allLinks.find(m => {
            const index = m.index || 0;
            return index === 0 || remainingText[index - 1] !== '!';
        });

        const authorMatch = remainingText.match(/\*\*(.*?)\*\*\s+(partage|PARTAGE)/i);
        const metaMatch = remainingText.match(/_([^_]+)_/i);
        const statsMatch = remainingText.match(/(Stats|STATS):\s*(.*)/i);

        if (linkMatch) {
            const name = linkMatch[1];
            const itemUrl = linkMatch[2];
            const imgUrl = imgMatch ? imgMatch[2] : "";
            const sharerName = authorMatch ? authorMatch[1] : null;
            const metaInfo = metaMatch ? metaMatch[1] : null;
            const statsLines = statsMatch ? statsMatch[2].split(",").map(s => s.trim()) : [];

            return [
                <div key="shared-item-card" className="my-3 group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/40 transition-all hover:bg-zinc-900/60 hover:border-indigo-500/40 active:scale-[0.99] cursor-default max-w-full shadow-xl">
                    {/* Background Glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[64px] rounded-full pointer-events-none group-hover:bg-indigo-500/15 transition-all" />

                    <div className="p-4">
                        {/* Header Row */}
                        <div className="flex items-start gap-4 mb-4">
                            {/* Icon/Image Box */}
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center p-2 group-hover:border-indigo-500/50 transition-all shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                {imgUrl && (
                                    <img
                                        src={imgUrl}
                                        alt={name}
                                        className="h-full w-full object-contain drop-shadow-xl relative z-10 transition-transform duration-500 group-hover:scale-110"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'inline';
                                            }
                                        }}
                                    />
                                )}
                                <span className="text-3xl relative z-10" style={{ display: imgUrl ? 'none' : 'inline' }}>
                                    {itemUrl.includes("item-sets") ? "🛡️" :
                                        itemUrl.includes("quest") ? "📜" :
                                            itemUrl.includes("dungeon") ? "🏰" : "📦"}
                                </span>
                            </div>

                            {/* Info Box */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        DofusDB
                                    </span>
                                    {sharerName && (
                                        <span className="text-[10px] text-zinc-500 font-medium truncate italic pr-1">
                                            via <span className="text-zinc-400 not-italic font-bold">{sharerName}</span>
                                        </span>
                                    )}
                                </div>
                                <h4 className="text-lg font-black text-white truncate group-hover:text-indigo-200 transition-colors tracking-tight leading-tight mb-0.5">
                                    {name}
                                </h4>
                                {metaInfo && (
                                    <p className="text-xs font-bold text-zinc-500 tracking-wide uppercase">
                                        {metaInfo}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Effects Section */}
                        {statsLines.length > 0 && (
                            <div className="mb-4 space-y-1.5 p-3 rounded-lg bg-black/30 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 px-1">Effets</div>
                                <div className="grid grid-cols-1 min-[280px]:grid-cols-2 gap-x-4 gap-y-1.5">
                                    {statsLines.map((stat, idx) => {
                                        const iconKey = Object.keys(STAT_ICONS).find(k => stat.includes(k));
                                        const icon = iconKey ? STAT_ICONS[iconKey] : "🔹";
                                        return (
                                            <div key={idx} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300 group/stat">
                                                <span className="w-4 h-4 flex items-center justify-center grayscale-[0.3] group-hover/stat:grayscale-0 transition-all">{icon}</span>
                                                <span className="truncate">{stat}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer Action */}
                        <a
                            href={itemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-zinc-800/50 hover:bg-indigo-600 border border-white/5 hover:border-indigo-400 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all pointer-events-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            Consulter la fiche
                            <span className="transition-transform group-hover:translate-x-1">→</span>
                        </a>
                    </div>
                </div>
            ];
        }
    }

    // Split by newlines first to handle blocks
    const lines = remainingText.split('\n');
    let keyIndex = 0;

    const urlRegex = /(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?/gi;

    lines.forEach((line, lineIdx) => {
        const currentLine = line;

        // 1. Process Bold text (**text**)
        const boldParts = currentLine.split(/\*\*(.*?)\*\*/g);

        boldParts.forEach((part, i) => {
            if (i % 2 === 1) { // It's the matched bold group
                parts.push(<strong key={`bold-${keyIndex++}`} className="font-bold text-white">{part}</strong>);
            } else if (part) { // Normal text, need to process links/images here

                // Process images ![alt](url)
                const imgSplits = part.split(/!\[([^\]]*)\]\(([^)]+)\)/g);
                let imgIdx = 0;
                while (imgIdx < imgSplits.length) {
                    if (imgIdx % 3 === 0) { // Normal text, check for md links
                        const txt = imgSplits[imgIdx];
                        if (txt) {
                            const linkSplits = txt.split(/\[([^\]]*)\]\(([^)]+)\)/g);
                            let linkIdx = 0;
                            while (linkIdx < linkSplits.length) {
                                if (linkIdx % 3 === 0) { // Normal text, check for raw URLs
                                    const rawTxt = linkSplits[linkIdx];
                                    if (rawTxt) {
                                        // Finally, raw URLs and Mentions
                                        const lastRawIndex = 0;
                                        let rawMatch;
                                        const localUrlRegex = new RegExp(urlRegex.source, urlRegex.flags);

                                        // We will parse the text for both URLs and valid mentions
                                        const parseMentionsAndUrls = (content: string) => {
                                            const subParts: React.ReactNode[] = [];
                                            const partsByMentions = content.split(/(@[a-zA-Z0-9_-]+)/g);

                                            partsByMentions.forEach((subPart, j) => {
                                                if (subPart.startsWith("@") && subPart.length > 1) {
                                                    const mName = subPart.substring(1);
                                                    const isMentioned = mentions?.includes(mName.toLowerCase());
                                                    subParts.push(
                                                        <span key={`mention-${keyIndex++}`} className={`font-bold ${isMentioned ? 'text-indigo-400 border-b border-indigo-400/30 pb-0.5' : 'text-zinc-400'}`}>
                                                            {subPart}
                                                        </span>
                                                    );
                                                } else if (subPart) {
                                                    // Parse URLs inside this subpart
                                                    let urlIndex = 0;
                                                    let urlMatch;
                                                    const subUrlRegex = new RegExp(urlRegex.source, urlRegex.flags);
                                                    while ((urlMatch = subUrlRegex.exec(subPart)) !== null) {
                                                        if (urlMatch.index > urlIndex) {
                                                            subParts.push(<span key={`txt-${keyIndex++}`}>{subPart.substring(urlIndex, urlMatch.index)}</span>);
                                                        }
                                                        const url = urlMatch[0];
                                                        const href = url.match(/^https?:\/\//i) ? url : `https://${url}`;
                                                        subParts.push(
                                                            <a key={`url-${keyIndex++}`} href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors break-all" onClick={e => e.stopPropagation()}>
                                                                {url}
                                                            </a>
                                                        );
                                                        urlIndex = subUrlRegex.lastIndex;
                                                    }
                                                    if (urlIndex < subPart.length) {
                                                        subParts.push(<span key={`txt-${keyIndex++}`}>{subPart.substring(urlIndex)}</span>);
                                                    }
                                                }
                                            });
                                            return subParts;
                                        };

                                        parts.push(...parseMentionsAndUrls(rawTxt));
                                    }
                                    linkIdx += 1;
                                } else {
                                    // It's a markdown link [text](url)
                                    const linkText = linkSplits[linkIdx];
                                    const linkUrl = linkSplits[linkIdx + 1];
                                    parts.push(
                                        <a key={`mdlink-${keyIndex++}`} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-colors inline-block" onClick={e => e.stopPropagation()}>
                                            {linkText}
                                        </a>
                                    );
                                    linkIdx += 3;
                                }
                            }
                        }
                        imgIdx += 1;
                    } else {
                        // It's an image ![alt](url)
                        const imgAlt = imgSplits[imgIdx];
                        const imgUrl = imgSplits[imgIdx + 1];
                        parts.push(
                            <div key={`img-${keyIndex++}`} className="my-2 p-2 bg-black/40 rounded-xl inline-block border border-white/5 overflow-hidden shadow-lg">
                                <img src={imgUrl} alt={imgAlt} className="w-20 h-20 object-contain drop-shadow-md hover:scale-110 transition-transform" loading="lazy" />
                            </div>
                        );
                        imgIdx += 3;
                    }
                }
            }
        });

        if (lineIdx < lines.length - 1) {
            parts.push(<br key={`br-${keyIndex++}`} />);
        }
    });

    return parts.length > 0 ? parts : [text];
}
