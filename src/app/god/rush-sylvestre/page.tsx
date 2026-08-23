import { redirect } from "next/navigation";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { getOrCreateRushSylvestreGuide } from "@/server/actions/optimized-guide-actions";
import { RushSylvestreAdminClient } from "./RushSylvestreAdminClient";

export const dynamic = "force-dynamic";

export default async function RushSylvestreGodPage() {
  // P2 — un sous-god avec la brique "game-data-rush" accède aussi (sinon super-admin).
  const isGod = await isSuperAdmin() || await canAccessBrick("game-data-rush");
  if (!isGod) redirect("/dashboard");

  const guide = await getOrCreateRushSylvestreGuide();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RushSylvestreAdminClient guide={guide as any} />;
}
