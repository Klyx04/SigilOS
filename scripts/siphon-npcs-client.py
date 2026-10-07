#!/usr/bin/env python3
"""
Siphon des PNJ du client Dofus Unity vers prisma/seed-data/npcs/npcs-client.json.

Source : bundles du client installe (aucun appel reseau, 100 % local).
  - NpcsDataRoot : Content/Data/data_assets_npcsdataroot.asset.bundle
    (index id -> rid + table "references" avec NpcData en clair : id, nameId, look, gender)
  - Noms FR : Content/I18n/fr.bin, table [id int32, offset int32] puis
    [varint longueur][texte UTF-8] a chaque offset.

Dependances : UnityPy (pip install UnityPy).
Usage :
    python scripts/siphon-npcs-client.py "A:\\Dofus\\Dofus Unity\\Dofus-Beta"
    python scripts/siphon-npcs-client.py  # meme chemin par defaut

Mesure (client Beta 3.7.3.3, 07/10/2026) : 6 494 PNJ, 0 nom manquant,
0 caractere de remplacement (U+FFFD), ~575 Ko.
A rejouer a chaque MAJ du client, puis commit du JSON.
"""
import json
import os
import struct
import sys

DEFAULT_CLIENT = "A:\\Dofus\\Dofus Unity\\Dofus-Beta"


def read_varint(buf: bytes, pos: int):
    value = 0
    shift = 0
    while True:
        byte = buf[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7


def load_i18n(fr_bin: str):
    with open(fr_bin, "rb") as fh:
        data = fh.read()
    table = {}
    pos = 7
    prev_id = 0
    while True:
        nid, off = struct.unpack("<ii", data[pos:pos + 8])
        if nid <= prev_id or off < 0 or off >= len(data):
            break
        table[nid] = off
        prev_id = nid
        pos += 8

    def gettext(nid: int):
        off = table.get(nid)
        if off is None:
            return None
        length, start = read_varint(data, off)
        return data[start:start + length].decode("utf-8")  # strict

    return table, gettext


def main() -> int:
    client = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CLIENT
    data_bundle = os.path.join(
        client, "Dofus_Data", "StreamingAssets", "Content", "Data",
        "data_assets_npcsdataroot.asset.bundle",
    )
    fr_bin = os.path.join(
        client, "Dofus_Data", "StreamingAssets", "Content", "I18n", "fr.bin",
    )
    for path in (data_bundle, fr_bin):
        if not os.path.exists(path):
            print(f"Introuvable : {path}")
            return 1

    import UnityPy
    import UnityPy.config
    UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.0f1"

    _, gettext = load_i18n(fr_bin)
    env = UnityPy.load(data_bundle)
    refs = None
    for obj in env.objects:
        tree = obj.read_typetree()
        if isinstance(tree, dict) and tree.get("m_Name") == "NpcsDataRoot":
            refs = tree["references"]["RefIds"]
            break
    if refs is None:
        print("NpcsDataRoot introuvable dans le bundle")
        return 1

    out = []
    missing = 0
    for ref in refs:
        entry = ref["data"]
        try:
            name = gettext(entry.get("nameId"))
        except UnicodeDecodeError:
            name = None
        if not name:
            missing += 1
            continue
        if "�" in name:
            missing += 1
            continue
        out.append({
            "id": entry.get("id"),
            "name": name,
            "look": entry.get("look"),
            "gender": entry.get("gender"),
        })
    out.sort(key=lambda e: e["id"])

    dest = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "prisma", "seed-data", "npcs", "npcs-client.json",
    )
    # Garde-fou : on n'ecrase jamais le JSON avec une extraction degradee.
    if missing > 0 or len(out) < 6000:
        print(f"Extraction degradee : {len(out)} PNJ, {missing} noms illisibles — JSON conserve")
        return 1
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"OK : {len(out)} PNJ -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
