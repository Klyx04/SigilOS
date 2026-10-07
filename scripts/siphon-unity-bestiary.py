#!/usr/bin/env python3
"""Siphon du bestiaire officiel et sorts depuis le client Dofus Unity local.

Usage :
    python scripts/siphon-unity-bestiary.py
    python scripts/siphon-unity-bestiary.py --dofus-dir "C:\\Users\\user\\AppData\\Local\\Ankama\\Dofus-dofus3"
    python scripts/siphon-unity-bestiary.py --icons

Fonctionnalités :
1. Détection automatique du client Dofus Unity (Dofus 3).
2. Lecture en lecture seule des bundles Unity via UnityPy :
   - data_assets_monstersdataroot.asset.bundle
   - data_assets_spellsdataroot.asset.bundle
   - data_assets_spelllevelsdataroot.asset.bundle
   - data_assets_effectsdataroot.asset.bundle
   - data_assets_spellstatesdataroot.asset.bundle
   - Content/I18n/fr.bin
3. Extraction des caractéristiques complètes (Niveau, PV, PA, PM, Tacle, Fuite,
   Esquives, Retraits, Initiative, Résistances, XP).
4. Extraction des passifs et mécaniques de combat (sort de début de combat,
   texte vert officiel du client, effets de verrouillage/résurrection).
5. Extraction des icônes des sorts nécessaires en WebP vers
   public/uploads/assets-dofus/spells/
6. Export consolidé vers public/game-data/unity-bestiary.json.
"""

import argparse
import json
import os
import re
import struct
import sys
from pathlib import Path

try:
    import UnityPy
    import UnityPy.config as cfg
    from PIL import Image
except ImportError:
    print("ERREUR : UnityPy et Pillow sont requis. Lance : pip install UnityPy Pillow", file=sys.stderr)
    sys.exit(1)

cfg.FALLBACK_UNITY_VERSION = "2022.3.53f1"

# Forcer l'encodage UTF-8 pour la sortie console sous Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Dossiers par défaut pour détecter Dofus Unity
DEFAULT_SEARCH_PATHS = [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Ankama" / "Dofus-dofus3",
    Path("A:/Dofus/Dofus Unity/Dofus-dofus3"),
    Path(os.environ.get("PROGRAMFILES", "")) / "Ankama" / "Dofus",
]


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
    print("Spécifie-le avec --dofus-dir ou la variable d'environnement DOFUS_UNITY_DIR.", file=sys.stderr)
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
        end = off + l
        if end > len(raw):
            end = len(raw)
        s_bytes = raw[off:end]
        try:
            return s_bytes.decode("utf-8").strip()
        except:
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
            except:
                pass
    return res


def extract_spell_icons(streaming_assets: Path, icon_ids: set, output_dir: Path):
    """Extrait les icônes de sorts en WebP depuis spell_assets_1x.bundle."""
    spells_bundle = streaming_assets / "Content" / "Picto" / "Spells" / "spell_assets_1x.bundle"
    if not spells_bundle.exists():
        print(f"Avertissement : {spells_bundle} introuvable, pas d'icônes extraites.")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    target_names = {f"sort_{iid}" for iid in icon_ids if iid > 0}
    print(f"Extraction des icônes de sorts ({len(target_names)} cibles) depuis Unity...")

    env = UnityPy.load(str(spells_bundle))
    extracted = 0
    for obj in env.objects:
        if obj.type.name == "Texture2D":
            try:
                d = obj.read()
                name = getattr(d, "m_Name", "")
                if name in target_names:
                    img = d.image
                    out_file = output_dir / f"{name}.webp"
                    alt_file = output_dir / f"{name.replace('sort_', '')}.webp"
                    img.save(str(out_file), "WEBP")
                    if not alt_file.exists():
                        img.save(str(alt_file), "WEBP")
                    extracted += 1
            except Exception as e:
                pass
    print(f"  -> {extracted} icônes de sorts extraites en WebP dans {output_dir}")


def format_dofus_effect(template: str, dice_num: int, dice_side: int, value: int, duration: int) -> str:
    """Formate une ligne d'effet Dofus selon le moteur de template officiel du jeu."""
    if not template:
        return ""
    has_range = (dice_side > 0 and dice_side != dice_num)

    def repl_cond(m):
        return m.group(3) if has_range else ""

    text = re.sub(r'\{{~(\d+)~(\d+)(.*?)\}\}', repl_cond, template)

    val1 = dice_num if dice_num != 0 else value
    val2 = str(dice_side) if has_range else ""
    val3 = str(value)

    text = text.replace("#1", str(val1)).replace("#2", val2).replace("#3", val3)
    text = re.sub(r'\s+', ' ', text).strip()
    if duration > 0:
        dur_str = f" - {duration} tour" if duration == 1 else f" - {duration} tours"
        text += dur_str
    return text


