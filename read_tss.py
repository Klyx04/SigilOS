import json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

data = json.loads(open(r'C:\Users\user\Desktop\dofus_assets\tss_spells_FINAL.json', encoding='utf-8').read())
for sid, s in data.items():
    has = "OK" if s["local"] else "NO"
    print(f"[{has}] ID={s['id']} iconId={s['iconId']} | {s['name']}")
    print(f"      img: {s['img']}")
