#!/usr/bin/env python3
"""Siphon des missions de guilde officielles depuis le client Dofus Unity local.

Usage :
    python scripts/siphon-guild-missions.py
    python scripts/siphon-guild-missions.py --dofus-dir "A:/Dofus/Dofus Unity/Dofus-dofus3"
    python scripts/siphon-guild-missions.py --check

Fonctionnalités :
1. Détection automatique du client Dofus Unity (Dofus 3).
2. Lecture en lecture seule des bundles Unity :
   - data_assets_guildmissionsdataroot.asset.bundle
   - data_assets_guildmissionobjectivesdataroot.asset.bundle
   - data_assets_guildmissionsupercategoriesdataroot.asset.bundle
   - data_assets_guildmissionranksdataroot.asset.bundle
   - data_assets_guildmissionactivitiesdataroot.asset.bundle
   - data_assets_monstersdataroot.asset.bundle
   - data_assets_dungeonsdataroot.asset.bundle
   - data_assets_subareasdataroot.asset.bundle
   - Content/I18n/fr.bin
3. Résolution des monstres, zones, donjons et textes d'objectifs formatés.
4. Export consolidé vers src/data/dofus-guild-missions.json avec diffs long terme.
"""

import argparse
import json
import os
import re
import struct
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import UnityPy
    import UnityPy.config as cfg
except ImportError:
    print("ERREUR : UnityPy est requis. Lancez : pip install UnityPy", file=sys.stderr)
    sys.exit(1)

cfg.FALLBACK_UNITY_VERSION = "2022.3.53f1"

# Forcer l'encodage UTF-8 pour la sortie console sous Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DEFAULT_SEARCH_PATHS = [
    Path("A:/Dofus/Dofus Unity/Dofus-dofus3"),
    Path(os.environ.get("LOCALAPPDATA", "")) / "Ankama" / "Dofus-dofus3",
    Path(os.environ.get("PROGRAMFILES", "")) / "Ankama" / "Dofus",
]

SUPER_CATEGORY_MAP = {
    1: "DONJON",
    2: "REGULATION",
    3: "ANOMALIE",
    4: "SONGES",
    5: "EXPEDITION",
    6: "EVENT",
}

EVENT_PRESETS_KEYWORDS = {
    "VULKANIA": ["vulkania", "grozilla", "grasmera", "draguisla"],
    "NOWEL": ["nowel", "taïga", "papa nowel", "gronchon", "dégeler"],
    "HALOUINE": ["halouine", "potager"],
    "PWAK": ["pwâk", "pwak", "waddict", "croquant", "chocomancien", "dieu kao"],
}


