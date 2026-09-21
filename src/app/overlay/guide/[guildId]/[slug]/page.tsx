import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { toOcrePanelData, type OcrePanelData } from "@/lib/ocre-soul-stones";
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

  // Progress du joueur
  let allProgress: any[] = [];
  try {
    const prog = await getGuildOptimizedGuideProgress(slug, guildId);
    allProgress = prog.allProgress || [];
  } catch { /* non-fatal */ }

  const isMainChar = !character || character === "PRINCIPAL";
  const overlayChar = isMainChar
    ? {
        pseudo: (user as any)?.pseudoDofus || (user as any)?.name || "Principal",
        classe: (user as any)?.dofusClass || null,
        isMain: true,
      }
    : { pseudo: character, classe: null, isMain: false };

  // ─── Panneau Quête Ocre (overlay INTERNE uniquement) ────────────────────────
  // Le bouton n'apparaît que si le MEMBRE a lié son compte Metamob : on lit d'abord
  // le pseudo (lecture DB légère, cloisonnée par guilde), et seulement dans ce cas on
  // interroge la progression (mise en cache 120 s côté action, comme le dashboard).
  let ocre: OcrePanelData | null = null;
  try {
    const profile = await db.userProfile.findFirst({
      where: {
        userId: session.user.id,
        guild: { discordGuildId: guildId },
        status: "ACTIVE",
      },
      select: { metamobPseudo: true },
    });

    if (profile?.metamobPseudo) {
      const { getMyOcreProgress } = await import("@/server/actions/ocre-actions");
      const ocreRes = await getMyOcreProgress(guildId);
      // Échec Metamob : on garde le bouton (l'utilisateur l'a bien lié) et le panneau
      // propose de réessayer — jamais d'accès refusé par défaut, jamais de plantage.
      ocre = ocreRes.success && ocreRes.data
        ? toOcrePanelData({ ...ocreRes.data, pseudo: profile.metamobPseudo })
        : { monsters: [], currentStep: 0, totalSteps: 0, unavailable: true };
    }
  } catch (e) {
    logger.error("[Overlay Guide] Metamob Ocre fetch failed (non-fatal)", { error: e });
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
      milestones={guide.milestones as any[]}
      allProgress={allProgress}
      altPseudo={altPseudo || null}
      character={overlayChar}
      ocre={ocre}
    />
  );
}
