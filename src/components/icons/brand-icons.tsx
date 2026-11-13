/**
 * Marques Twitch et YouTube — **SVG locaux**, une seule source.
 *
 * 📌 Mesure du 02/11/2026 : `Twitch` et `Youtube` de `lucide-react` sont **dépréciés**
 * (`lucide-react.d.ts:20581` — « Brand icons have been deprecated and are due to be removed »,
 * retrait annoncé en v1.0). Les importer, c'est accepter une rupture silencieuse à la prochaine
 * montée de version. Deux tracés officiels suffisent, avec la couleur de marque portée par le
 * parent (`text-[#9146FF]` / `text-[#FF0000]`).
 *
 * Accessibilité : chaque icône est décorative par défaut (`aria-hidden`), le libellé textuel
 * (« Twitch », « YouTube ») restant dans le DOM à côté — jamais une icône seule qui porte le sens.
 */

type BrandIconProps = {
    className?: string;
};

export function TwitchIcon({ className = "h-4 w-4" }: BrandIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
    );
}

export function YouTubeIcon({ className = "h-4 w-4" }: BrandIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z" />
        </svg>
    );
}