def find_dofus_dir(custom_path=None) -> Path:
    if custom_path:
        p = Path(custom_path)
        if p.exists() and (p / "Dofus_Data").exists():
            return p
        print(f"ATTENTION : Le dossier spécifié n'est pas valide : {custom_path}", file=sys.stderr)

    env_dir = os.environ.get("DOFUS_UNITY_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists() and (p / "Dofus_Data").exists():
            return p

    for candidate in DEFAULT_SEARCH_PATHS:
        if candidate.exists() and (candidate / "Dofus_Data").exists():
            return candidate

    print("ERREUR : Impossible de localiser le dossier Dofus Unity.", file=sys.stderr)
    print("Spécifiez-le avec --dofus-dir ou la variable d'environnement DOFUS_UNITY_DIR.", file=sys.stderr)
    sys.exit(1)


def load_i18n(fr_bin_path: Path):
    """Charge le fichier I18n fr.bin et renvoie une fonction de recherche de chaînes."""
    print(f"Chargement de la localisation : {fr_bin_path.name}...")
    raw = fr_bin_path.read_bytes()
    count = struct.unpack_from("<I", raw, 3)[0]
    index = {}
    base = 7
    for i in range(count):
        pos = base + i * 8
        if pos + 8 > len(raw):
            break
        id_ = struct.unpack_from("<I", raw, pos)[0]
        off = struct.unpack_from("<I", raw, pos + 4)[0]
        index[id_] = off

    def get_str(nid: int) -> str:
        if not nid or nid not in index:
            return ""
        off = index[nid]
        l = 0
        s = 0
        while off < len(raw):
            b = raw[off]
            off += 1
            l |= (b & 0x7F) << s
            if not (b & 0x80):
                break
            s += 7
        if l == 0:
            return ""
        end = min(off + l, len(raw))
        s_bytes = raw[off:end]
        try:
            return s_bytes.decode("utf-8").strip()
        except Exception:
            return s_bytes.decode("latin-1", errors="replace").strip()

    return get_str


def load_bundle_dict(bundle_path: Path):
    """Lit un bundle Unity contenant des ScriptableObjects/MonoBehaviours et renvoie {id: data}."""
    if not bundle_path.exists():
        return {}
    env = UnityPy.load(str(bundle_path))
    res = {}
    for obj in env.objects:
        if obj.type.name == "MonoBehaviour":
            try:
                tree = obj.read_typetree()
                for ref in tree.get("references", {}).get("RefIds", []):
                    d = ref.get("data", {})
                    if isinstance(d, dict) and "id" in d:
                        res[d["id"]] = d
            except Exception:
                pass
    return res


def normalize_text(s: str) -> str:
    """Normalise une chaîne pour la recherche : minuscule sans accents."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
    ).strip()


def detect_event_preset(title: str, objective_text: str) -> str:
    combined = (title + " " + objective_text).lower()
    for preset, kws in EVENT_PRESETS_KEYWORDS.items():
        if any(kw in combined for kw in kws):
            return preset
    return "AUTRE"


def format_objective_text(template: str, monster_name: str, quantity: int, title: str) -> str:
    """Remplace intelligemment les marqueurs {0}, {1} du template officiel."""
    if not template:
        return ""
    text = template
    # Cas 1 : "{0} {1} sur leur territoire" -> "50 [Nom] sur leur territoire"
    if "{0}" in text and "{1}" in text:
        q_str = str(quantity) if quantity > 0 else "50"
        m_str = monster_name
        if not m_str:
            # Essayer d'extraire le nom depuis le titre (ex: "Régulation des Miséreux" -> "Miséreux")
            m = re.search(r"Régulation des? ([^—–\(\)]+)", title, re.IGNORECASE)
            if m:
                m_str = m.group(1).strip()
        text = text.replace("{0}", q_str).replace("{1}", m_str or "")
    elif "{0}" in text:
        val = monster_name
        if not val and quantity > 0:
            val = str(quantity)
        if not val:
            # Songes ou expédition sans monsterId direct, extraire du titre
            val = title
        text = text.replace("{0}", val)
    elif "{1}" in text:
        text = text.replace("{1}", monster_name or "")

    return re.sub(r"\s+", " ", text).strip()


def read_client_version(dofus_dir: Path) -> str:
    version_file = dofus_dir / "Dofus_Data" / "StreamingAssets" / "version"
    if version_file.exists():
        try:
            return version_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    return "unknown"


def main():
    parser = argparse.ArgumentParser(description="Extraction et synchronisation des missions de guilde Dofus Unity.")
    parser.add_argument("--dofus-dir", help="Dossier Dofus Unity (contenant Dofus_Data)")
    parser.add_argument("--out", default="src/data/dofus-guild-missions.json", help="Chemin du fichier JSON de sortie")
    parser.add_argument("--check", action="store_true", help="Mode vérification sans écriture de fichier")
    args = parser.parse_args()

    dofus_dir = find_dofus_dir(args.dofus_dir)
    print(f"Client Dofus Unity actif : {dofus_dir}")

    streaming_assets = dofus_dir / "Dofus_Data" / "StreamingAssets"
    data_dir = streaming_assets / "Content" / "Data"
    i18n_path = streaming_assets / "Content" / "I18n" / "fr.bin"

    if not i18n_path.exists():
        print(f"ERREUR : {i18n_path} introuvable !", file=sys.stderr)
        sys.exit(1)

    get_str = load_i18n(i18n_path)
    client_version = read_client_version(dofus_dir)

    print("Chargement des bundles de jeu...")
    missions_db = load_bundle_dict(data_dir / "data_assets_guildmissionsdataroot.asset.bundle")
    objectives_db = load_bundle_dict(data_dir / "data_assets_guildmissionobjectivesdataroot.asset.bundle")
    monsters_db = load_bundle_dict(data_dir / "data_assets_monstersdataroot.asset.bundle")
    dungeons_db = load_bundle_dict(data_dir / "data_assets_dungeonsdataroot.asset.bundle")
    subareas_db = load_bundle_dict(data_dir / "data_assets_subareasdataroot.asset.bundle")
    super_cats_db = load_bundle_dict(data_dir / "data_assets_guildmissionsupercategoriesdataroot.asset.bundle")

    print(f"  Missions trouvées dans le client : {len(missions_db)}")
    print(f"  Objectifs trouvés : {len(objectives_db)}")
    print(f"  Monstres : {len(monsters_db)} | Donjons : {len(dungeons_db)} | Sous-zones : {len(subareas_db)}")

    extracted_missions = []

    for mid, mdata in sorted(missions_db.items()):
        name_id = mdata.get("nameId", 0)
        title = get_str(name_id)
        if not title:
            continue

        super_cat_id = mdata.get("superCategoryId", 1)
        category_enum = SUPER_CATEGORY_MAP.get(super_cat_id, "DONJON")
        rank = mdata.get("rankId", 1)
        level = mdata.get("recommendedLevel", 200)
        activity_points = mdata.get("activityPoint", 0)
        guild_tokens = mdata.get("token", 0)

        # Résolution des objectifs
        obj_ids = mdata.get("objectives", [])
        primary_obj = objectives_db.get(obj_ids[0], {}) if obj_ids else {}

        desc_id = primary_obj.get("descriptionId", 0)
        desc_template = get_str(desc_id)
        monster_id = primary_obj.get("monsterId") or None
        map_id = primary_obj.get("mapId") or None
        subarea_id = primary_obj.get("subareaId") or None
        quantity = primary_obj.get("quantity", 0)

        monster_name = ""
        monster_level = None
        if monster_id and monster_id in monsters_db:
            m_info = monsters_db[monster_id]
            monster_name = get_str(m_info.get("nameId", 0))
            # grades
            grades = m_info.get("grades", [])
            if grades and isinstance(grades, list) and len(grades) > 0:
                first_g = grades[0] if isinstance(grades[0], dict) else {}
                monster_level = first_g.get("level")

        subarea_name = ""
        if subarea_id and subarea_id in subareas_db:
            subarea_name = get_str(subareas_db[subarea_id].get("nameId", 0))

        # Trouver le donjon si présent
        dungeon_name = ""
        dungeon_id = None
        for did, d_data in dungeons_db.items():
            if (map_id and d_data.get("entranceMapId") == map_id) or (monster_id and d_data.get("bossMonsterId") == monster_id):
                dungeon_id = did
                dungeon_name = get_str(d_data.get("nameId", 0))
                break

        objective_text = format_objective_text(desc_template, monster_name, quantity, title)

        is_special = (super_cat_id == 6)
        context_preset = detect_event_preset(title, objective_text) if is_special else None

        # Image du monstre (convention canonique SigilOS)
        monster_image_url = f"/uploads/assets-dofus/monsters/{monster_id}.webp" if monster_id else None

        # Jeton de recherche instantanée
        search_blob = f"{title} {objective_text} {monster_name} {dungeon_name} {subarea_name} {category_enum}"
        search_tokens = normalize_text(search_blob)

        mission_entry = {
            "id": mid,
            "title": title,
            "category": category_enum,
            "superCategoryId": super_cat_id,
            "rank": rank,
            "level": level,
            "activityPoints": activity_points,
            "guildTokens": guild_tokens,
            "objectiveText": objective_text,
            "monsterId": monster_id,
            "monsterName": monster_name or None,
            "monsterLevel": monster_level,
            "monsterImageUrl": monster_image_url,
            "dungeonId": dungeon_id,
            "dungeonName": dungeon_name or None,
            "subareaId": subarea_id,
            "subareaName": subarea_name or None,
            "mapId": map_id,
            "targetCount": quantity if quantity > 0 else (50 if category_enum == "REGULATION" else None),
            "isSpecial": is_special,
            "contextPreset": context_preset,
            "searchTokens": search_tokens,
        }
        extracted_missions.append(mission_entry)

    # Statistiques
    from collections import Counter
    cat_counts = Counter(m["category"] for m in extracted_missions)
    rank_counts = Counter(m["rank"] for m in extracted_missions)

    result_payload = {
        "version": client_version,
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "totalMissions": len(extracted_missions),
        "breakdown": {
            "byCategory": dict(cat_counts),
            "byRank": dict(rank_counts),
        },
        "missions": extracted_missions,
    }

    out_path = Path(args.out)

    # Analyse de diff avec la version précédente pour anticiper le long terme
    if out_path.exists():
        try:
            old_payload = json.loads(out_path.read_text(encoding="utf-8"))
            old_missions = {m["id"]: m for m in old_payload.get("missions", [])}
            new_missions = {m["id"]: m for m in extracted_missions}

            added = [m for mid, m in new_missions.items() if mid not in old_missions]
            removed = [m for mid, m in old_missions.items() if mid not in new_missions]
            modified = []
            for mid, m in new_missions.items():
                if mid in old_missions:
                    old_m = old_missions[mid]
                    # Comparaison des champs clés
                    if (old_m.get("title") != m.get("title") or
                        old_m.get("rank") != m.get("rank") or
                        old_m.get("activityPoints") != m.get("activityPoints") or
                        old_m.get("guildTokens") != m.get("guildTokens")):
                        modified.append((old_m, m))

            print("\n" + "=" * 60)
            print("  RAPPORT DE SYNCHRONISATION DU CLIENT DOFUS (DIFF)")
            print("=" * 60)
            print(f"  Version précédente : {old_payload.get('version', 'inconnue')} ({old_payload.get('extractedAt', '')})")
            print(f"  Nouvelle version   : {client_version}")
            print(f"  Missions ajoutées  : {len(added)}")
            print(f"  Missions modifiées : {len(modified)}")
            print(f"  Missions supprimées: {len(removed)}")

            if added:
                print("  -> Nouvelles missions :")
                for m in added[:10]:
                    print(f"     + [{m['id']}] {m['title']} ({m['category']} R{m['rank']})")
            if modified:
                print("  -> Exemples de modifications :")
                for old_m, new_m in modified[:5]:
                    print(f"     * [{new_m['id']}] {new_m['title']} : Pts {old_m.get('activityPoints')}->{new_m.get('activityPoints')}, Tokens {old_m.get('guildTokens')}->{new_m.get('guildTokens')}")
            if removed:
                print("  -> Missions supprimées du client :")
                for m in removed[:10]:
                    print(f"     - [{m['id']}] {m['title']}")
            print("=" * 60 + "\n")
        except Exception as e:
            print(f"Impossible de comparer avec la version précédente : {e}")

    if args.check:
        print("Mode --check : aucune écriture sur le disque.")
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Export réussi : {len(extracted_missions)} missions écrites dans {out_path} ({out_path.stat().st_size // 1024} Ko).")


if __name__ == "__main__":
    main()
