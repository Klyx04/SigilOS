/**
 * Détection d'adresses IP privées / réservées — **IPv4 et IPv6**.
 *
 * AUD-03 (audit 13/11/2026) : les contrôles précédents ne bloquaient que
 * `::1` et `fe80:`. Manquaient notamment `fc00::/7` (ULA), `::` (non spécifiée),
 * `::ffff:0:0/96` (IPv4-mapped), `ff00::/8` (multicast) et les plages IPv4
 * réservées (CGNAT, documentation, multicast…).
 *
 * Toute adresse invalide est considérée comme privée (fail-closed).
 */

function parseIpv4(ip: string): number | null {
    const parts = ip.split(".");
    if (parts.length !== 4) return null;

    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const n = Number(part);
        if (!Number.isInteger(n) || n < 0 || n > 255) return null;
        value = (value << 8) | n;
    }
    return value >>> 0;
}

const IPV4_BLOCKS: Array<[number, number]> = [
    [0x00000000, 0x00ffffff], // 0.0.0.0/8
    [0x0a000000, 0x0affffff], // 10.0.0.0/8
    [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
    [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local / metadata)
    [0xac100000, 0xac1fffff], // 172.16.0.0/12
    [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
    [0xc0000000, 0xc00000ff], // 192.0.0.0/24
    [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (documentation)
    [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (benchmark)
    [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (documentation)
    [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (documentation)
    [0xe0000000, 0xefffffff], // 224.0.0.0/4 (multicast)
    [0xf0000000, 0xffffffff], // 240.0.0.0/4 (réservé)
];

function isPrivateIpv4(value: number): boolean {
    return IPV4_BLOCKS.some(([lo, hi]) => value >= lo && value <= hi);
}

/** Parse une adresse IPv6 en BigInt (128 bits), ou null si invalide. */
function parseIpv6(ip: string): bigint | null {
    // Retire l'éventuel identifiant de zone (`fe80::1%eth0`).
    const zone = ip.split("%")[0];

    // IPv4-mapped `::ffff:127.0.0.1`.
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(zone);
    if (mapped) {
        const v4 = parseIpv4(mapped[1]);
        return v4 === null ? null : (0xffffn << 32n) | BigInt(v4);
    }

    const halves = zone.split("::");
    if (halves.length > 2) return null;

    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

    let parts: string[];
    if (halves.length === 1) {
        if (head.length !== 8) return null;
        parts = head;
    } else {
        const missing = 8 - head.length - tail.length;
        if (missing < 0) return null;
        parts = [...head, ...Array(missing).fill("0"), ...tail];
    }

    let value = 0n;
    for (const part of parts) {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        value = (value << 16n) | BigInt(parseInt(part, 16));
    }
    return value;
}

function isPrivateIpv6(value: bigint): boolean {
    const top = (bits: number) => value >> BigInt(128 - bits);

    if (value === 0n || value === 1n) return true; // :: et ::1
    if (top(7) === 0x7en) return true;             // fc00::/7 (ULA)
    if (top(10) === 0x3fan) return true;           // fe80::/10 (link-local)
    if (top(8) === 0xffn) return true;             // ff00::/8 (multicast)
    if (top(32) === 0x20010db8n) return true;      // 2001:db8::/32 (documentation)
    if (top(64) === 0x0100n) return true;          // 100::/64 (discard-only)

    // IPv4-mapped (::ffff:0:0/96) et NAT64 (64:ff9b::/96) : on vérifie l'IPv4 embarquée.
    if (top(96) === 0xffffn || top(96) === 0x0064ff9b0000000000000000n) {
        return isPrivateIpv4(Number(value & 0xffffffffn));
    }

    return false;
}

/** True si l'adresse est privée/réservée (ou invalide → fail-closed). */
export function isPrivateIp(ip: string): boolean {
    const v4 = parseIpv4(ip);
    if (v4 !== null) return isPrivateIpv4(v4);

    const v6 = parseIpv6(ip);
    if (v6 !== null) return isPrivateIpv6(v6);

    return true;
}
