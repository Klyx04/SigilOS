from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SPELLS_DIR = Path(r"C:\Users\user\Desktop\dofus_assets\spells_2x")
OUTPUT     = Path(r"C:\Users\user\Desktop\dofus_spells_preview.html")

images = sorted(SPELLS_DIR.glob("sort_*.png"), 
                key=lambda p: int(p.stem.replace("sort_", "")))

print(f"{len(images)} images trouvées, génération du HTML...")

# Groupes par milliers pour navigation facile
groups = {}
for img in images:
    sid = int(img.stem.replace("sort_", ""))
    group = (sid // 1000) * 1000
    groups.setdefault(group, []).append((sid, img))

nav_links = "".join(
    f'<a href="#g{g}">{g}–{g+999} ({len(imgs)} icônes)</a>'
    for g, imgs in sorted(groups.items())
)

sections = ""
for g, imgs in sorted(groups.items()):
    cards = ""
    for sid, img in sorted(imgs):
        # Chemin local relatif pour le HTML (file://)
        path = img.as_uri()
        cards += f'''
        <div class="card" onclick="select(this, {sid})" id="s{sid}">
            <img src="{path}" alt="sort_{sid}" loading="lazy" onerror="this.style.opacity=0.2">
            <span>{sid}</span>
        </div>'''
    sections += f'''
    <div class="section">
        <h2 id="g{g}">Sorts {g} – {g+999}</h2>
        <div class="grid">{cards}</div>
    </div>'''

html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Dofus Spells Preview – Trouve tes icônes TSS !</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #1a1a2e; color: #eee; font-family: Arial, sans-serif; }}
  header {{ position: sticky; top: 0; background: #16213e; padding: 12px 20px; z-index: 100; 
            display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border-bottom: 2px solid #0f3460; }}
  header h1 {{ font-size: 1.1rem; color: #e94560; white-space: nowrap; }}
  nav {{ display: flex; gap: 8px; flex-wrap: wrap; }}
  nav a {{ background: #0f3460; color: #a8daff; padding: 4px 10px; border-radius: 20px; 
            text-decoration: none; font-size: 0.75rem; transition: background 0.2s; }}
  nav a:hover {{ background: #e94560; color: white; }}
  #search {{ padding: 6px 12px; border-radius: 20px; border: none; background: #0f3460; 
              color: white; font-size: 0.85rem; width: 140px; }}
  #selected-info {{ background: #0f3460; padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; 
                    color: #a8daff; min-width: 200px; }}
  .section {{ padding: 20px; }}
  .section h2 {{ color: #a8daff; margin-bottom: 16px; font-size: 1rem; border-bottom: 1px solid #0f3460; padding-bottom: 8px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; }}
  .card {{ background: #16213e; border: 2px solid transparent; border-radius: 8px; 
            padding: 8px; text-align: center; cursor: pointer; transition: all 0.15s; }}
  .card:hover {{ border-color: #a8daff; background: #0f3460; }}
  .card.selected {{ border-color: #e94560; background: #2a1a2e; }}
  .card img {{ width: 48px; height: 48px; object-fit: contain; image-rendering: pixelated; }}
  .card span {{ display: block; font-size: 0.65rem; color: #888; margin-top: 4px; }}
  #copy-btn {{ background: #e94560; color: white; border: none; padding: 6px 14px; 
                border-radius: 20px; cursor: pointer; font-size: 0.8rem; }}
  #copy-btn:hover {{ background: #c73652; }}
</style>
</head>
<body>
<header>
  <h1>🔮 Dofus Spells Preview</h1>
  <nav>{nav_links}</nav>
  <input id="search" type="text" placeholder="ID..." oninput="filterById(this.value)">
  <div id="selected-info">Clique une icône pour voir son ID</div>
  <button id="copy-btn" onclick="copySelected()">📋 Copier ID</button>
</header>

{sections}

<script>
let selectedId = null;
function select(el, id) {{
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedId = id;
  document.getElementById('selected-info').innerHTML = 
    `✅ <b>sort_${{id}}.png</b> sélectionné | Chemin: sort_${{id}}.png`;
}}
function copySelected() {{
  if (selectedId !== null) {{
    navigator.clipboard.writeText('sort_' + selectedId + '.png');
    document.getElementById('copy-btn').textContent = '✓ Copié !';
    setTimeout(() => document.getElementById('copy-btn').textContent = '📋 Copier ID', 1500);
  }}
}}
function filterById(val) {{
  document.querySelectorAll('.card').forEach(c => {{
    const id = c.id.replace('s', '');
    c.style.display = (!val || id.includes(val)) ? '' : 'none';
  }});
}}
</script>
</body>
</html>"""

OUTPUT.write_text(html, encoding='utf-8')
print(f"✅ HTML généré: {OUTPUT}")
print(f"   Ouvre ce fichier dans ton navigateur pour parcourir les {len(images)} icônes !")
