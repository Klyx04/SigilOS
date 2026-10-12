import { describe, it, expect } from "vitest";
import { resolvePortalAccess } from "@/lib/onboarding-gating";

describe("resolvePortalAccess — le portail ne ment plus après retrait de rôle (03/10/2026)", () => {
    it("profil ACTIVE périmé + rôle live KO → Rôle requis (cas SigilOS mesuré)", () => {
        expect(
            resolvePortalAccess({ isAdmin: false, isGod: false, dbActive: true, liveOk: false })
        ).toEqual({ hasAccess: false, accessLabel: "Rôle d'accès requis" });
    });

    it("rôle live OK sans profil encore créé → Membre Actif (nouveau dispo dès l'octroi)", () => {
        expect(
            resolvePortalAccess({ isAdmin: false, isGod: false, dbActive: false, liveOk: true })
        ).toEqual({ hasAccess: true, accessLabel: "Membre Actif" });
    });

    it("admin Discord → Administrateur même sans vérif live", () => {
        expect(
            resolvePortalAccess({ isAdmin: true, isGod: false, dbActive: false, liveOk: false })
        ).toEqual({ hasAccess: true, accessLabel: "Administrateur" });
    });

    it("God → Administrateur (bypass comme le gate)", () => {
        expect(
            resolvePortalAccess({ isAdmin: false, isGod: true, dbActive: false, liveOk: false })
        ).toEqual({ hasAccess: true, accessLabel: "Administrateur" });
    });

    it("Discord KO → repli base (fail-safe affichage, gate fail-closed)", () => {
        expect(
            resolvePortalAccess({ isAdmin: false, isGod: false, dbActive: true, liveOk: null })
        ).toEqual({ hasAccess: true, accessLabel: "Membre Actif" });
        expect(
            resolvePortalAccess({ isAdmin: false, isGod: false, dbActive: false, liveOk: null })
        ).toEqual({ hasAccess: false, accessLabel: "Rôle d'accès requis" });
    });

    it("jamais de label menteur : Membre Actif implique admin/god/live/base", () => {
        const ok = resolvePortalAccess({ isAdmin: false, isGod: false, dbActive: false, liveOk: false });
        expect(ok.hasAccess).toBe(false);
    });
});
