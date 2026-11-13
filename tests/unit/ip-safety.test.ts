import { describe, it, expect } from "vitest";
import { isPrivateIp } from "@/lib/ip-safety";

/**
 * AUD-03 (audit 13/11/2026) — le contrôle SSRF doit couvrir IPv4 **et** IPv6.
 * Les cas `fc00::/7`, `::`, `::ffff:127.0.0.1` et `ff00::/8` manquaient.
 */
describe("isPrivateIp — IPv4 et IPv6", () => {
    it("bloque les plages IPv4 privées et réservées", () => {
        for (const ip of [
            "0.0.0.0",
            "10.0.0.1",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.169.254",
            "172.16.0.1",
            "192.168.1.1",
            "192.0.2.10",
            "198.18.0.1",
            "198.51.100.10",
            "203.0.113.10",
            "224.0.0.1",
            "240.0.0.1",
        ]) {
            expect(isPrivateIp(ip), ip).toBe(true);
        }
    });

    it("laisse passer les IPv4 publiques", () => {
        for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
            expect(isPrivateIp(ip), ip).toBe(false);
        }
    });

    it("bloque les IPv6 loopback, non spécifiées, ULA, link-local et multicast", () => {
        for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1"]) {
            expect(isPrivateIp(ip), ip).toBe(true);
        }
    });

    it("bloque les IPv4-mapped et NAT64 qui pointent vers une IPv4 privée", () => {
        expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
        expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
        expect(isPrivateIp("64:ff9b::7f00:1")).toBe(true);
        expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    });

    it("laisse passer les IPv6 publiques", () => {
        for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
            expect(isPrivateIp(ip), ip).toBe(false);
        }
    });

    it("refuse une valeur invalide (fail-closed)", () => {
        expect(isPrivateIp("pas-une-ip")).toBe(true);
        expect(isPrivateIp("")).toBe(true);
    });
});
