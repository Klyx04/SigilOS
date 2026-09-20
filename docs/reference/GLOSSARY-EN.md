# Glossaire FR → EN des guides publics

Source de vérité : **DofusDB** (`https://api.dofusdb.fr`), champ `name.en` (noms
officiels du client anglais). Toute fiche EN doit réutiliser ces termes : aucune
traduction « inventée », aucune reformulation libre d'un nom propre Ankama.

Vérification d'un terme (regex non ancrée sur le nom français) :

```
https://api.dofusdb.fr/items?$limit=5&name.fr%5B%24regex%5D=<terme>
```

Routes utiles : `items`, `monsters`, `spells`, `achievements`, `quests`, `npcs`,
`dungeons`, `subareas`, `areas`, `jobs`, `effects` (champ `description.fr` pour
les effets d'objets/sorts).

## 1. Métiers & forgemagie

| FR | EN officiel |
|---|---|
| Éleveur | Breeder |
| Bricoleur | Handyman |
| Paysan | Farmer |
| Alchimiste | Alchemist |
| Mineur | Miner |
| Bûcheron | Lumberjack |
| Forgeron | Smith |
| Cordonnier | Shoemaker |
| Bijoutier | Jeweller |
| Tailleur | Tailor |
| Sculpteur | Carver |
| Forgemage (métier) | Smithmagus |
| Forgemagie (discipline) | Smithmagic |
| Rune Vi / Pa Vi / Ra Vi | Vit Rune / Pa Vit Rune / Ra Vit Rune |
| Rune Fo, Ine, Cha, Age, Sa | Str, Int, Cha, Agi, Wis Rune |
| Rune Ga Pa / Ga Pme | Ap Ga Rune / Mp Ga Rune |
| Rune Do, Pui, Prospe, So, Invo | Dam, Pow, Pp, Hea, Sum Rune |
| Rune Po, Fui, Tac, Ret Pa, Ret Pme | Range, Dod, Loc, Ap Red, Mp Red Rune |
| Rune Ré Eau / Ré Per Eau | Water Res Rune / Water Res Per Rune |
| Retrait PA / Retrait PM | AP Reduction / MP Reduction |
| Fuite / Tacle | Dodge / Lock |
| Puissance / Prospection / Portée | Power / Prospecting / Range |
| Dommages / Résistance / Invocation | Damage / Resistance / Summons |
| Sagesse | Wisdom |

## 2. Élevage & enclos

| FR | EN officiel |
|---|---|
| Dragodinde / Muldo / Volkorne | Dragoturkey / Seemyool / Rhineetle |
| Enclos | Paddock |
| Étable | Stable |
| Mangeoire | Manger (Extrait/Philtre/Potion/Élixir de Mangeoire → Manger Extract/Philtre/Potion/Elixir) |
| Foudroyeur | Lightning Thrower |
| Abreuvoir | Drinking Trough |
| Dragofesse | Dragobutt |
| Baffeur / Caresseur | Slapper / Patter |
| Filet de capture | Capturing Net |
| Village des Éleveurs | Breeder Village |
| Montagne des Koalaks (zone) | Koalak Mountain |
| Amoureuse / Endurante / Précoce | In Love / Hardy / Precocious |
| Reproductrice / Sage / Caméléone | Reproductive / Wise / Chameleon |
| Jauges Endurance / Maturité / Amour / Sérénité | Endurance / Maturity / Love / Serenity |
| Féconde / stérile | Fertile / sterile |
| Carburant d'enclos | Paddock Catalyst |
| Animakina / Kromakina / Optimakina | inchangés |


## 3. Guilde & raids

| FR | EN officiel |
|---|---|
| Hall de guilde | Guild Hall |
| Guildalogemme | Guildalogem |
| Guildatons | Guildokens |
| Amateur de Guildatons | Guildoken Lover |
| Reconnaissance de guilde | Guild Gratitude |
| Percepteur | Perceptor |
| Milicien | Militiaman |
| Prisme d'alliance | Alliance Prism |
| Missions — Donjon / Régulation / Anomalie / Songes Infinis | Dungeon / Culling / Anomaly / Infinite Dreams |
| Gouffre du Gigalodon | Gigalodon's Chasm |
| Sanctuaire des Jardins éternels | Eternal Gardens Sanctuary |
| Reine Écarlate / Princesse Maudite | Scarlet Queen / Cursed Princess |
| Mureine | Moraympress |
| Exécrabe | Crabinator |
| Willorque | Willorka |
| Floracle | Floracle (inchangé) |
| Volonté de la Reine / de la Princesse | Will of the Queen / Will of the Princess |
| Pommeau enraciné | Rooted Pommel |
| Incantation Florale | Floral Incantation |
| Exil Impérial | Imperial Exile |
| Exécution de l'Évadé | Execution of the Escaped |
| Lien Familial | Family Ties |
| Statue Maudite | Cursed Statue |
| Veilleur de l'Ouvrage | Watcher of the Text |
| Gardien du Clos | Guardian of the Fields |
| Défenseur de la Réserve | Defender of the Reserve |
| Sentinelle de la Cour | Sentinel of the Court |
| Fleur des protecteurs | Protectors' Flower |
| Étreinte Végétale | Vegegrip |
| Grèves Écarlates | Scarlet Greaves |
| Chachardon | Thistle Bow Meow |
| Sel des profondeurs | Salt of the Depths |
| Madrépire / Kokayou | Madreporrible / Shebble |
| Krak'Haine | Hate'Raken |
| Gigarâle | Gigagroan |
| Tournageoire | Spinnafin |
| Belladone | Belladonna |
| Ossuaire abyssal | Abyssal Ossuary |
| Luminomachine / Luminarium | inchangés |

## 4. Termes absents de DofusDB (choix documentés)

Ces termes n'existent dans aucune chaîne du client (interface, PNJ, salles
internes aux instances récentes). Le choix retenu est indiqué pour pouvoir être
corrigé en un seul endroit si Ankama publie une traduction.

