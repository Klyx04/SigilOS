import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
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
    />
  );
}
