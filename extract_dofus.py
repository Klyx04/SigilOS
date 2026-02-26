import UnityPy
from pathlib import Path

# Dofus 3 est basé sur Unity 2022
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.18f1"

OUTPUT_DIR = r"C:\Users\user\Desktop\dofus_assets"

# Toutes les sources à explorer
SOURCES = [
    r"C:\Users\user\AppData\Local\Ankama\Dofus-dofus3\Dofus_Data\StreamingAssets\aa\StandaloneWindows64",
    r"A:\Dofus Unity\Dofus-dofus3\Dofus_Data\StreamingAssets\aa\StandaloneWindows64",
    r"A:\Dofus Unity\Dofus-Beta\Dofus_Data\StreamingAssets\aa\StandaloneWindows64",
]

# Bundles prioritaires (on ignore les bundles trop génériques/inutiles)
SKIP_BUNDLES = {
    "networkingcertificates_assets_all.bundle",
    "mobile_assets_all.bundle",
    "dofus_unity_monoscripts.bundle",
    "dofus_unity_unitybuiltinassets.bundle",
    "data_assets_all.bundle",
    "inputactionassets_assets_all.bundle",
}

def extract_bundle(bundle_path: Path, out_dir: Path):
    count = 0
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  ❌ Impossible de charger: {e}")
        return 0

    for obj in env.objects:
        if obj.type.name not in ("Texture2D", "Sprite"):
            continue
        try:
            data = obj.read()
            obj_name = (
                getattr(data, "m_Name", None)
                or getattr(data, "name", None)
                or f"asset_{obj.path_id}"
            )
            if not obj_name:
                obj_name = f"asset_{obj.path_id}"

            try:
                img = data.image
            except Exception:
                continue

            if img is None:
                continue

            dest = out_dir / f"{obj_name}.png"
            # Ne pas re-extraire si déjà présent
            if dest.exists():
                continue

            dest.parent.mkdir(parents=True, exist_ok=True)
            img.save(dest)
            count += 1
        except Exception as e:
            pass  # Silencieux pour les erreurs individuelles

    return count

total = 0
seen_bundles = set()  # Évite les doublons entre sources

for source_dir in SOURCES:
    source = Path(source_dir)
    if not source.exists():
        print(f"⚠️  Dossier introuvable: {source_dir}")
        continue

    bundles = list(source.glob("*.bundle"))
    print(f"\n📁 Source: {source_dir} ({len(bundles)} bundles)")

    for bundle in sorted(bundles):
        if bundle.name in SKIP_BUNDLES:
            continue
        # Clé unique par nom de bundle (ignore les doublons avec hash)
        base_name = bundle.stem.split("_")[0:3]
        bundle_key = "_".join(base_name)

        out_dir = Path(OUTPUT_DIR) / bundle.stem
        out_dir.mkdir(parents=True, exist_ok=True)

        print(f"  📦 {bundle.name} ...", end=" ", flush=True)
        count = extract_bundle(bundle, out_dir)
        print(f"→ {count} images")
        total += count

print(f"\n✅ TOTAL: {total} images extraites dans {OUTPUT_DIR}")
