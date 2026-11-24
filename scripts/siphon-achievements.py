#!/usr/bin/env python3
"""Siphon des **succès** officiels du client Dofus 3 — « succès → quêtes ».

Un succès n'est pas une quête : c'est un **groupe de quêtes** (celles qui le
valident), avec son nom et son icône. Le client le porte dans
`AchievementsDataRoot` (nom, `iconId`, points) et `AchievementObjectivesDataRoot`
(les objectifs, dont le `criterion` `Qf=<id>` = « quête terminée »).

Sortie : `public/game-data/achievements.json` — **faits de progression
uniquement** (id, nom, icône, ids de quêtes). Aucune description Ankama.

Usage :
    python scripts/siphon-achievements.py
    python scripts/siphon-achievements.py --dofus-dir "C:\\...\\Dofus-dofus3"
    python scripts/siphon-achievements.py --out src/temp/achievements.json
"""

import argparse
import json
import re
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import UnityPy
    import UnityPy.config as cfg
except ImportError:
    print("ERREUR : UnityPy est requis. Lance : pip install UnityPy", file=sys.stderr)
    sys.exit(1)

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DEFAULT_SEARCH_PATHS = [
    Path(r"C:\Users\user\AppData\Local\Ankama\Dofus-dofus3"),
    Path(r"A:\Dofus\Dofus Unity\Dofus-dofus3"),
    Path(r"C:\Program Files\Ankama\Dofus"),
]

DATA_FILES = {
    "achievements": "data_assets_achievementsdataroot.asset.bundle",
    "achievement_objectives": "data_assets_achievementobjectivesdataroot.asset.bundle",
    "quests": "data_assets_questsdataroot.asset.bundle",
}


def find_dofus_dir(custom_path: str | None = None) -> Path:
    if custom_path:
        path = Path(custom_path)
        if path.exists() and (path / "Dofus_Data").exists():
            return path
        print(f"ATTENTION : dossier invalide : {custom_path}", file=sys.stderr)
    for candidate in DEFAULT_SEARCH_PATHS:
        if candidate.exists() and (candidate / "Dofus_Data").exists():
            return candidate
    print("ERREUR : impossible de localiser Dofus Unity. Utilise --dofus-dir.", file=sys.stderr)
    sys.exit(1)


def detect_unity_version(dofus_dir: Path) -> str:
    managers = dofus_dir / "Dofus_Data" / "globalgamemanagers"
    if managers.exists():
        head = managers.read_bytes()[:256]
        match = re.search(rb"(\d{4}\.\d+\.\d+[abfp]\d+)", head)
        if match:
            return match.group(1).decode("ascii")
    return "6000.3.16f1"


def load_i18n(fr_bin_path: Path):
    raw = fr_bin_path.read_bytes()
    count = struct.unpack_from("<I", raw, 3)[0]
    index = {}
    base = 7
    for i in range(count):
        pos = base + i * 8
        if pos + 8 > len(raw):
            break
        string_id = struct.unpack_from("<I", raw, pos)[0]
        offset = struct.unpack_from("<I", raw, pos + 4)[0]
        index[string_id] = offset

    def get_str(string_id: int) -> str:
        if not string_id or string_id not in index:
            return ""
        offset = index[string_id]
        length = 0
        shift = 0
        while offset < len(raw):
            byte = raw[offset]
            offset += 1
            length |= (byte & 0x7F) << shift
            if not (byte & 0x80):
                break
            shift += 7
        if length == 0:
            return ""
        end = min(offset + length, len(raw))
        try:
            return raw[offset:end].decode("utf-8").strip()
        except UnicodeDecodeError:
            return raw[offset:end].decode("latin-1", errors="replace").strip()

    return get_str


def load_refs(bundle_path: Path) -> dict:
    """Lit un data root Unity (`references.RefIds[].data`) — indexé par `id`."""
    if not bundle_path.exists():
        print(f"  ⚠️ bundle absent : {bundle_path.name}", file=sys.stderr)
        return {}
    refs = {}
    env = UnityPy.load(str(bundle_path))
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            tree = obj.read_typetree()
        except Exception:
            continue
        for ref in tree.get("references", {}).get("RefIds", []):
            data = ref.get("data", {})
            if isinstance(data, dict) and "id" in data:
                refs[data["id"]] = data
    return refs


