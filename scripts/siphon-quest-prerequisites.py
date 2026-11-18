#!/usr/bin/env python3
"""Siphon des **prérequis entre quêtes** du client Dofus 3.

`QuestsDataRoot.startCriterion` porte le graphe complet : **990 / 1 984** quêtes
ont un `Qf=<id>` (« quête terminée »). C'est la source **officielle**, plus
complète que la trame communautaire (430 / 530).

⚠️ Trois pièges mesurés :
  · `Qf!<id>` = « quête **non** terminée » — une **exclusion** (quêtes
    mutuellement exclusives), jamais un prérequis : on l'écarte ;
  · `|` = un choix (OU) : la quête est jouable dès **une** des branches. Sans
    modèle ET/OU côté guide, on les marque `hasOr` et le seed ne les importe pas ;
  · `&` = ET, y compris entre parenthèses.

Sortie : `public/game-data/quest-prerequisites.json` — faits de progression
(ids, groupes, niveau), aucune description.

Usage :
    python scripts/siphon-quest-prerequisites.py
    python scripts/siphon-quest-prerequisites.py --out src/temp/quest-prereq.json
"""

import argparse
import json
import re
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

QUESTS_BUNDLE = "data_assets_questsdataroot.asset.bundle"
POSITIVE = re.compile(r"Qf=(\d+)")
NEGATED = re.compile(r"Qf!(\d+)")


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


def split_top_level(criterion: str, separator: str) -> list[str]:
    """Découpe sur `separator` **hors parenthèses** (les groupes restent entiers)."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in criterion:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def parse_criterion(criterion: str) -> dict:
    """Critère → `andGroups` (ET) / `orGroups` (choix) + exclusions `Qf!`.

    Un terme est une condition (`PL>29`), une quête (`Qf=211`) ou un choix
    (`(Qf=272|Qf=273)`). Les conditions non-quête ne sont pas des prérequis :
    elles sont ignorées ici (le niveau est exposé à part).
    """
    and_groups: list[list[int]] = []
    or_groups: list[list[int]] = []
    for term in split_top_level(criterion or "", "&"):
        ids = sorted({int(value) for value in POSITIVE.findall(term)})
        if not ids:
            continue
        if "|" in term:
            if len(ids) == 1:
                and_groups.append(ids)
            else:
                or_groups.append(ids)
        else:
            and_groups.append(ids)
    negated = sorted({int(value) for value in NEGATED.findall(criterion or "")})
    return {"andGroups": and_groups, "orGroups": or_groups, "negated": negated}


def main() -> None:
    parser = argparse.ArgumentParser(description="Siphon des prérequis entre quêtes (client Dofus 3).")
    parser.add_argument("--dofus-dir", help="Dossier Dofus Unity (Dofus-dofus3)")
    parser.add_argument("--out", default="public/game-data/quest-prerequisites.json", help="Fichier JSON de sortie")
    args = parser.parse_args()

    dofus_dir = find_dofus_dir(args.dofus_dir)
    version = detect_unity_version(dofus_dir)
    cfg.FALLBACK_UNITY_VERSION = version
    print(f"Client détecté : {dofus_dir} (Unity {version})")

    data_dir = dofus_dir / "Dofus_Data" / "StreamingAssets" / "Content" / "Data"
    quests = load_refs(data_dir / QUESTS_BUNDLE)
    print(f"  quêtes : {len(quests)} entrées")
    if not quests:
        print("ERREUR : aucune quête lue.", file=sys.stderr)
        sys.exit(1)

    rows = []
    with_qf = 0
    and_only = 0
    with_or = 0
    edges = 0
    negated_total = 0
    for quest_id, data in quests.items():
        criterion = data.get("startCriterion") or ""
        parsed = parse_criterion(criterion)
        if not parsed["andGroups"] and not parsed["orGroups"]:
            continue
        with_qf += 1
        targets = sorted({qid for group in parsed["andGroups"] + parsed["orGroups"] for qid in group})
        edges += len(targets)
        negated_total += len(parsed["negated"])
        if parsed["orGroups"]:
            with_or += 1
        else:
            and_only += 1
        rows.append(
            {
                "questId": quest_id,
                "levelMin": data.get("levelMin"),
                "criterion": criterion,
                "qfTargets": targets,
                "andGroups": parsed["andGroups"],
                "orGroups": parsed["orGroups"],
                "negated": parsed["negated"],
            }
        )

    rows.sort(key=lambda row: row["questId"])
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "unityVersion": version,
        "counts": {
            "quests": len(quests),
            "withPrerequisites": with_qf,
            "andOnly": and_only,
            "withOr": with_or,
            "edges": edges,
            "negatedExclusions": negated_total,
        },
        "quests": rows,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print()
    print(f"Quêtes avec prérequis   : {with_qf} / {len(quests)}")
    print(f"  en ET seul (importable): {and_only}")
    print(f"  avec un choix (OU)    : {with_or}  ← en attente de `prereq_expr`")
    print(f"Arêtes (cibles)         : {edges}")
    print(f"Exclusions `Qf!`        : {negated_total} (écartées)")
    print(f"Sortie                  : {out_path} ({out_path.stat().st_size / 1024:.0f} Ko)")


if __name__ == "__main__":
    main()