def main():
    parser = argparse.ArgumentParser(description="Siphon du bestiaire et mécaniques Dofus Unity.")
    parser.add_argument("--dofus-dir", help="Chemin du dossier Dofus Unity (Dofus-dofus3)")
    parser.add_argument("--out", default="public/game-data/unity-bestiary.json", help="Fichier JSON de sortie")
    parser.add_argument("--icons", action="store_true", default=True, help="Extraire les icônes de sorts en WebP")
    args = parser.parse_args()

    dofus_dir = find_dofus_dir(args.dofus_dir)
    print(f"Dossier Dofus Unity actif détecté : {dofus_dir}")

    streaming_assets = dofus_dir / "Dofus_Data" / "StreamingAssets"
    data_dir = streaming_assets / "Content" / "Data"
    i18n_path = streaming_assets / "Content" / "I18n" / "fr.bin"

    if not i18n_path.exists():
        print(f"ERREUR : {i18n_path} introuvable !", file=sys.stderr)
        sys.exit(1)

    get_str = load_i18n(i18n_path)

    print("Chargement des bases de données de jeu...")
    monsters_db = load_bundle_dict(data_dir / "data_assets_monstersdataroot.asset.bundle")
    spells_db = load_bundle_dict(data_dir / "data_assets_spellsdataroot.asset.bundle")
    spelllevels_db = load_bundle_dict(data_dir / "data_assets_spelllevelsdataroot.asset.bundle")
    effects_db = load_bundle_dict(data_dir / "data_assets_effectsdataroot.asset.bundle")

    print(f"  Monstres : {len(monsters_db)} | Sorts : {len(spells_db)} | Niveaux : {len(spelllevels_db)}")

    # Collecter les icônes à extraire
    icon_ids_to_extract = set()

    # Dictionnaire résultat : id -> données du monstre
    bestiary = {}

    # Dictionnaire de correspondance par nom normalisé pour recherche rapide
    def norm_name(s: str) -> str:
        import unicodedata
        return "".join(
            c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
        ).strip()

    print("Traitement des fiches de monstres et passifs...")
    for mid, mdata in monsters_db.items():
        name_id = mdata.get("nameId", 0)
        name = get_str(name_id)
        if not name:
            continue

        grades = mdata.get("grades", [])
        if not grades:
            continue

        # Récupérer les sorts listés
        monster_spell_ids = mdata.get("spells", [])
        starting_spell_id = grades[0].get("startingSpellId", 0)

        # Chercher si un sort possède un texte de description (mécanique officielle)
        # ou s'il s'agit du startingSpell
        passive_data = None
        if starting_spell_id:
            # startingSpellId dans MonsterGrade pointe vers un spellLevel ID
            # Trouvons le sort parent
            parent_spell = None
            parent_sl = spelllevels_db.get(starting_spell_id)
            if parent_sl:
                sid = parent_sl.get("spellId")
                parent_spell = spells_db.get(sid)
            else:
                # Tentative directe comme spellId
                parent_spell = spells_db.get(starting_spell_id)

            if parent_spell:
                p_name = get_str(parent_spell.get("nameId"))
                p_desc = get_str(parent_spell.get("descriptionId"))
                p_icon = parent_spell.get("iconId", 0)
                if p_icon > 0:
                    icon_ids_to_extract.add(p_icon)

                # Effets du passif de début de combat
                sl_obj = parent_sl or {}
                effects_list = []
                for eff in sl_obj.get("effects", []):
                    eid = eff.get("effectId")
                    val = eff.get("value", 0)
                    dnum = eff.get("diceNum", 0)
                    dside = eff.get("diceSide", 0)
                    dur = eff.get("duration", 0)

                    # Interprétation des effets de passifs fréquents
                    eff_label = ""
                    eff_type = "unknown"
                    is_locked = True

                    if val == 56 or eid == 753:  # État Invulnérable
                        eff_label = "État Invulnérable"
                        eff_type = "invulnerable"
                    elif dnum == 7868 or dnum == 7907 or eid == 792 or eid == 1:
                        eff_label = "Échange de positions"
                        eff_type = "swap"
                    elif dnum > 0 and dside > 0 and val == 0:
                        eff_label = f"Invoque le dernier allié mort avec {dnum} à {dside} % de sa vie"
                        eff_type = "resurrect"
                    elif eid == 401 or eid == 400:
                        eff_label = "Pose un glyphe de début de tour (Sceau)"
                        eff_type = "glyph"

                    if eff_label:
                        effects_list.append({
                            "effectId": eid,
                            "label": eff_label,
                            "type": eff_type,
                            "duration": "infini" if dur == -1 or dur == 0 else f"{dur} tour(s)",
                            "isLocked": is_locked,
                        })

                passive_data = {
                    "spellId": parent_spell.get("id"),
                    "name": p_name or "Passif de combat",
                    "description": p_desc,
                    "iconId": p_icon,
                    "effects": effects_list,
                }

        # Analyser les sorts actifs du monstre
        active_spells = []
        for sid in monster_spell_ids:
            sp = spells_db.get(sid)
            if not sp:
                continue
            s_name = get_str(sp.get("nameId"))
            s_desc = get_str(sp.get("descriptionId"))
            s_icon = sp.get("iconId", 0)
            if s_icon > 0:
                icon_ids_to_extract.add(s_icon)

            # Récupérer les stats du premier spellLevel
            sl_list = sp.get("spellLevels", [])
            first_sl = spelllevels_db.get(sl_list[0]) if sl_list else {}

            # Effets normaux officiels
            s_effects = []
            for eff in first_sl.get("effects", []):
                act_id = eff.get("actionId")
                meta = effects_db.get(act_id)
                desc_id = meta.get("descriptionId") if meta else None
                tmpl = get_str(desc_id) if desc_id else ""
                formatted = format_dofus_effect(
                    tmpl,
                    eff.get("diceNum", 0),
                    eff.get("diceSide", 0),
                    eff.get("value", 0),
                    eff.get("duration", 0),
                )
                if formatted and formatted not in s_effects:
                    s_effects.append(formatted)

            # Effets critiques officiels
            s_crit_effects = []
            crit_list = first_sl.get("criticalEffect", first_sl.get("criticalEffects", []))
            for eff in crit_list:
                act_id = eff.get("actionId")
                meta = effects_db.get(act_id)
                desc_id = meta.get("descriptionId") if meta else None
                tmpl = get_str(desc_id) if desc_id else ""
                formatted = format_dofus_effect(
                    tmpl,
                    eff.get("diceNum", 0),
                    eff.get("diceSide", 0),
                    eff.get("value", 0),
                    eff.get("duration", 0),
                )
                if formatted and formatted not in s_crit_effects:
                    s_crit_effects.append(formatted)

            active_spells.append({
                "id": sid,
                "name": s_name or f"Sort #{sid}",
                "description": s_desc,
                "iconId": s_icon,
                "apCost": first_sl.get("apCost", 0) if first_sl else 0,
                "minRange": first_sl.get("minRange", 0) if first_sl else 0,
                "range": first_sl.get("range", 0) if first_sl else 0,
                "criticalHitProbability": first_sl.get("criticalHitProbability", 0) if first_sl else 0,
                "maxCastPerTurn": first_sl.get("maxCastPerTurn", 0) if first_sl else 0,
                "maxCastPerTarget": first_sl.get("maxCastPerTarget", 0) if first_sl else 0,
                "effects": s_effects,
                "criticalEffects": s_crit_effects,
            })

        # Assembler la fiche
        parsed_grades = []
        for g in grades:
            bonus = g.get("bonusCharacteristics", {})
            agi = g.get("agility", 0)
            wis = g.get("wisdom", 0)
            tackle_bonus = bonus.get("tackleBonus", 0)
            evade_bonus = bonus.get("tackleEvade", 0)
            pa_dodge_bonus = g.get("paLostDodge", 0)
            pm_dodge_bonus = g.get("mpLostDodge", 0)

            # Calculs standard Dofus pour affichage fidèle au client
            tackle = int(agi / 10) + tackle_bonus
            evade = int(agi / 10) + evade_bonus
            ret_pa = int(wis / 10)
            ret_pm = int(wis / 10)
            esq_pa = ret_pa + pa_dodge_bonus
            esq_pm = ret_pm + pm_dodge_bonus
            init = g.get("initiativeBonus", 0) + (g.get("strength", 0) + g.get("intelligence", 0) + g.get("chance", 0) + agi)

            parsed_grades.append({
                "grade": g.get("grade", 1),
                "level": g.get("level", 0),
                "lifePoints": g.get("lifePoints", 0),
                "actionPoints": g.get("actionPoints", 0),
                "movementPoints": g.get("movementPoints", 0),
                "wisdom": wis,
                "strength": g.get("strength", 0),
                "intelligence": g.get("intelligence", 0),
                "chance": g.get("chance", 0),
                "agility": agi,
                "tackle": tackle,
                "evade": evade,
                "apRemoval": ret_pa,
                "mpRemoval": ret_pm,
                "apDodge": esq_pa,
                "mpDodge": esq_pm,
                "initiative": init,
                "neutralResistance": g.get("reductionNeutral", 0),
                "earthResistance": g.get("reductionEarth", 0),
                "fireResistance": g.get("reductionFire", 0),
                "waterResistance": g.get("reductionWater", 0),
                "airResistance": g.get("reductionAir", 0),
                "xp": g.get("xp", 0),
            })

        bestiary[mid] = {
            "id": mid,
            "name": name,
            "raceId": mdata.get("race", 0),
            "gfxId": mdata.get("gfxId", 0),
            "passive": passive_data,
            "spells": active_spells,
            "grades": parsed_grades,
        }

    # Sauvegarder le JSON
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(bestiary, f, ensure_ascii=False, indent=2)

    print(f"\n✅ {len(bestiary)} monstres exportés dans {out_path} ({out_path.stat().st_size // 1024} Ko)")

    # Extraction des icônes si demandé
    if args.icons and icon_ids_to_extract:
        icon_out = Path("public/uploads/assets-dofus/spells")
        extract_spell_icons(streaming_assets, icon_ids_to_extract, icon_out)

    print("✨ Opération terminée avec succès !")


if __name__ == "__main__":
    main()