def quest_ids_of(criterion: str) -> list[int]:
    """Ids de quêtes d'un critère : `Qf=12&(Qf=13|Qf=14)` → [12, 13, 14]."""
    return sorted({int(value) for value in re.findall(r"Q[fqa]=(\d+)", criterion or "") if value.isdigit()})


def success_ids_of(criterion: str) -> list[int]:
    """Ids de succès prérequis d'un critère : `OA=<achievementId>` (succès terminé)."""
    return sorted({int(value) for value in re.findall(r"OA=(\d+)", criterion or "") if value.isdigit()})


def main() -> None:
    parser = argparse.ArgumentParser(description="Siphon des succès officiels (client Dofus 3).")
    parser.add_argument("--dofus-dir", help="Dossier Dofus Unity (Dofus-dofus3)")
    parser.add_argument("--out", default="public/game-data/achievements.json", help="Fichier JSON de sortie")
    args = parser.parse_args()

    dofus_dir = find_dofus_dir(args.dofus_dir)
    version = detect_unity_version(dofus_dir)
    cfg.FALLBACK_UNITY_VERSION = version
    print(f"Client détecté : {dofus_dir} (Unity {version})")

    streaming = dofus_dir / "Dofus_Data" / "StreamingAssets"
    data_dir = streaming / "Content" / "Data"
    i18n_path = streaming / "Content" / "I18n" / "fr.bin"
    if not i18n_path.exists():
        print(f"ERREUR : {i18n_path} introuvable.", file=sys.stderr)
        sys.exit(1)

    get_str = load_i18n(i18n_path)
    print("Chargement des data roots…")
    achievements = load_refs(data_dir / DATA_FILES["achievements"])
    objectives = load_refs(data_dir / DATA_FILES["achievement_objectives"])
    quests = load_refs(data_dir / DATA_FILES["quests"])
    print(f"  succès    : {len(achievements)} entrées")
    print(f"  objectifs : {len(objectives)} entrées")
    print(f"  quêtes    : {len(quests)} entrées")
    if not achievements:
        print("ERREUR : aucun succès lu.", file=sys.stderr)
        sys.exit(1)

    rows = []
    with_quests = 0
    with_successes = 0
    covered_quests: set[int] = set()
    unresolved_names = 0
    for achievement_id, data in achievements.items():
        name = get_str(data.get("nameId")) if isinstance(data.get("nameId"), int) else ""
        if not name:
            unresolved_names += 1
            continue
        quest_ids: set[int] = set()
        success_ids: set[int] = set()
        for objective_id in data.get("objectiveIds") or []:
            objective = objectives.get(objective_id)
            if not isinstance(objective, dict):
                continue
            criterion = objective.get("criterion")
            for quest_id in quest_ids_of(criterion):
                if quest_id in quests:
                    quest_ids.add(quest_id)
            for success_id in success_ids_of(criterion):
                if success_id in achievements:
                    success_ids.add(success_id)
        if quest_ids:
            with_quests += 1
            covered_quests.update(quest_ids)
        if success_ids:
            with_successes += 1
        rows.append(
            {
                "id": achievement_id,
                "name": name,
                "iconId": data.get("iconId"),
                "level": data.get("level"),
                "points": data.get("points"),
                "questIds": sorted(quest_ids),
                "successIds": sorted(success_ids),
            }
        )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "unityVersion": version,
        "achievements": rows,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    size_kb = out_path.stat().st_size / 1024
    print()
    print(f"Succès nommés          : {len(rows)} (sans nom : {unresolved_names})")
    print(f"Succès avec des quêtes : {with_quests}")
    print(f"Succès avec des OA     : {with_successes}")
    print(f"Quêtes couvertes       : {len(covered_quests)}")
    print(f"Sortie                 : {out_path} ({size_kb:.0f} Ko)")


if __name__ == "__main__":
    main()