| FR | EN retenu | Raison |
|---|---|---|
| Puits / reliquat (FM) | the well (residual) | aucune chaîne de jeu ; mot anglais courant |
| SC / SN / EC (forgemagie) | CS / NS / CF (Critical/Neutral Success, Critical Failure) | jargon, jamais affiché par le jeu |
| Over / Exo | Over / Exo | jargon communautaire international |
| Enclos du Débutant | Beginner Paddock | bâtiment sans entrée DofusDB |
| Territoire des Nimbos | Stubbyob territory | « Nimbos » → **Stubbyob** (vérifié) ; zone absente de DofusDB |
| Idées Noires (raid) | Dark Thoughts | état interne non traduit |
| Inérodable (état) | Erosion-Proof | état interne non traduit |
| Sombrefond de Willorque | Willorka's Dark Deep | salle interne non traduite |
| Ouvrage Monochrome / Cour d'Éphèdre / Clos des Protecteurs / Réserve de Belladone | Monochrome Work / Ephedra Court / Protectors' Fields / Belladonna's Reserve | salles internes du Sanctuaire |
| Lame Fleurie | Blossoming Blade | objet interne du raid |
| Les Dents de l'Amer | The Teeth of the Bitter Sea | sort de capture du Gigalodon |
| Châtiment Royal | Royal Punishment | « Châtiment » → *Punishment* (vérifié ailleurs) |
| Coffres (Majestueux) du Gouffre / du Sanctuaire | (Majestic) Chasm / Sanctuary Chests | « Gouffre » → *Chasm* (vérifié) |
| Jalon (jauge de guilde) | Milestone | texte d'interface non exposé par DofusDB |
| Maître de guilde / Officier / Initié / À l'essai | Guild Master / Officer / Initiate / On Trial | rangs d'interface |
| Salles du hall | Main / Mission / Merchant / Training Room | salles de hall |
| Hôtel de vente | marketplace | client anglais : « Marketplace » (minuscules pour le concept) |
| Nébuleux (compo burst) | Nébuleux | non identifié dans DofusDB : conservé tel quel |

## 5. Règle de repli

- Une fiche **sans** contenu EN n'existe pas : les 7 guides publics ont leurs deux
  variantes (`src/content/guides/en/*.ts`).
- Journal des mises à jour : colonnes `titleEn` / `summaryEn` / `contentEn`.
  `NULL` ⇒ repli automatique sur le FR (`localizeChangelogEntry`) : jamais de
  page vide en anglais.
- Garde-fou automatique : `tests/unit/guides-i18n.test.ts` vérifie la parité
  structurelle FR/EN (titres, tableaux, images, listes) et l'absence de mots-outils
  français dans les fiches anglaises.
- Traductions du journal : `node scripts/backfill-changelog-en.mjs` (idempotent,
  n'écrase jamais une saisie faite dans God).

| Minilodon, Poutch Ingball, Gigalodoom, Ultrasplash | inchangés |
