/**
 * Gardes — Lot 2 du plan refonte Rush Sylvestre : **temps réel dé-slopé & présence honnête**.
 *
 *  1. Le fil d'activité affichait un encart doré sans photo de profil : depuis, la phrase
 *     vient d'UNE source (`formatGuideLiveEvent`) et la ligne porte l'**avatar Discord**.
 *  2. Le badge « Rush Live » annonçait « N en ligne » en repliant sur la **base** dès que le
 *     WebSocket était inactif : un membre qui a touché le guide hier n'est pas en ligne.
 *
 * 🛡️ Lecture seule : la règle pure est verrouillée par des cas, le câblage par une lecture
 * de source (commentaires retirés). Aucune base, aucun réseau.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { formatGuideLiveEvent } from "@/lib/guide-live-lines";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const TICKER = "src/components/dofus-quests/LiveActivityTicker.tsx";
const TOAST = "src/components/dofus-quests/rush/RushOverlayLiveToast.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const MEMBERS_MODAL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayMembersModal.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("formatGuideLiveEvent — une seule formulation par event", () => {
  it("porte l'avatar Discord et le nom de la quête quand le serveur les connaît", () => {
    expect(
      formatGuideLiveEvent({
        type: "step:validated",
        profileId: "p1",
        userName: "Arakne",
        userAvatar: "/a.png",
        subGuideRef: "GP7",
        stepNumber: 6,
        stepTitle: "L'Éternelle Moisson",
      })
    ).toEqual({
      text: "a validé « L'Éternelle Moisson »",
      kind: "step",
      name: "Arakne",
      avatar: "/a.png",
    });
  });

  it("replie sur la référence du sous-guide, jamais sur un numéro d'étape nu", () => {
    const line = formatGuideLiveEvent({
      type: "step:validated",
      profileId: "p1",
      userName: "Arakne",
      subGuideRef: "GP7",
      stepNumber: 6,
    });
    expect(line?.text).toBe("a validé « GP7 »");
    expect(line?.avatar).toBeUndefined();
  });

  it("accorde le pluriel d'un lot de quêtes validées", () => {
    const one = formatGuideLiveEvent({ type: "step:validated:batch", profileId: "p1", userName: "A", subGuideRef: "GP7", count: 1 });
    const many = formatGuideLiveEvent({ type: "step:validated:batch", profileId: "p1", userName: "A", subGuideRef: "GP7", count: 3 });
    expect(one?.text).toBe("a validé 1 quête");
    expect(many?.text).toBe("a validé 3 quêtes");
  });

  it("un heartbeat de repère n'annonce ni arrivée ni départ", () => {
    expect(formatGuideLiveEvent({ type: "presence:join", profileId: "p1", userName: "A", milestoneId: "m1" })).toBeNull();
    expect(formatGuideLiveEvent({ type: "presence:leave", profileId: "p1", userName: "A", milestoneId: "m1" })).toBeNull();
    expect(formatGuideLiveEvent({ type: "presence:join", profileId: "p1", userName: "A", milestoneId: "" })?.text).toBe(
      "est arrivé sur le guide"
    );
  });

  it("nomme une sortie sans pseudo, et ne rend rien d'un event inconnu", () => {
    expect(formatGuideLiveEvent({ type: "presence:leave", profileId: "p1", milestoneId: "" })?.name).toBe("Un membre");
    expect(formatGuideLiveEvent({ type: "inconnu" } as never)).toBeNull();
  });
});

describe("fil d'activité & toast — une seule source, avec les avatars", () => {
  it("les deux surfaces consomment la règle pure et dessinent un avatar", () => {
    for (const path of [TICKER, TOAST]) {
      const code = codeOf(path);
      expect(code, `${path} : phrase recopiée`).toMatch(/formatGuideLiveEvent/);
      expect(code, `${path} : aucun avatar`).toMatch(/avatar/);
      // Le repli initiale est obligatoire : une bulle vide n'est pas une identité.
      expect(code, `${path} : pas de repli initiale`).toMatch(/charAt\(0\)\.toUpperCase\(\)/);
    }
  });

  it("le toast est monté DANS l'overlay (Sonner vise le document principal, pas la PiP)", () => {
    expect(codeOf(OVERLAY)).toMatch(/<RushOverlayLiveToast events=\{guideLive\.events\}/);
    expect(codeOf(TOAST)).toMatch(/pointer-events-none/);
    expect(codeOf(TOAST)).toMatch(/TOAST_TTL_MS = 3000/);
  });
});

describe("présence honnête — en ligne ne veut dire qu'une chose", () => {
  it("le badge ne compte que la présence WebSocket, et le dit quand elle manque", () => {
    const code = codeOf(DASHBOARD);
    // Le repli menteur (membres de la base dits « en ligne ») a disparu.
    expect(code).not.toMatch(/livePresenceMembers/);
    expect(code).toMatch(/connectionStatus !== "connected"\) return \[\]/);
    expect(code).toMatch(/présence indisponible/);
  });

  it("la modale sépare les connectés de la dernière position connue", () => {
    const code = codeOf(DASHBOARD);
    expect(code).toMatch(/En ligne maintenant \(\{liveMembers\.length\}\)/);
    expect(code).toMatch(/Hors ligne — dernière position connue \(\{offlineMembers\.length\}\)/);
    expect(code).toMatch(/function RushLiveMemberRow\(/);
  });

  it("la modale des membres de l'overlay a le même groupe « en ligne » et ferme en PiP", () => {
    const code = codeOf(MEMBERS_MODAL);
    expect(code).toMatch(/liveMembers\?: OverlayMember\[\]/);
    expect(code).toMatch(/En ligne maintenant \(\{liveMembers\.length\}\)/);
    // Échap sur la fenêtre du document PROPRIÉTAIRE (sinon rien ne ferme dans la PiP).
    expect(code).toMatch(/ownerDocument\.defaultView/);
    expect(code).not.toMatch(/window\.addEventListener\("keydown", onKey\)/);
  });

  it("la présence en base sans consommateur client est supprimée (aucun code mort)", () => {
    expect(existsSync("src/components/dofus-quests/RushLivePopover.tsx")).toBe(false);
  });
});
