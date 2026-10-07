#!/usr/bin/env python3
"""Siphon des salles tactiques d'un donjon depuis un client Dofus Unity local.

Usage :
    set DOFUS_UNITY_DIR=A:\\Dofus\\Dofus Unity\\Dofus-dofus3
    py scripts/siphon-tactical-maps.py --dungeon 118 --out src/lib/dungeons/x.ts

Mesuré sur client 3.6.11.15 (UnityPy requis : pip install UnityPy Pillow) :
- donjon : StreamingAssets/Content/Data/data_assets_dungeonsdataroot.asset.bundle
- salles : StreamingAssets/Content/Map/Data/mapdata_assets_world_*.bundle
  (cellsData : red / blue / blocked = los == 0 or nonWalkableDuringFight == 1,
  règle calibrée visuellement contre la preview touche L)
- monstres : sous-zone de la salle 1 (pool, grade max), noms via Content/I18n/fr.bin

Sortie : fragment TypeScript (salles + monstres) à coller dans un fichier de
données (voir src/lib/dungeons/fers-tyrannie.ts). Les compos par salle/butin
sont décidées côté serveurs Ankama : le script ne les invente pas.
"""

import argparse
import os
import struct
import sys
from pathlib import Path

import UnityPy
import UnityPy.config

UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.0f1"


def fail(msg: str) -> None:
    print(f"ERREUR : {msg}", file=sys.stderr)
    sys.exit(1)


def load_i18n(fr_bin: Path):
    d = fr_bin.read_bytes()
    count = struct.unpack_from("<I", d, 3)[0]
    off = 7

    def get(key: int) -> str:
        for i in range(count):
            k, pos = struct.unpack_from("<II", d, off + 8 * i)
            if k == key:
                ln = d[pos]
                return d[pos + 1 : pos + 1 + ln].decode("utf-8", errors="replace")
        return f"#{key}"

    return get


def norm(s: str) -> str:
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dungeon", required=True, help="id numérique ou nom du donjon")
    ap.add_argument("--out", default=None, help="fichier TS de sortie (stdout sinon)")
    args = ap.parse_args()

    root = os.environ.get("DOFUS_UNITY_DIR")
    if not root:
        fail("DOFUS_UNITY_DIR manquant (racine du client, ex. A:\\Dofus\\Dofus Unity\\Dofus-dofus3)")
    game = Path(root)
    data = game / "Dofus_Data" / "StreamingAssets" / "Content" / "Data"
    mapdata = game / "Dofus_Data" / "StreamingAssets" / "Content" / "Map" / "Data"
    i18n = game / "Dofus_Data" / "StreamingAssets" / "Content" / "I18n" / "fr.bin"
    for p in (data, mapdata, i18n):
        if not p.exists():
            fail(f"introuvable : {p}")
    tr = load_i18n(i18n)

    env = UnityPy.load(str(data / "data_assets_dungeonsdataroot.asset.bundle"))
    dungeon = None
    for o in env.objects:
        if o.type.name != "MonoBehaviour":
            continue
        for r in o.read_typetree()["references"]["RefIds"]:
            dd = r.get("data")
            if not isinstance(dd, dict) or "mapIds" not in dd:
                continue
            if args.dungeon.isdigit() and int(args.dungeon) == dd["id"]:
                dungeon = dd
                break
            if not args.dungeon.isdigit() and norm(args.dungeon) in norm(tr(dd["nameId"])):
                dungeon = dd
                break
        break
    if dungeon is None:
        fail(f"donjon introuvable : {args.dungeon}")
    print(f"donjon {dungeon['id']} : {tr(dungeon['nameId'])} maps={dungeon['mapIds']}", file=sys.stderr)

    # Localise les bundles contenant les maps (scan des containers).
    bundles = sorted(mapdata.glob("mapdata_assets_world_*.bundle"))
    want = {f"map_{m}.asset" for m in dungeon["mapIds"]}
    found: dict[str, Path] = {}
    for i, b in enumerate(bundles):
        if i % 100 == 0:
            print(f"scan {i}/{len(bundles)}...", file=sys.stderr)
        try:
            e = UnityPy.load(str(b))
            for k in e.container.keys():
                if k in want:
                    found[k] = b
        except Exception as ex:  # noqa: BLE001 - un bundle illisible ne bloque pas le lot
            print(f"ignore {b.name} : {ex}", file=sys.stderr)
    missing = want - set(found)
    if missing:
        fail(f"maps sans bundle : {sorted(missing)}")

    # Positions salles + sous-zone (pool de monstres).
    pos_env = UnityPy.load(str(data / "data_assets_mappositionsroot.asset.bundle"))
    positions = {}
    for o in pos_env.objects:
        if o.type.name != "MonoBehaviour":
            continue
        for r in o.read_typetree()["references"]["RefIds"]:
            dd = r.get("data")
            if isinstance(dd, dict) and dd.get("id") in dungeon["mapIds"]:
                positions[dd["id"]] = dd
        break

    lines = []
    lines.append(f"// Siphon client (dofus3) — donjon {dungeon['id']} « {tr(dungeon['nameId'])} ».")
    lines.append("// Règle obstacles : los == 0 || nonWalkableDuringFight == 1 (gris 3D).")
    lines.append("// Règle trous : mov == 0 && los == 1 (noir, non marchable, n'arrête pas la vue).")
    lines.append("export const SERVITUDE_ROOMS = [")
    for idx, mid in enumerate(dungeon["mapIds"], start=1):
        asset = f"map_{mid}.asset"
        env = UnityPy.load(str(found[asset]))
        name = tr(positions[mid]["nameId"]).split(" - ")[-1] if mid in positions else f"salle {idx}"
        for o in env.objects:
            if o.type.name != "MonoBehaviour":
                continue
            tt = o.read_typetree()
            if tt.get("m_Name") != f"map_{mid}":
                continue
            cells = tt["mapData"]["cellsData"]
            red = sorted(c["cellNumber"] for c in cells if c.get("red"))
            blue = sorted(c["cellNumber"] for c in cells if c.get("blue"))
            blocked = sorted(
                c["cellNumber"]
                for c in cells
                if c.get("los") == 0 or c.get("nonWalkableDuringFight") == 1
            )
            holes = sorted(
                c["cellNumber"] for c in cells if c.get("mov") == 0 and c.get("los") == 1
            )
            lines.append("    {")
            lines.append(f"        index: {idx},")
            lines.append(f"        mapId: {mid},")
            lines.append(f'        name: "{name}",')
            lines.append(f"        red: {red},")
            lines.append(f"        blue: {blue},")
            lines.append(f"        blocked: {blocked},")
            lines.append(f"        holes: {holes},")
            lines.append("    },")
    lines.append("];")

    out = "\n".join(lines) + "\n"
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
        print(f"écrit : {args.out}", file=sys.stderr)
    else:
        print(out)


if __name__ == "__main__":
    main()
