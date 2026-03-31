-- Seed DofusItem table with correct UTF-8 strings
-- Run via: chcp 65001 & docker exec -i sigilos-db psql -U user -d sigilos < seed-dofus.sql

INSERT INTO "DofusItem" (id, slug, name, "nameShort", element, rarity, "isPrimordial", "levelRecommended", "imageUrl", color, "displayOrder", description, "successName", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'emeraude',            'Dofus Émeraude',          'Émeraude',   'Émeraude',         'PRIMORDIAL', true,  100, '/module-dofus/Dofus_Emeraude.png',           '#10b981', 1,  'Dofus vert aux reflets dorés.',            'Vert Émeraude',      now(), now()),
  (gen_random_uuid(), 'turquoise',           'Dofus Turquoise',         'Turquoise',  'Turquoise',        'PRIMORDIAL', true,  120, '/module-dofus/Dofus_Turquoise.png',          '#06b6d4', 2,  'Dofus bleu cristallin.',                   'Rose-aux-vents',     now(), now()),
  (gen_random_uuid(), 'ivoire',              'Dofus Ivoire',            'Ivoire',     'Ivoire',           'PRIMORDIAL', true,  150, '/module-dofus/Dofus_Ivoire.png',             '#fbbf24', 3,  'Dofus blanc nacré.',                       'Blanc Ivoire',       now(), now()),
  (gen_random_uuid(), 'ebene',               'Dofus Ébène',             'Ébène',      'Ébène',            'PRIMORDIAL', true,  200, '/module-dofus/Dofus_Ebene.png',              '#7c3aed', 4,  'Dofus violet sombre.',                     'Bois Ébène',         now(), now()),
  (gen_random_uuid(), 'ocre',                'Dofus Ocre',              'Ocre',       'Ocre',             'PRIMORDIAL', true,  175, '/module-dofus/Dofus_Ocre.png',               '#f97316', 5,  'Dofus orangé légendaire.',                 'Teinte Ocre',        now(), now()),
  (gen_random_uuid(), 'vulbis',              'Dofus Vulbis',            'Vulbis',     'Vulbis',           'PRIMORDIAL', true,  200, '/module-dofus/Dofus_Vulbis.png',             '#ec4899', 6,  'Dofus rose rare, +1 PM.',                  'Faille Vulbis',      now(), now()),
  (gen_random_uuid(), 'pourpre',             'Dofus Pourpre',           'Pourpre',    'Pourpre',          'MAJEUR',     false, 150, '/module-dofus/Dofus_Pourpre.png',            '#be185d', 7,  'Dofus rouge foncé de Saharach.',           'Écarlate Pourpre',   now(), now()),
  (gen_random_uuid(), 'abyssal',             'Dofus Abyssal',           'Abyssal',    'Abyssal',          'MAJEUR',     false, 160, '/module-dofus/Dofus_Abyssal.png',            '#1e3a5f', 8,  'Dofus bleu profond de Sufokia.',           'Bleu Abyssal',       now(), now()),
  (gen_random_uuid(), 'sylvestre',           'Dofus Sylvestre',         'Sylvestre',  'Sylvestre',        'MAJEUR',     false, 100, '/module-dofus/Dofus_Sylvestre.png',          '#22c55e', 9,  'Dofus vert forêt d''Amakna.',              'Vert Sylvestre',     now(), now()),
  (gen_random_uuid(), 'cawotte',             'Dofus Cawotte',           'Cawotte',    'Cawotte',          'MAJEUR',     false, 60,  '/module-dofus/Dofus_Cawotte.png',            '#fb923c', 10, 'Dofus orange carotte.',                    'Cawotte Dorée',      now(), now()),
  (gen_random_uuid(), 'des-glaces',          'Dofus des Glaces',        'Glaces',     'Glace',            'MAJEUR',     false, 100, '/module-dofus/Dofus_Des_Glaces.png',         '#93c5fd', 11, 'Dofus blanc glacé de Frigost.',            'Blanc Virginal',     now(), now()),
  (gen_random_uuid(), 'nebuleux',            'Dofus Nébuleux',          'Nébuleux',   'Nébuleux',         'MAJEUR',     false, 130, '/module-dofus/Dofus_Nebuleux.png',           '#a855f7', 12, 'Dofus mauve d''Ecaflipus.',                'Mauve Nébuleux',     now(), now()),
  (gen_random_uuid(), 'dokoko',              'Dofus Dokoko',            'Dokoko',     'Dokoko',           'MAJEUR',     false, 90,  '/module-dofus/Dofus_Dokoko.png',             '#84cc16', 13, 'Dofus vert/jaune de Pandala.',             'Vert Dokoko',        now(), now()),
  (gen_random_uuid(), 'domakuro',            'Dofus Domakuro',          'Domakuro',   'Domakuro',         'MAJEUR',     false, 80,  '/module-dofus/Dofus_Domakuro.png',           '#6b7280', 14, 'Dofus gris métallique d''Otomaï.',         'Gris Domakuro',      now(), now()),
  (gen_random_uuid(), 'dolmanax',            'Dofus Dolmanax',          'Dolmanax',   'Dolmanax',         'MAJEUR',     false, 100, '/module-dofus/Dofus_Dolmanax.png',           '#f43f5e', 15, 'Dofus rouge vif de Bonta.',                'Rouge Dolmanax',     now(), now()),
  (gen_random_uuid(), 'dorigami',            'Dofus Dorigami',          'Dorigami',   'Dorigami',         'MAJEUR',     false, 110, '/module-dofus/Dofus_Dorigami.png',           '#f59e0b', 16, 'Dofus du Xélorium.',                       'Doré Dorigami',      now(), now()),
  (gen_random_uuid(), 'du-cauchemar',        'Dofus du Cauchemar',      'Cauchemar',  'Cauchemar',        'MAJEUR',     false, 120, '/module-dofus/Dofus_Du_Cauchemar.png',       '#dc2626', 17, 'Dofus rouge sang des Songes Infinis.',     'Songe Cauchemar',    now(), now()),
  (gen_random_uuid(), 'forgelave',           'Dofus Forgelave',         'Forgelave',  'Forgelave',        'MAJEUR',     false, 140, '/module-dofus/Dofus_Forgelave.png',          '#ea580c', 18, 'Dofus orangé lave de Srambad.',            'Pierre Forgelave',   now(), now()),
  (gen_random_uuid(), 'argente',             'Dofus Argenté',           'Argenté',    'Argenté',          'MAJEUR',     false, 120, '/module-dofus/Dofus_Argenté.png',            '#94a3b8', 19, 'Dofus argenté brillant.',                  'Argent Pur',         now(), now()),
  (gen_random_uuid(), 'argente-scintillant', 'Dofus Argenté Scintillant','Scintillant','Argenté Scintillant','MAJEUR',  false, 180, '/module-dofus/Dofus_Argente_Scintillant.png','#e2e8f0', 20, 'Version évoluée du Dofus Argenté.',       'Argent Scintillant', now(), now()),
  (gen_random_uuid(), 'cacao',               'Dofus Cacao',             'Cacao',      'Cacao',            'MINEUR',     false, 50,  '/module-dofus/Dofus_Cacao.png',              '#92400e', 21, 'Dofus brun chocolat de Kwismas.',          'Brun Cacao',         now(), now()),
  (gen_random_uuid(), 'tachete',             'Dofus Tacheté',           'Tacheté',    'Tacheté',          'MINEUR',     false, 70,  '/module-dofus/Dofus_Tacheté.png',            '#78716c', 22, 'Dofus moucheté de Wabbit Island.',         'Tacheté',            now(), now()),
  (gen_random_uuid(), 'veilleur',            'Dofus Veilleur',          'Veilleur',   'Veilleur',         'MINEUR',     false, 60,  '/module-dofus/Dofus_Veilleur.png',           '#0ea5e9', 23, 'Dofus bleu en éveil permanent.',           'Veilleur des Nuits', now(), now())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  "nameShort" = EXCLUDED."nameShort",
  element = EXCLUDED.element,
  rarity = EXCLUDED.rarity,
  "isPrimordial" = EXCLUDED."isPrimordial",
  "levelRecommended" = EXCLUDED."levelRecommended",
  "imageUrl" = EXCLUDED."imageUrl",
  color = EXCLUDED.color,
  "displayOrder" = EXCLUDED."displayOrder",
  description = EXCLUDED.description,
  "successName" = EXCLUDED."successName",
  "updatedAt" = now();
