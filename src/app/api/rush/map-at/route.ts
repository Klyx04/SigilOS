import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getWorldmapData } from "@/server/game/worldmap-data";

export const runtime = "nodejs";

/**
 * `GET /api/rush/map-at?x=&y=&world=` -> la carte HD (`/game-data/hd_maps/{mapId}.webp`)
 * de la position, dans le monde demande.
 *
 * Pourquoi une route : `worldmap.json` pese 1,5 Mo et vit cote serveur (cache process).
 * Le navigateur ne le telecharge jamais ; il ne demande qu une URL au clic.
 *
 * Regles :
 *  - (0,0) n est pas un lieu **dans le monde principal** -> 404 ; un sous-monde
 *    peut avoir une vraie carte a (0,0) (Blessures de Guerre, monde 24) ;
 *  - une carte imposee en God est servie AVANT cette restriction ;
 *  - le monde est celui de la position (`pos_tags.worldId`), jamais un defaut ;
 *  - on ne rend que si le WebP existe reellement sur le disque.
 */
export async function GET(request: NextRequest) {
  const x = Number(request.nextUrl.searchParams.get("x"));
  const y = Number(request.nextUrl.searchParams.get("y"));
  const worldParam = Number(request.nextUrl.searchParams.get("world"));
  const mapParam = Number(request.nextUrl.searchParams.get("mapId"));
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Carte imposee en God (`pos_tags.mapId`) : prioritaire, si le WebP existe.
  if (Number.isSafeInteger(mapParam) && mapParam > 0 && mapParam <= 2147483647) {
    const forced = `/game-data/hd_maps/${mapParam}.webp`;
    if (existsSync(join(process.cwd(), "public", forced))) {
      return NextResponse.json(
        { ok: true, mapId: mapParam, imageUrl: forced, source: "god" },
        { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" } }
      );
    }
  }

  // `(0,0)` n'est pas un lieu dans le monde principal (tas de cartes sans
  // coordonnees) ; un sous-monde peut avoir une vraie carte a `(0,0)`
  // (Blessures de Guerre, monde 24). La carte imposee ci-dessus est deja servie.
  const explicitSubWorld = Number.isSafeInteger(worldParam) && worldParam > 1;
  if (x === 0 && y === 0 && !explicitSubWorld) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const data = getWorldmapData();
  const maps = Array.isArray(data?.maps) ? (data.maps as Record<string, unknown>[]) : [];
  const worldId = Number.isSafeInteger(worldParam) && worldParam > 0 ? worldParam : null;
  const hits = maps.filter((m) => {
    if (Number(m.x) !== x || Number(m.y) !== y) return false;
    if (worldId === null) return true;
    const wm = Number(m.worldMap);
    return wm === worldId || (worldId === 1 && wm === -1);
  });

  for (const hit of hits) {
    const id = Number(hit.id);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const rel = `/game-data/hd_maps/${id}.webp`;
    if (!existsSync(join(process.cwd(), "public", rel))) continue;
    return NextResponse.json(
      { ok: true, mapId: id, worldId: Number(hit.worldMap), imageUrl: rel },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" } }
    );
  }

  return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
}