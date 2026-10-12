/**
 * SigilOS Ticket Bot — HTML Transcript Engine
 * Generates standalone, ultra-clean, Discord-themed HTML transcripts for archived tickets.
 */

export interface TranscriptMessage {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string | null;
    isBot?: boolean;
    isStaff?: boolean;
    isInternalNote?: boolean;
    content: string;
    createdAt: Date | string;
    attachments?: Array<{ url: string; name: string; isImage?: boolean }>;
}

export interface TranscriptMeta {
    ticketNumber: number;
    categoryName: string;
    guildName: string;
    creatorName: string;
    creatorId: string;
    claimedByName?: string | null;
    openedAt: Date | string;
    closedAt?: Date | string | null;
    closedByName?: string | null;
    closedReason?: string | null;
    intakeAnswers?: Record<string, string> | null;
    csatRating?: number | null;
}

export function generateHtmlTranscript(meta: TranscriptMeta, messages: TranscriptMessage[]): string {
    const openedDateStr = new Date(meta.openedAt).toLocaleString("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
    });
    const closedDateStr = meta.closedAt
        ? new Date(meta.closedAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })
        : "Non clôturé";

    const intakeRows = meta.intakeAnswers
        ? Object.entries(meta.intakeAnswers)
              .map(
                  ([k, v]) => `
            <div class="intake-row">
                <span class="intake-label">${escapeHtml(k)} :</span>
                <span class="intake-value">${escapeHtml(String(v))}</span>
            </div>`
              )
              .join("")
        : "";

    const messagesHtml = messages
        .map((m) => {
            const timeStr = new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const dateStr = new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

            if (m.isInternalNote) {
                return `
                <div class="message-row internal-note">
                    <div class="note-badge">🔒 NOTE INTERNE STAFF (Masquée au membre)</div>
                    <div class="avatar-col">
                        <img class="avatar" src="${m.authorAvatar || "https://cdn.discordapp.com/embed/avatars/0.png"}" alt="avatar" />
                    </div>
                    <div class="content-col">
                        <div class="author-line">
                            <span class="author-name staff-name">${escapeHtml(m.authorName)}</span>
                            <span class="badge staff-badge">Staff</span>
                            <span class="timestamp">${dateStr} à ${timeStr}</span>
                        </div>
                        <div class="message-body">${formatDiscordMarkdown(m.content)}</div>
                    </div>
                </div>`;
            }

            return `
            <div class="message-row">
                <div class="avatar-col">
                    <img class="avatar" src="${m.authorAvatar || "https://cdn.discordapp.com/embed/avatars/0.png"}" alt="avatar" />
                </div>
                <div class="content-col">
                    <div class="author-line">
                        <span class="author-name ${m.isStaff ? "staff-name" : ""}">${escapeHtml(m.authorName)}</span>
                        ${m.isStaff ? '<span class="badge staff-badge">Staff</span>' : ""}
                        ${m.isBot ? '<span class="badge bot-badge">BOT</span>' : ""}
                        <span class="timestamp">${dateStr} à ${timeStr}</span>
                    </div>
                    <div class="message-body">${formatDiscordMarkdown(m.content)}</div>
                    ${
                        m.attachments && m.attachments.length > 0
                            ? `<div class="attachments-row">
                            ${m.attachments
                                .map((a) =>
                                    a.isImage
                                        ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer"><img class="attached-img" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" /></a>`
                                        : `<a class="attached-file" href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer">📎 ${escapeHtml(a.name)}</a>`
                                )
                                .join("")}
                        </div>`
                            : ""
                    }
                </div>
            </div>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript #${meta.ticketNumber} — ${escapeHtml(meta.categoryName)} — ${escapeHtml(meta.guildName)}</title>
    <style>
        :root {
            --bg-base: #1e1f22;
            --bg-card: #2b2d31;
            --bg-card-alt: #313338;
            --text-normal: #dbdee1;
            --text-muted: #949ba4;
            --text-heading: #f2f3f5;
            --brand: #5865f2;
            --brand-green: #23a55a;
            --brand-amber: #f0b232;
            --brand-red: #f23f43;
            --border: #3f4147;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg-base);
            color: var(--text-normal);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            padding: 24px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .header-card {
            background-color: var(--bg-card);
            border-radius: 12px;
            border: 1px solid var(--border);
            padding: 20px 24px;
            margin-bottom: 20px;
        }
        .header-title {
            color: var(--text-heading);
            font-size: 20px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            font-size: 13px;
            color: var(--text-muted);
        }
        .meta-item strong { color: var(--text-normal); }
        .intake-box {
            margin-top: 16px;
            padding: 12px 16px;
            background-color: var(--bg-card-alt);
            border-radius: 8px;
            border-left: 4px solid var(--brand);
        }
        .intake-title { font-weight: 600; color: var(--text-heading); margin-bottom: 6px; font-size: 13px; }
        .intake-row { margin-bottom: 4px; font-size: 13px; }
        .intake-label { color: var(--text-muted); font-weight: 500; }
        .intake-value { color: var(--text-normal); font-weight: 600; }
        .messages-container {
            background-color: var(--bg-card);
            border-radius: 12px;
            border: 1px solid var(--border);
            padding: 16px 20px;
        }
        .message-row {
            display: flex;
            gap: 14px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .message-row:last-child { border-bottom: none; }
        .message-row.internal-note {
            background-color: rgba(240, 178, 50, 0.08);
            border: 1px dashed var(--brand-amber);
            border-radius: 8px;
            padding: 12px;
            margin: 8px 0;
            flex-direction: column;
        }
        .note-badge {
            font-size: 11px;
            font-weight: 700;
            color: var(--brand-amber);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .avatar-col { flex-shrink: 0; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
        .content-col { flex: 1; min-width: 0; }
        .author-line { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .author-name { font-weight: 600; color: var(--text-heading); font-size: 14px; }
        .author-name.staff-name { color: #5865f2; }
        .badge {
            font-size: 10px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .staff-badge { background-color: var(--brand); color: #fff; }
        .bot-badge { background-color: #5865f2; color: #fff; }
        .timestamp { color: var(--text-muted); font-size: 11px; }
        .message-body { color: var(--text-normal); word-break: break-word; white-space: pre-wrap; font-size: 13.5px; }
        .attachments-row { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .attached-img { max-width: 320px; max-height: 220px; border-radius: 6px; border: 1px solid var(--border); }
        .attached-file { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 6px; background-color: var(--bg-card-alt); color: var(--brand); text-decoration: none; font-size: 12px; }
        .attached-file:hover { text-decoration: underline; }
        .footer-note { text-align: center; margin-top: 24px; font-size: 12px; color: var(--text-muted); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-card">
            <div class="header-title">
                <span>🎫 Ticket #${meta.ticketNumber} — ${escapeHtml(meta.categoryName)}</span>
            </div>
            <div class="meta-grid">
                <div class="meta-item">Serveur : <strong>${escapeHtml(meta.guildName)}</strong></div>
                <div class="meta-item">Demandeur : <strong>${escapeHtml(meta.creatorName)}</strong> (<code>${escapeHtml(meta.creatorId)}</code>)</div>
                <div class="meta-item">Pris en charge par : <strong>${escapeHtml(meta.claimedByName || "Non assigné")}</strong></div>
                <div class="meta-item">Ouvert le : <strong>${openedDateStr}</strong></div>
                <div class="meta-item">Clôturé le : <strong>${closedDateStr}</strong></div>
                ${meta.closedByName ? `<div class="meta-item">Fermé par : <strong>${escapeHtml(meta.closedByName)}</strong></div>` : ""}
                ${meta.closedReason ? `<div class="meta-item">Motif : <strong>${escapeHtml(meta.closedReason)}</strong></div>` : ""}
                ${meta.csatRating ? `<div class="meta-item">Satisfaction : <strong>${"⭐".repeat(meta.csatRating)} (${meta.csatRating}/5)</strong></div>` : ""}
            </div>
            ${
                intakeRows
                    ? `
            <div class="intake-box">
                <div class="intake-title">📋 Réponses au formulaire d'ouverture :</div>
                ${intakeRows}
            </div>`
                    : ""
            }
        </div>

        <div class="messages-container">
            ${messagesHtml || '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Aucun message archivé.</p>'}
        </div>

        <div class="footer-note">
            Généré automatiquement par <strong>SigilOS Ticket Bot</strong> · Archive horodatée sécurisée
        </div>
    </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDiscordMarkdown(text: string): string {
    if (!text) return "";
    let safe = escapeHtml(text);
    // Bold **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Underline __text__
    safe = safe.replace(/__(.*?)__/g, "<u>$1</u>");
    // Inline code `text`
    safe = safe.replace(/`([^`]+)`/g, '<code style="background: #111214; padding: 2px 5px; border-radius: 4px;">$1</code>');
    // User mentions <@123456789>
    safe = safe.replace(/&lt;@!?(\d+)&gt;/g, '<span style="background: rgba(88,101,242,0.3); color: #c9cdfb; padding: 0 4px; border-radius: 3px;">@User</span>');
    // Channel mentions <#123456789>
    safe = safe.replace(/&lt;#(\d+)&gt;/g, '<span style="background: rgba(88,101,242,0.3); color: #c9cdfb; padding: 0 4px; border-radius: 3px;">#channel</span>');
    return safe;
}
