import { WorldmapPublicOverlayClient } from "./WorldmapPublicOverlayClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ x?: string; y?: string; zoom?: string; world?: string }>;
};

export default async function WorldmapPublicOverlayPage({ searchParams }: Props) {
  const { x, y, zoom, world } = await searchParams;

  const xNum = x ? parseFloat(x) : undefined;
  const yNum = y ? parseFloat(y) : undefined;
  const zoomNum = zoom ? parseInt(zoom) : undefined;
  const worldIdNum = world ? parseInt(world) : undefined;

  return (
    <WorldmapPublicOverlayClient
      initialX={xNum}
      initialY={yNum}
      initialZoom={zoomNum}
      initialWorldId={worldIdNum}
    />
  );
}
