const fetch = require('node-fetch');
const items = [
  'Pépite', 'Os de Sramouraï', 'Plume de Gobvious', 'Peau de Don Duss Ang', 'Corne de Berserkoffre',
  'Canine de Mergranlou', 'Coquille de Dragoss Charbon', 'Aile de Dragodinde', "Poil de Rat d'Égoutant",
  'Fleur de Gloutoblop', 'Peau de Don Dorgan', 'Moustache du Mufafah', 'Oreille de Rhinoféroce',
  'Duvet de Truchon', 'Tronc de Kokoko', 'Casque Cassé du Chafer', 'Poils de Smilomouth', 'Carpelle de Brouture',
  'Croupion de Truchmuche', 'Calumet Zoth', 'Estomac de Black Wo Wabbit', 'Pierre de Topaze',
  'Substrat de Bosquet', 'Kouartz', 'Bakélélite', 'Magnésite', 'Kriptonite', 'Ebonite', 'Lait de Tortue',
  'Substrat de Fascine', 'Substrat de Fourré', 'Coquille de Dragoss Ardoise', 'Laine de Dardalaine',
  'Écorce de Liroye Merline', 'Rotule du Disciple Zoth', 'Aile Atrophiée de Tofu Dodu', 'Corne de Dragoss Calcaire',
  'Corne de Rhinoféroce', 'Échasse de Molette', 'Morpion de Truchideur', 'Arête géante du Shamansot',
  'Étoffe de Kaniglou', 'Bière du Feubuk', 'Oreille du Fu Mansot', "Talon d'achille de l'Abrakleur sombre",
  'Chaussette trouée de Dramak', 'Peau de Moon', 'Carapace du Mantiscore', 'Carniflore', 'Feuille de Blop Multicolore Royal',
  'Plume du Kwakwa', 'Groin de Dragon Cochon', 'Laine du Royalmouth', 'Pixel de Fraktale'
];
const amounts = {
  'Pépite': 600, 'Os de Sramouraï': 15, 'Plume de Gobvious': 10, 'Peau de Don Duss Ang': 10, 'Corne de Berserkoffre': 10,
  'Canine de Mergranlou': 10, 'Coquille de Dragoss Charbon': 10, 'Aile de Dragodinde': 10, "Poil de Rat d'Égoutant": 10,
  'Fleur de Gloutoblop': 10, 'Peau de Don Dorgan': 10, 'Moustache du Mufafah': 10, 'Oreille de Rhinoféroce': 10,
  'Duvet de Truchon': 10, 'Tronc de Kokoko': 10, 'Casque Cassé du Chafer': 10, 'Poils de Smilomouth': 10, 'Carpelle de Brouture': 10,
  'Croupion de Truchmuche': 10, 'Calumet Zoth': 10, 'Estomac de Black Wo Wabbit': 8, 'Pierre de Topaze': 5,
  'Substrat de Bosquet': 5, 'Kouartz': 10, 'Bakélélite': 5, 'Magnésite': 5, 'Kriptonite': 10, 'Ebonite': 5, 'Lait de Tortue': 5,
  'Substrat de Fascine': 5, 'Substrat de Fourré': 5, 'Coquille de Dragoss Ardoise': 3, 'Laine de Dardalaine': 3,
  'Écorce de Liroye Merline': 3, 'Rotule du Disciple Zoth': 3, 'Aile Atrophiée de Tofu Dodu': 3, 'Corne de Dragoss Calcaire': 3,
  'Corne de Rhinoféroce': 3, 'Échasse de Molette': 3, 'Morpion de Truchideur': 3, 'Arête géante du Shamansot': 3,
  'Étoffe de Kaniglou': 1, 'Bière du Feubuk': 1, 'Oreille du Fu Mansot': 1, "Talon d'achille de l'Abrakleur sombre": 1,
  'Chaussette trouée de Dramak': 2, 'Peau de Moon': 1, 'Carapace du Mantiscore': 1, 'Carniflore': 1, 'Feuille de Blop Multicolore Royal': 1,
  'Plume du Kwakwa': 1, 'Groin de Dragon Cochon': 1, 'Laine du Royalmouth': 1, 'Pixel de Fraktale': 1
};
async function getIds() {
  const result = [];
  for (const item of items) {
     const i = await fetch('https://api.dofusdb.fr/items?lang=fr&name.fr=' + encodeURIComponent(item)).then(r=>r.json());
     if (i.data && i.data.length > 0) {
       result.push({ id: i.data[0].id, name: i.data[0].name.fr, amount: amounts[item] });
     } else {
       // fallback like
       const iLike = await fetch('https://api.dofusdb.fr/items?lang=fr&name.fr[$like]=' + encodeURIComponent(item + "%")).then(r=>r.json());
       if (iLike.data && iLike.data.length > 0) {
          result.push({ id: iLike.data[0].id, name: iLike.data[0].name.fr, amount: amounts[item] });
       } else {
          console.log('NOT FOUND:', item);
       }
     }
  }
  require('fs').writeFileSync('turquoise-items.json', JSON.stringify(result, null, 2));
  console.log('Saved to turquoise-items.json');
}
getIds();
