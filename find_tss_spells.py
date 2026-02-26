import urllib.request
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SPELLS_DIR = Path(r"C:\Users\user\Desktop\dofus_assets\spells_2x")
OUTPUT = Path(r"C:\Users\user\Desktop\dofus_assets\tss_spells_FINAL.json")

def get(url):
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

# L'API supporte FeathersJS - syntaxe correcte pour regex sur champs imbriqués
# On cherche dans le champ name.fr directement
print("=== Recherche TSS par nom (FeathersJS syntax) ===")

tss_found = {}
search_terms = [
    ("Eniripsa", "name[fr][$regex]"),
    ("Astrale", None),
    ("Songeur", None),
    ("Sable", None),
]

# Approche: pagine tous les sorts et filtre localement
# Il y a 16895 sorts - on en lit 500 par page
print("Scan de tous les sorts pour trouver les TSS...")
page_size = 500
skip = 0
total = None
page_num = 0

while total is None or skip < total:
    url = f"https://api.dofusdb.fr/spells?lang=fr&$limit={page_size}&$skip={skip}"
    try:
        data = get(url)
        if total is None:
            total = data.get("total", 0)
            print(f"Total sorts: {total}")
        
        for item in data.get("data", []):
            name_fr = item.get("name", {}).get("fr", "")
            if not name_fr:
                continue
            name_low = name_fr.lower()
            if any(k in name_low for k in [
                "eniripsa", "astrale", "songeur", "marchand de sable",
                "poing météore", "affûtage", "abjuration", "onirique",
                "songe infini", "sort de songe", "tempête", "fontaine"
            ]):
                sid = item.get("id")
                icon_id = item.get("iconId", 0)
                img_url = item.get("img", "")
                has_img = (SPELLS_DIR / f"sort_{icon_id}.png").exists()
                tss_found[sid] = {
                    "name": name_fr,
                    "id": sid,
                    "iconId": icon_id,
                    "img": img_url,
                    "local": str(SPELLS_DIR / f"sort_{icon_id}.png") if has_img else None
                }
                print(f"  {'✅' if has_img else '❌'} [{sid}] iconId={icon_id} | {name_fr}")
        
        skip += page_size
        page_num += 1
        if page_num % 5 == 0:
            print(f"  ... {skip}/{total} scannés")
            
    except Exception as e:
        print(f"Erreur page {skip}: {e}")
        break

print(f"\n=== RÉSULTAT: {len(tss_found)} sorts TSS trouvés ===")
OUTPUT.write_text(json.dumps(tss_found, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Sauvegardé: {OUTPUT}")
