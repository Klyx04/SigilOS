import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getOrCreateRushSylvestreGuide } from "@/server/actions/optimized-guide-actions";
import { RushSylvestreAdminClient } from "./RushSylvestreAdminClient";

export const dynamic = "force-dynamic";

export default async function RushSylvestreGodPage() {
  const isGod = await isSuperAdmin();
  if (!isGod) redirect("/dashboard");

  const guide = await getOrCreateRushSylvestreGuide();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RushSylvestreAdminClient guide={guide as any} />;
}
