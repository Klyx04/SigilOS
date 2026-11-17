#!/usr/bin/env python3
"""Siphon du **DofusDex officiel** depuis le client Dofus 3 (Unity).

Le DofusDex du jeu (Aventure / Guide) est le `DofusProgressionsDataRoot` du client :
30 progressions, avec leurs prérequis et leurs étapes **typées** (quête, monstre,
succès, donjon), leurs niveaux et leur ordre. Ce script le lit en **lecture seule**
via UnityPy et écrit un JSON de référence pour le seed God.

Usage :
    python scripts/siphon-dofusdex.py
    python scripts/siphon-dofusdex.py --dofus-dir "C:\\Users\\user\\AppData\\Local\\Ankama\\Dofus-dofus3"
    python scripts/siphon-dofusdex.py --out src/temp/dofusdex/dofusdex.json
    python scripts/siphon-dofusdex.py --with-descriptions   # ⚠️ ne pas committer

Sortie par défaut : `public/game-data/dofusdex.json` (même dossier que
`unity-bestiary.json`). Aucune écriture dans le jeu, aucun appel réseau.
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
    "progression": "data_assets_dofusprogressionsdataroot.asset.bundle",
    "quests": "data_assets_questsdataroot.asset.bundle",
    "quest_steps": "data_assets_queststepsdataroot.asset.bundle",
    "monsters": "data_assets_monstersdataroot.asset.bundle",
    "achievements": "data_assets_achievementsdataroot.asset.bundle",
    "achievement_objectives": "data_assets_achievementobjectivesdataroot.asset.bundle",
    "dungeons": "data_assets_dungeonsdataroot.asset.bundle",
    "npcs": "data_assets_npcsdataroot.asset.bundle",
}

# `DofusProgressionStepType` **mesuré le 17/11/2026** sur les 224 entrées des 30
# progressions : type 1 → succès (107/107), type 2 → PNJ (10/10), type 3 → quête
# (80/80), type 4 → succès (26/27, repli donjon). Le type 5 n'apparaît pas.
STEP_TYPES = {1: "achievement", 2: "npc", 3: "quest", 4: "achievement"}


def find_dofus_dir(custom_path: str | None = None) -> Path:
    """Détecte le dossier d'installation (même logique que `siphon-unity-bestiary.py`)."""
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
    """Lit la version Unity dans `globalgamemanagers` (repli explicite sinon)."""
    managers = dofus_dir / "Dofus_Data" / "globalgamemanagers"
    if managers.exists():
        head = managers.read_bytes()[:256]
        match = re.search(rb"(\d{4}\.\d+\.\d+[abfp]\d+)", head)
        if match:
            return match.group(1).decode("ascii")
    return "6000.3.16f1"


def load_i18n(fr_bin_path: Path):
    """Charge `Content/I18n/fr.bin` — **même format** que `siphon-unity-bestiary.py`."""
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


def localized_name(value) -> str | None:
    if isinstance(value, dict):
        return value.get("fr") or value.get("en")
    return None


def resolve_objective_target(objective: dict, sources: dict, get_str) -> dict:
    """Cible d'un objectif de succès (`Qf=2149` → quête 2149)."""
    criterion = objective.get("criterion") or ""
    match = re.search(r"Q([fqa])=(\d+)", criterion)
    if match:
        kind = {"f": "quest", "q": "quest", "a": "achievement"}[match.group(1)]
        value = int(match.group(2))
        resolved = resolve_entry(kind, value, sources, get_str)
        return {"type": kind, "id": value, "name": resolved["name"], "level": resolved["level"]}

    name_id = objective.get("nameId")
    name = get_str(name_id) if isinstance(name_id, int) else None
    return {"type": "objective", "id": objective.get("id"), "name": name, "level": None}


def expand_achievement(achievement_id: int, sources: dict, get_str) -> list[dict]:
    """Les lignes du DofusDex : le succès lui-même, puis ses objectifs (9 pour Domakuro)."""
    achievement = sources.get("achievement", {}).get(achievement_id)
    if not isinstance(achievement, dict):
        return []

    name = get_str(achievement.get("nameId")) if isinstance(achievement.get("nameId"), int) else None
    rows = [
        {
            "order": -1,
            "objectiveId": None,
            "type": "achievement",
            "id": achievement_id,
            "name": name or None,
            "level": achievement.get("level") if isinstance(achievement.get("level"), int) else None,
            "isAchievement": True,
        }
    ]
    for objective_id in achievement.get("objectiveIds") or []:
        objective = sources.get("achievement_objective", {}).get(objective_id)
        if not isinstance(objective, dict):
            continue
        target = resolve_objective_target(objective, sources, get_str)
        rows.append(
            {
                "order": objective.get("order"),
                "objectiveId": objective_id,
                **target,
            }
        )
    return rows


def resolve_entry(kind: str, value: int, sources: dict, get_str) -> dict:
    """Nom + niveau d'une étape typée (quête, monstre, succès, donjon)."""
    data = sources.get(kind, {}).get(value)
    if not isinstance(data, dict):
        return {"name": None, "level": None}

    name = None
    name_id = data.get("nameId")
    if isinstance(name_id, int):
        name = get_str(name_id) or None
    elif isinstance(name_id, str) and name_id.isdigit():
        name = get_str(int(name_id)) or None
    if not name:
        name = localized_name(data.get("name"))

    level = data.get("levelMin")
    if level is None:
        level = data.get("level")
    if level is None:
        level = data.get("optimalLevel")
    if level is None and isinstance(data.get("grades"), list) and data["grades"]:
        level = data["grades"][0].get("level")

    return {"name": name, "level": level if isinstance(level, int) else None}


