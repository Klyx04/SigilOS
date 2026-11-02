import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress, getRushResourceChecks } from "@/server/actions/optimized-guide-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { toOcrePanelData, type OcrePanelData } from "@/lib/ocre-soul-stones";
import { resolveRushRoute } from "@/lib/rush-route";
import { resolveDofusClassId } from "@/lib/dofus-assets";
import GuideOverlayClient from "./GuideOverlayClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ guildId: string; slug: string }>;
  searchParams: Promise<{ character?: string }>;
};

export default async function GuideOverlayPage({ params, searchParams }: Props) {
  const { guildId, slug } = await params;
  const { character } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await getUserContext(guildId);
  if (!user.isAuthenticated || !user.isMember) redirect("/");

  const altPseudo = character && character !== "PRINCIPAL" ? character : undefined;

  let guideContext: Awaited<ReturnType<typeof getOptimizedGuideDetail>>;
  try {
    guideContext = await getOptimizedGuideDetail(slug, guildId, altPseudo);
  } catch {
    notFound();
  }

  if (!guideContext.success || !guideContext.guide) notFound();

  const guide = guideContext.guide as any;
  if (guide.displayMode !== "TIMELINE") notFound();

  // Coches de ressources du membre (par personnage) : la fiche de quête et la modale
  // « Ressources à prévoir » les éditent. Échec non bloquant : on part d'un ensemble vide.
  let initialResourceChecks: string[] = [];
  try {
    const checks = await getRushResourceChecks(guildId, slug, altPseudo);
    if (checks.success) initialResourceChecks = checks.keys;
  } catch (e) {
    logger.warn("[Overlay Guide] Resource checks fetch failed (non-fatal)", { error: e });
  }

  // Progress du joueur
  let allProgress: any[] = [];
  try {
    const prog = await getGuildOptimizedGuideProgress(slug, guildId);
    allProgress = prog.allProgress || [];
  } catch { /* non-fatal */ }

  const isMainChar = !character || character === "PRINCIPAL";

  // ─── Profil du membre : UNE lecture pour la route ET le panneau Ocre ────────
  // La route (cité / Ordre / classe) et l'état Metamob viennent du même profil : une
  // seule requête, cloisonnée par guilde. Échec non bloquant : sans profil, la route
  // retombe sur « aucun choix » (rien n'est masqué) et l'Ocre est « indisponible ».
  let ocre: OcrePanelData | null = null;
  // V-G — état explicite : « non lié » n'est PAS une erreur. Avant, `ocre === null`
  // masquait le bouton du header, donc l'utilisateur n'avait AUCUNE entrée pour lier
  // son compte depuis la fenêtre de jeu (impasse mesurée).
  let ocreState: "ready" | "not-linked" | "error" = "not-linked";
  let profile: {
    alignment: string | null;
    alignmentOrder: string | null;
    classe: string | null;
    altPseudos: unknown;
    metamobPseudo: string | null;
  } | null = null;
  try {
    profile = await db.userProfile.findFirst({
      where: {
        userId: session.user.id,
        guild: { discordGuildId: guildId },
        status: "ACTIVE",
      },
      select: {
        metamobPseudo: true,
        alignment: true,
        alignmentOrder: true,
        classe: true,
        altPseudos: true,
      },
    });
  } catch (e) {
    // Non fatal : l'overlay s'ouvre sans route ni Ocre ⇒ `warn` (jamais `error` : pas d'Issue).
    // L'état Ocre passe à « indisponible » : sans profil on ne peut pas savoir si le
    // compte est lié, et proposer la liaison serait trompeur.
    ocreState = "error";
    logger.warn("[Overlay Guide] Profile fetch failed (non-fatal)", { error: e });
  }

  // Le personnage SÉLECTIONNÉ fait foi (mule incluse) : sans son Ordre, les 15 quêtes
  // d'Ordre de la cité restaient affichées au lieu des 5 de son Ordre (défaut 6, L2).
  const selectedMule = altPseudo
    ? (Array.isArray(profile?.altPseudos) ? (profile!.altPseudos as any[]) : [])
        .find((m) => m?.pseudo === altPseudo) ?? null
    : null;
  const routeCamp = selectedMule ? selectedMule.alignment ?? null : profile?.alignment ?? null;
  const routeOrder = selectedMule ? selectedMule.alignmentOrder ?? null : profile?.alignmentOrder ?? null;
  const routeClass = resolveDofusClassId(selectedMule ? selectedMule.classe : profile?.classe);
  const routeMilestones = resolveRushRoute((guide.milestones as any[]) || [], {
    camp: routeCamp,
    order: routeOrder,
    playerClass: routeClass,
  });

  const overlayChar = isMainChar
    ? {
        pseudo: (user as any)?.pseudoDofus || (user as any)?.name || "Principal",
        classe: profile?.classe ?? (user as any)?.dofusClass ?? null,
        isMain: true,
      }
    : { pseudo: character, classe: selectedMule?.classe ?? null, isMain: false };

  // ─── Panneau Quête Ocre (overlay INTERNE uniquement) ────────────────────────
  // Le bouton n'apparaît que si le MEMBRE a lié son compte Metamob : on lit d'abord
  // le pseudo (lecture DB légère, cloisonnée par guilde), et seulement dans ce cas on
  // interroge la progression (mise en cache 120 s côté action, comme le dashboard).
  try {
    if (profile?.metamobPseudo) {
      const { getMyOcreProgress } = await import("@/server/actions/ocre-actions");
      const ocreRes = await getMyOcreProgress(guildId);
      // Échec Metamob : on garde le bouton (l'utilisateur l'a bien lié) et le panneau
      // propose de réessayer — jamais d'accès refusé par défaut, jamais de plantage.
      if (ocreRes.success && ocreRes.data) {
        ocre = toOcrePanelData({ ...ocreRes.data, pseudo: profile.metamobPseudo });
        ocreState = "ready";
      } else {
        ocre = { monsters: [], currentStep: 0, totalSteps: 0, unavailable: true };
        ocreState = "error";
      }
    }
  } catch (e) {
    // Non fatal : l'overlay s'affiche avec le panneau Ocre « indisponible » ⇒ `warn`
    // (jamais `error` : ce serait une Issue Sentry pour un cas prévu).
    ocreState = "error";
    logger.warn("[Overlay Guide] Metamob Ocre fetch failed (non-fatal)", { error: e });
  }

  return (
    <GuideOverlayClient
      guildId={guildId}
      guide={{
        id: guide.id,
        name: guide.name,
        slug: guide.slug,
        description: guide.description,
        imageUrl: guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png",
      }}
      milestones={routeMilestones as any[]}
      allProgress={allProgress}
      altPseudo={altPseudo || null}
      character={overlayChar}
      selfAlignment={routeCamp}
      selfOrder={routeOrder}
      ocre={ocre}
      ocreState={ocreState}
      initialResourceChecks={initialResourceChecks}
    />
  );
}
