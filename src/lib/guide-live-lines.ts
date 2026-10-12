import type { GuideRealtimeEvent } from "@/lib/guide-realtime";

/** Nature d'une ligne d'activité : sert l'accent visuel, jamais la phrase. */
export type GuideLiveLineKind = "step" | "milestone" | "presence";

/**
 * Une ligne d'activité prête à afficher : `name` + `text` font une phrase complète
 * (« Arakne » + « a validé « L'Éternelle Moisson » »).
 */
export type GuideLiveLine = {
  text: string;
  kind: GuideLiveLineKind;
  name: string;
  /** Avatar Discord quand l'event en porte un (sinon repli sur l'initiale). */
  avatar?: string;
};

/**
 * Traduit un event temps réel de guide en ligne d'activité lisible, ou `null` quand
 * l'event ne mérite pas d'être affiché.
 *
 * SOURCE UNIQUE de la phrase : le fil d'activité du dashboard (`LiveActivityTicker`) et le
 * toast de l'overlay (`RushOverlayLiveToast`) consomment la MÊME fonction — deux
 * formulations pour le même event, c'est deux vérités (retour user 08/10/2026 : « le
 * ticker affichait un pavé doré sans photo de profil »).
 *
 * Fonction PURE (exportée pour être verrouillée par les tests, sans DOM).
 */
export function formatGuideLiveEvent(e: GuideRealtimeEvent): GuideLiveLine | null {
  switch (e.type) {
    case "step:validated": {
      // Le nom de la quête est le titre de l'étape quand le serveur le connaît ; sinon la
      // référence du sous-guide, jamais l'URL ni un numéro d'étape nu.
      const title = (e.stepTitle ?? "").trim();
      const ref = (e.subGuideRef ?? "").trim();
      const label = title ? `« ${title} »` : ref ? `« ${ref} »` : "une quête";
      return { text: `a validé ${label}`, kind: "step", name: e.userName, avatar: e.userAvatar };
    }
    case "step:validated:batch":
      return {
        text: `a validé ${e.count} quête${e.count > 1 ? "s" : ""}`,
        kind: "step",
        name: e.userName,
      };
    case "milestone:completed":
      return {
        text: `a terminé le chapitre « ${e.milestoneTitle} »`,
        kind: "milestone",
        name: e.userName,
      };
    case "presence:join":
      // Un heartbeat de repère n'annonce pas une arrivée : seul le join sans jalon en parle.
      if (e.milestoneId) return null;
      return { text: "est arrivé sur le guide", kind: "presence", name: e.userName, avatar: e.userAvatar };
    case "presence:leave":
      if (e.milestoneId) return null;
      return { text: "a quitté le guide", kind: "presence", name: e.userName ?? "Un membre" };
    default:
      return null;
  }
}
