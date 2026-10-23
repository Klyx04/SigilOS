import { redirect } from "next/navigation";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { getOrCreateRushSylvestreGuide } from "@/server/actions/optimized-guide-actions";
import { buildRushBranches, type RushBranchSequence } from "@/lib/rush-branches";
import { RushSylvestreAdminClient } from "./RushSylvestreAdminClient";

export const dynamic = "force-dynamic";

export default async function RushSylvestreGodPage() {
  // P2 — un sous-god avec la brique "game-data-rush" accède aussi (sinon super-admin).
  const isGod = await isSuperAdmin() || await canAccessBrick("game-data-rush");
  if (!isGod) redirect("/dashboard");

  const guide = await getOrCreateRushSylvestreGuide();

  // S4-1 — la vue Branches est calculée ICI (règle pure) : le client reste léger et une seule
  // source alimente les quatre surfaces du guide.
  const sequences: RushBranchSequence[] = (guide?.milestones ?? []).flatMap((milestone) =>
    (milestone.sequences ?? []).map((seq) => ({
      id: seq.id,
      order: seq.order,
      subGuideName: seq.subGuideName,
      alignReq: seq.alignReq ?? null,
      alignOrderCode: seq.alignOrderCode ?? null,
      alignLevelReq: seq.alignLevelReq ?? null,
    })),
  );
  const branches = buildRushBranches(sequences);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RushSylvestreAdminClient guide={guide as any} branches={branches} />;
}
