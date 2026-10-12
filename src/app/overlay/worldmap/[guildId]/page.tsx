import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import AccessDenied from "@/components/access-denied";
import { WorldmapStandaloneOverlayClient } from "./WorldmapStandaloneOverlayClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ x?: string; y?: string; zoom?: string; world?: string }>;
};

export default async function WorldmapOverlayPage({ params, searchParams }: Props) {
  const { guildId } = await params;
  const { x, y, zoom, world } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await getUserContext(guildId);
  if (!user.isAuthenticated || !user.isMember || !user.canViewWorldmap) return <AccessDenied />;

  const enabled = await isModuleEnabled(guildId, "worldmap");
  if (!enabled && !user.isSuperAdmin) return <AccessDenied />;

  const xNum = x ? parseFloat(x) : undefined;
  const yNum = y ? parseFloat(y) : undefined;
  const zoomNum = zoom ? parseInt(zoom) : undefined;
  const worldIdNum = world ? parseInt(world) : undefined;

  return (
    <WorldmapStandaloneOverlayClient
      guildId={guildId}
      initialX={xNum}
      initialY={yNum}
      initialZoom={zoomNum}
      initialWorldId={worldIdNum}
    />
  );
}