def main() -> None:
    parser = argparse.ArgumentParser(description="Siphon du DofusDex officiel (client Dofus 3).")
    parser.add_argument("--dofus-dir", help="Dossier Dofus Unity (Dofus-dofus3)")
    parser.add_argument("--out", default="public/game-data/dofusdex.json", help="Fichier JSON de sortie")
    parser.add_argument(
        "--with-descriptions",
        action="store_true",
        help="Inclut les descriptions officielles (⚠️ ne pas committer : texte Ankama)",
    )
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
    sources = {
        "quest": load_refs(data_dir / DATA_FILES["quests"]),
        "quest_step": load_refs(data_dir / DATA_FILES["quest_steps"]),
        "monster": load_refs(data_dir / DATA_FILES["monsters"]),
        "achievement": load_refs(data_dir / DATA_FILES["achievements"]),
        "achievement_objective": load_refs(data_dir / DATA_FILES["achievement_objectives"]),
        "dungeon": load_refs(data_dir / DATA_FILES["dungeons"]),
        "npc": load_refs(data_dir / DATA_FILES["npcs"]),
    }
    for kind, entries in sources.items():
        print(f"  {kind:12s} : {len(entries)} entrées")

    progressions = load_refs(data_dir / DATA_FILES["progression"])
    if not progressions:
        print("ERREUR : aucune progression Dofus lue.", file=sys.stderr)
        sys.exit(1)

    unresolved = []
    total_steps = 0
    total_prereqs = 0
    total_objectives = 0
    dofus = []

    def resolve_step(entry: dict, dofus_id: int, dofus_name: str | None) -> dict:
        nonlocal total_objectives
        raw_type = entry.get("type")
        step_type = STEP_TYPES.get(raw_type, "unknown")
        resolved = resolve_entry(step_type, entry.get("value"), sources, get_str)
        # Type 4 : succès de donjon. 26/27 se résolvent comme succès ; le dernier est
        # un donjon sans succès homonyme — on le nomme par le donjon (repli explicite).
        if resolved["name"] is None and raw_type == 4:
            dungeon = resolve_entry("dungeon", entry.get("value"), sources, get_str)
            if dungeon["name"]:
                resolved = dungeon
                step_type = "dungeon"
        if resolved["name"] is None:
            unresolved.append(
                {
                    "dofusId": dofus_id,
                    "dofusName": dofus_name,
                    "type": step_type,
                    "id": entry.get("value"),
                }
            )
        result = {
            "order": entry.get("order"),
            "type": step_type,
            "id": entry.get("value"),
            "name": resolved["name"],
            "level": resolved["level"],
            "hideObjectives": bool(entry.get("hideObjectives")),
        }
        if step_type == "achievement":
            objectives = expand_achievement(entry.get("value"), sources, get_str)
            if objectives:
                result["objectives"] = objectives
                total_objectives += len(objectives)
        return result

    for data in progressions.values():
        if not isinstance(data, dict):
            continue
        dofus_id = data.get("id")
        name = get_str(data.get("nameId")) if isinstance(data.get("nameId"), int) else None
        steps = [resolve_step(entry, dofus_id, name) for entry in (data.get("steps") or [])]
        prerequisites = [
            resolve_step(entry, dofus_id, name) for entry in (data.get("prerequisites") or [])
        ]
        total_steps += len(steps)
        total_prereqs += len(prerequisites)
        entry = {
            "id": dofus_id,
            "name": name or None,
            "gfxId": data.get("gfxId"),
            "color": data.get("backgroundColor"),
            "minLevel": data.get("minLevel"),
            "maxLevel": data.get("maxLevel"),
            "order": data.get("order"),
            "isPrimordial": bool(data.get("isPrimordial")),
            "isEvent": bool(data.get("isEvent")),
            "prerequisites": sorted(prerequisites, key=lambda item: item.get("order") or 0),
            "steps": sorted(steps, key=lambda item: item.get("order") or 0),
        }
        if args.with_descriptions:
            entry["description"] = get_str(data.get("descriptionId")) or None
        dofus.append(entry)

    dofus.sort(key=lambda item: (item.get("order") if isinstance(item.get("order"), int) else 9999, item.get("id") or 0))

    payload = {
        "source": {
            "client": "Dofus 3 (Unity)",
            "bundle": DATA_FILES["progression"],
            "unityVersion": version,
            "readWith": "UnityPy read_typetree()",
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stepTypes": {str(key): value for key, value in STEP_TYPES.items()},
        "counts": {
            "dofus": len(dofus),
            "steps": total_steps,
            "prerequisites": total_prereqs,
            "objectives": total_objectives,
            "unresolved": len(unresolved),
        },
        "unresolved": unresolved[:50],
        "dofus": dofus,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"\nDofusDex : {len(dofus)} progressions · {total_steps} étapes · "
        f"{total_prereqs} prérequis · {len(unresolved)} non résolus"
    )
    for item in dofus[:10]:
        print(f"  {str(item['order']).rjust(2)} · {item['name'] or '(sans nom)'} ({item['minLevel']}–{item['maxLevel']})")
    print(f"→ {out_path}")
    if args.with_descriptions:
        print("⚠️ descriptions incluses : ne pas committer ce fichier (texte Ankama).")


if __name__ == "__main__":
    main()
