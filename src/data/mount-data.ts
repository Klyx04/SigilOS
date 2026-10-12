// Fichier généré automatiquement — Base de données exhaustive des montures Dofus (Dragodindes, Muldos, Volkornes)
// Conforme Dofus 3 / Unity & DofusDB — 306 montures complètes (66 Dragodindes, 120 Muldos, 120 Volkornes)

export type MountFamily = "dragodinde" | "muldo" | "volkorne";
export type StatTag = "pm" | "pa" | "po" | "vita" | "stats" | "puissance" | "invoc" | "ini" | "prosp" | "cc" | "sagesse" | "res";

export interface MountInfo {
  id: string;
  name: string;
  family: MountFamily;
  generation: number;
  type: "pure" | "bicolore";
  parents?: [string, string];
  stats: string;
  statTags: StatTag[];
  img: string;
}

export const MOUNT_DATABASE: MountInfo[] = [
  {
    "id": "dd-amande",
    "name": "Dragodinde Amande",
    "family": "dragodinde",
    "generation": 1,
    "type": "pure",
    "stats": "400 Vitalité, 1700 Initiative",
    "statTags": [
      "vita",
      "ini"
    ],
    "img": "https://api.dofusdb.fr/img/items/97020.png"
  },
  {
    "id": "dd-doree",
    "name": "Dragodinde Dorée",
    "family": "dragodinde",
    "generation": 1,
    "type": "pure",
    "stats": "400 Vitalité, 2 Invocations",
    "statTags": [
      "vita",
      "invoc"
    ],
    "img": "https://api.dofusdb.fr/img/items/97018.png"
  },
  {
    "id": "dd-rousse",
    "name": "Dragodinde Rousse",
    "family": "dragodinde",
    "generation": 1,
    "type": "pure",
    "stats": "400 Vitalité, 60 Soins",
    "statTags": [
      "vita"
    ],
    "img": "https://api.dofusdb.fr/img/items/97010.png"
  },
  {
    "id": "dd-amandeetrousse",
    "name": "Dragodinde Amande et Rousse",
    "family": "dragodinde",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 1200 Initiative, 45 Soins",
    "statTags": [
      "vita",
      "ini"
    ],
    "img": "https://api.dofusdb.fr/img/items/97038.png"
  },
  {
    "id": "dd-doreeetrousse",
    "name": "Dragodinde Dorée et Rousse",
    "family": "dragodinde",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 1 Invocations, 45 Soins",
    "statTags": [
      "vita",
      "invoc"
    ],
    "img": "https://api.dofusdb.fr/img/items/97046.png"
  },
  {
    "id": "dd-amandeetdoree",
    "name": "Dragodinde Amande et Dorée",
    "family": "dragodinde",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Dorée"
    ],
    "stats": "400 Vitalité, 1200 Initiative, 1 Invocations",
    "statTags": [
      "vita",
      "ini",
      "invoc"
    ],
    "img": "https://api.dofusdb.fr/img/items/97033.png"
  },
  {
    "id": "dd-ebene",
    "name": "Dragodinde Ebène",
    "family": "dragodinde",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Dragodinde Amande et Dorée",
      "Dragodinde Dorée et Rousse"
    ],
    "stats": "400 Vitalité, 120 Agilité",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97004.png"
  },
  {
    "id": "dd-indigo",
    "name": "Dragodinde Indigo",
    "family": "dragodinde",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Dragodinde Amande et Dorée",
      "Dragodinde Amande et Rousse"
    ],
    "stats": "400 Vitalité, 120 Chance",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97017.png"
  },
  {
    "id": "dd-indigoetrousse",
    "name": "Dragodinde Indigo et Rousse",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Indigo",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Chance, 45 Soins",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97062.png"
  },
  {
    "id": "dd-ebeneetrousse",
    "name": "Dragodinde Ebène et Rousse",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Agilité, 45 Soins",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97012.png"
  },
  {
    "id": "dd-amandeetindigo",
    "name": "Dragodinde Amande et Indigo",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Indigo"
    ],
    "stats": "400 Vitalité, 70 Chance, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97119.png"
  },
  {
    "id": "dd-amandeetebene",
    "name": "Dragodinde Amande et Ebène",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Ebène"
    ],
    "stats": "400 Vitalité, 70 Agilité, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97120.png"
  },
  {
    "id": "dd-doreeetindigo",
    "name": "Dragodinde Dorée et Indigo",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Indigo"
    ],
    "stats": "400 Vitalité, 70 Chance, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97044.png"
  },
  {
    "id": "dd-doreeetebene",
    "name": "Dragodinde Dorée et Ebène",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Ebène"
    ],
    "stats": "400 Vitalité, 70 Agilité, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97042.png"
  },
  {
    "id": "dd-ebeneetindigo",
    "name": "Dragodinde Ebène et Indigo",
    "family": "dragodinde",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Indigo"
    ],
    "stats": "400 Vitalité, 70 Chance, 70 Agilité",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97196.png"
  },
  {
    "id": "dd-pourpre",
    "name": "Dragodinde Pourpre",
    "family": "dragodinde",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Dragodinde Ebène et Indigo",
      "Dragodinde Amande et Rousse"
    ],
    "stats": "400 Vitalité, 120 Force",
    "statTags": [
      "vita",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97019.png"
  },
  {
    "id": "dd-orchidee",
    "name": "Dragodinde Orchidée",
    "family": "dragodinde",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Dragodinde Ebène et Indigo",
      "Dragodinde Dorée et Rousse"
    ],
    "stats": "400 Vitalité, 120 Intelligence",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97022.png"
  },
  {
    "id": "dd-pourpreetrousse",
    "name": "Dragodinde Pourpre et Rousse",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Pourpre",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Force, 45 Soins",
    "statTags": [
      "vita",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97071.png"
  },
  {
    "id": "dd-orchideeetrousse",
    "name": "Dragodinde Orchidée et Rousse",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Orchidée",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 45 Soins",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97070.png"
  },
  {
    "id": "dd-amandeetpourpre",
    "name": "Dragodinde Amande et Pourpre",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97117.png"
  },
  {
    "id": "dd-amandeetorchidee",
    "name": "Dragodinde Amande et Orchidée",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97118.png"
  },
  {
    "id": "dd-doreeetpourpre",
    "name": "Dragodinde Dorée et Pourpre",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97049.png"
  },
  {
    "id": "dd-doreeetorchidee",
    "name": "Dragodinde Dorée et Orchidée",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97048.png"
  },
  {
    "id": "dd-indigoetpourpre",
    "name": "Dragodinde Indigo et Pourpre",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Indigo",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 70 Chance",
    "statTags": [
      "vita",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97192.png"
  },
  {
    "id": "dd-indigoetorchidee",
    "name": "Dragodinde Indigo et Orchidée",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Indigo",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 70 Chance",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97194.png"
  },
  {
    "id": "dd-ebeneetpourpre",
    "name": "Dragodinde Ebène et Pourpre",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 70 Agilité",
    "statTags": [
      "vita",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97193.png"
  },
  {
    "id": "dd-ebeneetorchidee",
    "name": "Dragodinde Ebène et Orchidée",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 70 Agilité",
    "statTags": [
      "vita",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97195.png"
  },
  {
    "id": "dd-orchideeetpourpre",
    "name": "Dragodinde Orchidée et Pourpre",
    "family": "dragodinde",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Dragodinde Orchidée",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 70 Intelligence",
    "statTags": [
      "vita",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97191.png"
  },
  {
    "id": "dd-ivoire",
    "name": "Dragodinde Ivoire",
    "family": "dragodinde",
    "generation": 7,
    "type": "pure",
    "parents": [
      "Dragodinde Orchidée et Pourpre",
      "Dragodinde Indigo et Pourpre"
    ],
    "stats": "400 Vitalité, 90 Puissance",
    "statTags": [
      "vita",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97016.png"
  },
  {
    "id": "dd-turquoise",
    "name": "Dragodinde Turquoise",
    "family": "dragodinde",
    "generation": 7,
    "type": "pure",
    "parents": [
      "Dragodinde Orchidée et Pourpre",
      "Dragodinde Ebène et Orchidée"
    ],
    "stats": "400 Vitalité, 90 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97015.png"
  },
  {
    "id": "dd-ivoireetrousse",
    "name": "Dragodinde Ivoire et Rousse",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ivoire",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Puissance, 45 Soins",
    "statTags": [
      "vita",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97011.png"
  },
  {
    "id": "dd-turquoiseetrousse",
    "name": "Dragodinde Turquoise et Rousse",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Turquoise",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 70 Prospection, 45 Soins",
    "statTags": [
      "vita",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97069.png"
  },
  {
    "id": "dd-amandeetivoire",
    "name": "Dragodinde Amande et Ivoire",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Puissance, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97037.png"
  },
  {
    "id": "dd-amandeetturquoise",
    "name": "Dragodinde Amande et Turquoise",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 70 Prospection, 1200 Initiative",
    "statTags": [
      "vita",
      "ini",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97144.png"
  },
  {
    "id": "dd-doreeetivoire",
    "name": "Dragodinde Dorée et Ivoire",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Puissance, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97045.png"
  },
  {
    "id": "dd-doreeetturquoise",
    "name": "Dragodinde Dorée et Turquoise",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 70 Prospection, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97047.png"
  },
  {
    "id": "dd-indigoetivoire",
    "name": "Dragodinde Indigo et Ivoire",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Indigo",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Chance, 70 Puissance",
    "statTags": [
      "vita",
      "puissance",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97212.png"
  },
  {
    "id": "dd-indigoetturquoise",
    "name": "Dragodinde Indigo et Turquoise",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Indigo",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 70 Chance, 70 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97217.png"
  },
  {
    "id": "dd-ebeneetivoire",
    "name": "Dragodinde Ebène et Ivoire",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Agilité, 70 Puissance",
    "statTags": [
      "vita",
      "puissance",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97213.png"
  },
  {
    "id": "dd-ebeneetturquoise",
    "name": "Dragodinde Ebène et Turquoise",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 70 Agilité, 70 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97218.png"
  },
  {
    "id": "dd-ivoireetpourpre",
    "name": "Dragodinde Ivoire et Pourpre",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ivoire",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 70 Puissance",
    "statTags": [
      "vita",
      "puissance",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97122.png"
  },
  {
    "id": "dd-turquoiseetpourpre",
    "name": "Dragodinde Turquoise et Pourpre",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Turquoise",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 70 Force, 70 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97073.png"
  },
  {
    "id": "dd-ivoireetorchidee",
    "name": "Dragodinde Ivoire et Orchidée",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ivoire",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 70 Puissance",
    "statTags": [
      "vita",
      "puissance",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97123.png"
  },
  {
    "id": "dd-turquoiseetorchidee",
    "name": "Dragodinde Turquoise et Orchidée",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Turquoise",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 70 Intelligence, 70 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97072.png"
  },
  {
    "id": "dd-ivoireetturquoise",
    "name": "Dragodinde Ivoire et Turquoise",
    "family": "dragodinde",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ivoire",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 70 Puissance, 70 Prospection",
    "statTags": [
      "vita",
      "puissance",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97139.png"
  },
  {
    "id": "dd-emeraude",
    "name": "Dragodinde Emeraude",
    "family": "dragodinde",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Dragodinde Ivoire et Turquoise",
      "Dragodinde Ivoire et Pourpre"
    ],
    "stats": "400 Vitalité, 14% Chance critique",
    "statTags": [
      "vita",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97021.png"
  },
  {
    "id": "dd-prune",
    "name": "Dragodinde Prune",
    "family": "dragodinde",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Dragodinde Ivoire et Turquoise",
      "Dragodinde Turquoise et Orchidée"
    ],
    "stats": "400 Vitalité, 2 Portée",
    "statTags": [
      "vita",
      "po",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97023.png"
  },
  {
    "id": "dd-emeraudeetrousse",
    "name": "Dragodinde Emeraude et Rousse",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 45 Soins",
    "statTags": [
      "vita",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97057.png"
  },
  {
    "id": "dd-pruneetrousse",
    "name": "Dragodinde Prune et Rousse",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Rousse"
    ],
    "stats": "400 Vitalité, 1 Portée, 45 Soins",
    "statTags": [
      "vita",
      "po",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97084.png"
  },
  {
    "id": "dd-amandeetemeraude",
    "name": "Dragodinde Amande et Emeraude",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Amande",
      "Dragodinde Emeraude"
    ],
    "stats": "400 Vitalité, 1200 Initiative, 10% Chance critique",
    "statTags": [
      "vita",
      "ini",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97230.png"
  },
  {
    "id": "dd-pruneetamande",
    "name": "Dragodinde Prune et Amande",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Amande"
    ],
    "stats": "400 Vitalité, 1200 Initiative, 1 Portée",
    "statTags": [
      "vita",
      "ini",
      "po",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97077.png"
  },
  {
    "id": "dd-doreeetemeraude",
    "name": "Dragodinde Dorée et Emeraude",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Dorée",
      "Dragodinde Emeraude"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97043.png"
  },
  {
    "id": "dd-pruneetdoree",
    "name": "Dragodinde Prune et Dorée",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Dorée"
    ],
    "stats": "400 Vitalité, 1 Portée, 1 Invocations",
    "statTags": [
      "vita",
      "invoc",
      "po",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97078.png"
  },
  {
    "id": "dd-emeraudeetindigo",
    "name": "Dragodinde Emeraude et Indigo",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Indigo"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 70 Chance",
    "statTags": [
      "vita",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97158.png"
  },
  {
    "id": "dd-pruneetindigo",
    "name": "Dragodinde Prune et Indigo",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Indigo"
    ],
    "stats": "400 Vitalité, 1 Portée, 70 Chance",
    "statTags": [
      "vita",
      "po",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97082.png"
  },
  {
    "id": "dd-ebeneetemeraude",
    "name": "Dragodinde Ebène et Emeraude",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Ebène",
      "Dragodinde Emeraude"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 70 Agilité",
    "statTags": [
      "vita",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97229.png"
  },
  {
    "id": "dd-pruneetebene",
    "name": "Dragodinde Prune et Ebène",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Ebène"
    ],
    "stats": "400 Vitalité, 70 Agilité, 1 Portée",
    "statTags": [
      "vita",
      "po",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97079.png"
  },
  {
    "id": "dd-emeraudeetpourpre",
    "name": "Dragodinde Emeraude et Pourpre",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 70 Force",
    "statTags": [
      "vita",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97156.png"
  },
  {
    "id": "dd-pruneetpourpre",
    "name": "Dragodinde Prune et Pourpre",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Pourpre"
    ],
    "stats": "400 Vitalité, 1 Portée, 70 Force",
    "statTags": [
      "vita",
      "po",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97087.png"
  },
  {
    "id": "dd-emeraudeetorchidee",
    "name": "Dragodinde Emeraude et Orchidée",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 70 Intelligence",
    "statTags": [
      "vita",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97157.png"
  },
  {
    "id": "dd-pruneetorchidee",
    "name": "Dragodinde Prune et Orchidée",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Orchidée"
    ],
    "stats": "400 Vitalité, 1 Portée, 70 Intelligence",
    "statTags": [
      "vita",
      "po",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97086.png"
  },
  {
    "id": "dd-emeraudeetivoire",
    "name": "Dragodinde Emeraude et Ivoire",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Puissance, 10% Chance critique",
    "statTags": [
      "vita",
      "puissance",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97163.png"
  },
  {
    "id": "dd-pruneetivoire",
    "name": "Dragodinde Prune et Ivoire",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Ivoire"
    ],
    "stats": "400 Vitalité, 70 Puissance, 1 Portée",
    "statTags": [
      "vita",
      "po",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97083.png"
  },
  {
    "id": "dd-emeraudeetturquoise",
    "name": "Dragodinde Emeraude et Turquoise",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Emeraude",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 10% Chance critique, 70 Prospection",
    "statTags": [
      "vita",
      "prosp",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97164.png"
  },
  {
    "id": "dd-pruneetturquoise",
    "name": "Dragodinde Prune et Turquoise",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Turquoise"
    ],
    "stats": "400 Vitalité, 1 Portée, 70 Prospection",
    "statTags": [
      "vita",
      "po",
      "prosp",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97085.png"
  },
  {
    "id": "dd-pruneetemeraude",
    "name": "Dragodinde Prune et Emeraude",
    "family": "dragodinde",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Dragodinde Prune",
      "Dragodinde Emeraude"
    ],
    "stats": "400 Vitalité, 1 Portée, 10% Chance critique",
    "statTags": [
      "vita",
      "po",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97080.png"
  },
  {
    "id": "muldo-dore",
    "name": "Muldo Doré",
    "family": "muldo",
    "generation": 1,
    "type": "pure",
    "stats": "70 Puissance, 1 PM",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97094.png"
  },
  {
    "id": "muldo-ebene",
    "name": "Muldo Ebène",
    "family": "muldo",
    "generation": 1,
    "type": "pure",
    "stats": "1 PM, 18% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97091.png"
  },
  {
    "id": "muldo-indigo",
    "name": "Muldo Indigo",
    "family": "muldo",
    "generation": 1,
    "type": "pure",
    "stats": "1 PM, 18% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97092.png"
  },
  {
    "id": "muldo-orchidee",
    "name": "Muldo Orchidée",
    "family": "muldo",
    "generation": 1,
    "type": "pure",
    "stats": "1 PM, 18% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97090.png"
  },
  {
    "id": "muldo-pourpre",
    "name": "Muldo Pourpre",
    "family": "muldo",
    "generation": 1,
    "type": "pure",
    "stats": "1 PM, 18% Résistance Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97093.png"
  },
  {
    "id": "muldo-doreetebene",
    "name": "Muldo Doré et Ebène",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Ebène"
    ],
    "stats": "60 Puissance, 1 PM, 10% Résistance Air",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97110.png"
  },
  {
    "id": "muldo-doreetindigo",
    "name": "Muldo Doré et Indigo",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Indigo"
    ],
    "stats": "60 Puissance, 1 PM, 10% Résistance Eau",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97108.png"
  },
  {
    "id": "muldo-doreetorchidee",
    "name": "Muldo Doré et Orchidée",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Orchidée"
    ],
    "stats": "60 Puissance, 1 PM, 10% Résistance Feu",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97105.png"
  },
  {
    "id": "muldo-doreetpourpre",
    "name": "Muldo Doré et Pourpre",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Pourpre"
    ],
    "stats": "60 Puissance, 1 PM, 10% Résistance Terre",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97101.png"
  },
  {
    "id": "muldo-ebeneetindigo",
    "name": "Muldo Ebène et Indigo",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 10% Résistance Eau, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97196.png"
  },
  {
    "id": "muldo-ebeneetorchidee",
    "name": "Muldo Ebène et Orchidée",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 10% Résistance Feu, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97195.png"
  },
  {
    "id": "muldo-ebeneetpourpre",
    "name": "Muldo Ebène et Pourpre",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 10% Résistance Terre, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97193.png"
  },
  {
    "id": "muldo-indigoetorchidee",
    "name": "Muldo Indigo et Orchidée",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Indigo",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 10% Résistance Feu, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97194.png"
  },
  {
    "id": "muldo-indigoetpourpre",
    "name": "Muldo Indigo et Pourpre",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Indigo",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 10% Résistance Terre, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97192.png"
  },
  {
    "id": "muldo-orchideeetpourpre",
    "name": "Muldo Orchidée et Pourpre",
    "family": "muldo",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Muldo Orchidée",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 10% Résistance Terre, 10% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97191.png"
  },
  {
    "id": "muldo-amande",
    "name": "Muldo Amande",
    "family": "muldo",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Muldo Indigo et Pourpre",
      "Muldo Ebène et Orchidée"
    ],
    "stats": "1 PM, 50 Fuite",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97096.png"
  },
  {
    "id": "muldo-roux",
    "name": "Muldo Roux",
    "family": "muldo",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Muldo Doré et Pourpre",
      "Muldo Doré et Orchidée"
    ],
    "stats": "1 PM, 50 Tacle",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97095.png"
  },
  {
    "id": "muldo-doreetamande",
    "name": "Muldo Doré et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Amande"
    ],
    "stats": "60 Puissance, 1 PM, 40 Fuite",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97121.png"
  },
  {
    "id": "muldo-ebeneetamande",
    "name": "Muldo Ebène et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Amande"
    ],
    "stats": "1 PM, 10% Résistance Air, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97200.png"
  },
  {
    "id": "muldo-indigoetamande",
    "name": "Muldo Indigo et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Indigo",
      "Muldo Amande"
    ],
    "stats": "1 PM, 10% Résistance Eau, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97199.png"
  },
  {
    "id": "muldo-orchideeetamande",
    "name": "Muldo Orchidée et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Orchidée",
      "Muldo Amande"
    ],
    "stats": "1 PM, 10% Résistance Feu, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97198.png"
  },
  {
    "id": "muldo-pourpreetamande",
    "name": "Muldo Pourpre et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Pourpre",
      "Muldo Amande"
    ],
    "stats": "1 PM, 10% Résistance Terre, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97197.png"
  },
  {
    "id": "muldo-rouxetamande",
    "name": "Muldo Roux et Amande",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Amande"
    ],
    "stats": "1 PM, 40 Tacle, 40 Fuite",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97201.png"
  },
  {
    "id": "muldo-rouxetdore",
    "name": "Muldo Roux et Doré",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 40 Tacle",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97291.png"
  },
  {
    "id": "muldo-rouxetebene",
    "name": "Muldo Roux et Ebène",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 10% Résistance Air, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97114.png"
  },
  {
    "id": "muldo-rouxetindigo",
    "name": "Muldo Roux et Indigo",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 10% Résistance Eau, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97113.png"
  },
  {
    "id": "muldo-rouxetorchidee",
    "name": "Muldo Roux et Orchidée",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 10% Résistance Feu, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97112.png"
  },
  {
    "id": "muldo-rouxetpourpre",
    "name": "Muldo Roux et Pourpre",
    "family": "muldo",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 10% Résistance Terre, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97111.png"
  },
  {
    "id": "muldo-ivoire",
    "name": "Muldo Ivoire",
    "family": "muldo",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Muldo Ebène et Amande",
      "Muldo Roux et Doré"
    ],
    "stats": "1 PM, 50 Esquive PA",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97097.png"
  },
  {
    "id": "muldo-turquoise",
    "name": "Muldo Turquoise",
    "family": "muldo",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Muldo Roux et Ebène",
      "Muldo Doré et Amande"
    ],
    "stats": "1 PM, 50 Esquive PM",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97098.png"
  },
  {
    "id": "muldo-amandeetivoire",
    "name": "Muldo Amande et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Amande",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 40 Fuite, 40 Esquive PA",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97138.png"
  },
  {
    "id": "muldo-doreetivoire",
    "name": "Muldo Doré et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Ivoire"
    ],
    "stats": "60 Puissance, 1 PM, 40 Esquive PA",
    "statTags": [
      "pm",
      "puissance",
    ],
    "img": "https://api.dofusdb.fr/img/items/97126.png"
  },
  {
    "id": "muldo-ebeneetivoire",
    "name": "Muldo Ebène et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 10% Résistance Air, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97213.png"
  },
  {
    "id": "muldo-indigoetivoire",
    "name": "Muldo Indigo et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Indigo",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 10% Résistance Eau, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97212.png"
  },
  {
    "id": "muldo-orchideeetivoire",
    "name": "Muldo Orchidée et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Orchidée",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 10% Résistance Feu, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97211.png"
  },
  {
    "id": "muldo-pourpreetivoire",
    "name": "Muldo Pourpre et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Pourpre",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 10% Résistance Terre, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97210.png"
  },
  {
    "id": "muldo-rouxetivoire",
    "name": "Muldo Roux et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 40 Tacle, 40 Esquive PA",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97127.png"
  },
  {
    "id": "muldo-turquoiseetamande",
    "name": "Muldo Turquoise et Amande",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Amande"
    ],
    "stats": "1 PM, 40 Fuite, 40 Esquive PM",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97203.png"
  },
  {
    "id": "muldo-turquoiseetdore",
    "name": "Muldo Turquoise et Doré",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 40 Esquive PM",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97294.png"
  },
  {
    "id": "muldo-turquoiseetebene",
    "name": "Muldo Turquoise et Ebène",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 10% Résistance Air, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97142.png"
  },
  {
    "id": "muldo-turquoiseetindigo",
    "name": "Muldo Turquoise et Indigo",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 10% Résistance Eau, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97141.png"
  },
  {
    "id": "muldo-turquoiseetivoire",
    "name": "Muldo Turquoise et Ivoire",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 40 Esquive PA, 40 Esquive PM",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97214.png"
  },
  {
    "id": "muldo-turquoiseetorchidee",
    "name": "Muldo Turquoise et Orchidée",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 10% Résistance Feu, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97165.png"
  },
  {
    "id": "muldo-turquoiseetpourpre",
    "name": "Muldo Turquoise et Pourpre",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 10% Résistance Terre, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97140.png"
  },
  {
    "id": "muldo-turquoiseetroux",
    "name": "Muldo Turquoise et Roux",
    "family": "muldo",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Roux"
    ],
    "stats": "1 PM, 40 Tacle, 40 Esquive PM",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97209.png"
  },
  {
    "id": "muldo-emeraude",
    "name": "Muldo Emeraude",
    "family": "muldo",
    "generation": 7,
    "type": "pure",
    "parents": [
      "Muldo Turquoise et Ivoire",
      "Muldo Turquoise et Doré"
    ],
    "stats": "1 PM, 40 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97100.png"
  },
  {
    "id": "muldo-prune",
    "name": "Muldo Prune",
    "family": "muldo",
    "generation": 7,
    "type": "pure",
    "parents": [
      "Muldo Ebène et Ivoire",
      "Muldo Turquoise et Pourpre"
    ],
    "stats": "12% Chance critique, 1 PM",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97099.png"
  },
  {
    "id": "muldo-amandeetemeraude",
    "name": "Muldo Amande et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Amande",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 40 Fuite, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97230.png"
  },
  {
    "id": "muldo-doreetemeraude",
    "name": "Muldo Doré et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Doré",
      "Muldo Emeraude"
    ],
    "stats": "60 Puissance, 1 PM, 30 Dommages critiques",
    "statTags": [
      "pm",
      "puissance",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97160.png"
  },
  {
    "id": "muldo-ebeneetemeraude",
    "name": "Muldo Ebène et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Ebène",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 10% Résistance Air, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97229.png"
  },
  {
    "id": "muldo-indigoetemeraude",
    "name": "Muldo Indigo et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Indigo",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 10% Résistance Eau, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97228.png"
  },
  {
    "id": "muldo-ivoireetemeraude",
    "name": "Muldo Ivoire et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Ivoire",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 40 Esquive PA, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97233.png"
  },
  {
    "id": "muldo-orchideeetemeraude",
    "name": "Muldo Orchidée et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Orchidée",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 10% Résistance Feu, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97227.png"
  },
  {
    "id": "muldo-pourpreetemeraude",
    "name": "Muldo Pourpre et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Pourpre",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 10% Résistance Terre, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97226.png"
  },
  {
    "id": "muldo-pruneetamande",
    "name": "Muldo Prune et Amande",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Amande"
    ],
    "stats": "8% Chance critique, 1 PM, 40 Fuite",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97152.png"
  },
  {
    "id": "muldo-pruneetdore",
    "name": "Muldo Prune et Doré",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 8% Chance critique, 1 PM",
    "statTags": [
      "pm",
      "puissance",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97295.png"
  },
  {
    "id": "muldo-pruneetebene",
    "name": "Muldo Prune et Ebène",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Ebène"
    ],
    "stats": "8% Chance critique, 1 PM, 10% Résistance Air",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97149.png"
  },
  {
    "id": "muldo-pruneetemeraude",
    "name": "Muldo Prune et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Emeraude"
    ],
    "stats": "8% Chance critique, 1 PM, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97155.png"
  },
  {
    "id": "muldo-pruneetindigo",
    "name": "Muldo Prune et Indigo",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Indigo"
    ],
    "stats": "8% Chance critique, 1 PM, 10% Résistance Eau",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97148.png"
  },
  {
    "id": "muldo-pruneetivoire",
    "name": "Muldo Prune et Ivoire",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Ivoire"
    ],
    "stats": "8% Chance critique, 1 PM, 40 Esquive PA",
    "statTags": [
      "pm",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97153.png"
  },
  {
    "id": "muldo-pruneetorchidee",
    "name": "Muldo Prune et Orchidée",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Orchidée"
    ],
    "stats": "8% Chance critique, 1 PM, 10% Résistance Feu",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97147.png"
  },
  {
    "id": "muldo-pruneetpourpre",
    "name": "Muldo Prune et Pourpre",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Pourpre"
    ],
    "stats": "8% Chance critique, 1 PM, 10% Résistance Terre",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97146.png"
  },
  {
    "id": "muldo-pruneetroux",
    "name": "Muldo Prune et Roux",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Roux"
    ],
    "stats": "8% Chance critique, 1 PM, 40 Tacle",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97151.png"
  },
  {
    "id": "muldo-pruneetturquoise",
    "name": "Muldo Prune et Turquoise",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Prune",
      "Muldo Turquoise"
    ],
    "stats": "8% Chance critique, 1 PM, 40 Esquive PM",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97154.png"
  },
  {
    "id": "muldo-rouxetemeraude",
    "name": "Muldo Roux et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Roux",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 40 Tacle, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97231.png"
  },
  {
    "id": "muldo-turquoiseetemeraude",
    "name": "Muldo Turquoise et Emeraude",
    "family": "muldo",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Muldo Turquoise",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 40 Esquive PM, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97234.png"
  },
  {
    "id": "muldo-aiguemarine",
    "name": "Muldo Aigue-marine",
    "family": "muldo",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Muldo Prune et Pourpre",
      "Muldo Roux et Emeraude"
    ],
    "stats": "1 PM, 40 Dommages Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambre",
    "name": "Muldo Ambre",
    "family": "muldo",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Muldo Pourpre et Emeraude",
      "Muldo Roux et Emeraude"
    ],
    "stats": "1 PM, 40 Dommages Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azur",
    "name": "Muldo Azur",
    "family": "muldo",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Muldo Prune et Roux",
      "Muldo Pourpre et Emeraude"
    ],
    "stats": "1 PM, 40 Dommages Eau",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corail",
    "name": "Muldo Corail",
    "family": "muldo",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Muldo Prune et Pourpre",
      "Muldo Prune et Roux"
    ],
    "stats": "1 PM, 40 Dommages Feu",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetamande",
    "name": "Muldo Aigue-marine et Amande",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Amande"
    ],
    "stats": "1 PM, 30 Dommages Air, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetdore",
    "name": "Muldo Aigue-marine et Doré",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 30 Dommages Air",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetebene",
    "name": "Muldo Aigue-marine et Ebène",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 30 Dommages Air, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetemeraude",
    "name": "Muldo Aigue-marine et Emeraude",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 30 Dommages Air, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetindigo",
    "name": "Muldo Aigue-marine et Indigo",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 30 Dommages Air, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetivoire",
    "name": "Muldo Aigue-marine et Ivoire",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 30 Dommages Air, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetorchidee",
    "name": "Muldo Aigue-marine et Orchidée",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 30 Dommages Air, 10% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetpourpre",
    "name": "Muldo Aigue-marine et Pourpre",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 30 Dommages Air, 10% Résistance Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetprune",
    "name": "Muldo Aigue-marine et Prune",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Prune"
    ],
    "stats": "8% Chance critique, 1 PM, 30 Dommages Air",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetroux",
    "name": "Muldo Aigue-marine et Roux",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Roux"
    ],
    "stats": "1 PM, 30 Dommages Air, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-aiguemarineetturquoise",
    "name": "Muldo Aigue-marine et Turquoise",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Aigue-marine",
      "Muldo Turquoise"
    ],
    "stats": "1 PM, 30 Dommages Air, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetaiguemarine",
    "name": "Muldo Ambre et Aigue-marine",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Aigue-marine"
    ],
    "stats": "1 PM, 30 Dommages Terre, 30 Dommages Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetamande",
    "name": "Muldo Ambre et Amande",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Amande"
    ],
    "stats": "1 PM, 30 Dommages Terre, 40 Fuite",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetazur",
    "name": "Muldo Ambre et Azur",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Azur"
    ],
    "stats": "1 PM, 30 Dommages Terre, 30 Dommages Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetcorail",
    "name": "Muldo Ambre et Corail",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Corail"
    ],
    "stats": "1 PM, 30 Dommages Terre, 30 Dommages Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetdore",
    "name": "Muldo Ambre et Doré",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 30 Dommages Terre",
    "statTags": [
      "pm",
      "puissance",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetebene",
    "name": "Muldo Ambre et Ebène",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 30 Dommages Terre, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetemeraude",
    "name": "Muldo Ambre et Emeraude",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 30 Dommages Terre, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetindigo",
    "name": "Muldo Ambre et Indigo",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 30 Dommages Terre, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetivoire",
    "name": "Muldo Ambre et Ivoire",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 30 Dommages Terre, 40 Esquive PA",
    "statTags": [
      "pm",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetorchidee",
    "name": "Muldo Ambre et Orchidée",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 30 Dommages Terre, 10% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetpourpre",
    "name": "Muldo Ambre et Pourpre",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 30 Dommages Terre, 10% Résistance Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetprune",
    "name": "Muldo Ambre et Prune",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Prune"
    ],
    "stats": "8% Chance critique, 1 PM, 30 Dommages Terre",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetroux",
    "name": "Muldo Ambre et Roux",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Roux"
    ],
    "stats": "1 PM, 30 Dommages Terre, 40 Tacle",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-ambreetturquoise",
    "name": "Muldo Ambre et Turquoise",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Ambre",
      "Muldo Turquoise"
    ],
    "stats": "1 PM, 30 Dommages Terre, 40 Esquive PM",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretaiguemarine",
    "name": "Muldo Azur et Aigue-marine",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Aigue-marine"
    ],
    "stats": "1 PM, 30 Dommages Eau, 30 Dommages Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretamande",
    "name": "Muldo Azur et Amande",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Amande"
    ],
    "stats": "1 PM, 30 Dommages Eau, 40 Fuite",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretdore",
    "name": "Muldo Azur et Doré",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 30 Dommages Eau",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretebene",
    "name": "Muldo Azur et Ebène",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 30 Dommages Eau, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretemeraude",
    "name": "Muldo Azur et Emeraude",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 30 Dommages Eau, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretindigo",
    "name": "Muldo Azur et Indigo",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 30 Dommages Eau, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretivoire",
    "name": "Muldo Azur et Ivoire",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 30 Dommages Eau, 40 Esquive PA",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretorchidee",
    "name": "Muldo Azur et Orchidée",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 30 Dommages Eau, 10% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretpourpre",
    "name": "Muldo Azur et Pourpre",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 30 Dommages Eau, 10% Résistance Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretprune",
    "name": "Muldo Azur et Prune",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Prune"
    ],
    "stats": "8% Chance critique, 1 PM, 30 Dommages Eau",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretroux",
    "name": "Muldo Azur et Roux",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Roux"
    ],
    "stats": "1 PM, 30 Dommages Eau, 40 Tacle",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-azuretturquoise",
    "name": "Muldo Azur et Turquoise",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Azur",
      "Muldo Turquoise"
    ],
    "stats": "1 PM, 30 Dommages Eau, 40 Esquive PM",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetaiguemarine",
    "name": "Muldo Corail et Aigue-marine",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Aigue-marine"
    ],
    "stats": "1 PM, 30 Dommages Feu, 30 Dommages Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetamande",
    "name": "Muldo Corail et Amande",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Amande"
    ],
    "stats": "1 PM, 30 Dommages Feu, 40 Fuite",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetazur",
    "name": "Muldo Corail et Azur",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Azur"
    ],
    "stats": "1 PM, 30 Dommages Feu, 30 Dommages Eau",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetdore",
    "name": "Muldo Corail et Doré",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Doré"
    ],
    "stats": "60 Puissance, 1 PM, 30 Dommages Feu",
    "statTags": [
      "pm",
      "puissance"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetebene",
    "name": "Muldo Corail et Ebène",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Ebène"
    ],
    "stats": "1 PM, 30 Dommages Feu, 10% Résistance Air",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetemeraude",
    "name": "Muldo Corail et Emeraude",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Emeraude"
    ],
    "stats": "1 PM, 30 Dommages Feu, 30 Dommages critiques",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetindigo",
    "name": "Muldo Corail et Indigo",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Indigo"
    ],
    "stats": "1 PM, 30 Dommages Feu, 10% Résistance Eau",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetivoire",
    "name": "Muldo Corail et Ivoire",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Ivoire"
    ],
    "stats": "1 PM, 30 Dommages Feu, 40 Esquive PA",
    "statTags": [
      "pm",
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetorchidee",
    "name": "Muldo Corail et Orchidée",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Orchidée"
    ],
    "stats": "1 PM, 30 Dommages Feu, 10% Résistance Feu",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetpourpre",
    "name": "Muldo Corail et Pourpre",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Pourpre"
    ],
    "stats": "1 PM, 30 Dommages Feu, 10% Résistance Terre",
    "statTags": [
      "pm",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetprune",
    "name": "Muldo Corail et Prune",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Prune"
    ],
    "stats": "8% Chance critique, 1 PM, 30 Dommages Feu",
    "statTags": [
      "pm",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetroux",
    "name": "Muldo Corail et Roux",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Roux"
    ],
    "stats": "1 PM, 30 Dommages Feu, 40 Tacle",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "muldo-corailetturquoise",
    "name": "Muldo Corail et Turquoise",
    "family": "muldo",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Muldo Corail",
      "Muldo Turquoise"
    ],
    "stats": "1 PM, 30 Dommages Feu, 40 Esquive PM",
    "statTags": [
      "pm"
    ],
    "img": "https://api.dofusdb.fr/img/items/97001.png"
  },
  {
    "id": "volk-ebene",
    "name": "Volkorne Ebène",
    "family": "volkorne",
    "generation": 1,
    "type": "pure",
    "stats": "90 Agilité, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97177.png"
  },
  {
    "id": "volk-indigo",
    "name": "Volkorne Indigo",
    "family": "volkorne",
    "generation": 1,
    "type": "pure",
    "stats": "90 Chance, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97176.png"
  },
  {
    "id": "volk-orchidee",
    "name": "Volkorne Orchidée",
    "family": "volkorne",
    "generation": 1,
    "type": "pure",
    "stats": "90 Intelligence, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97179.png"
  },
  {
    "id": "volk-pourpre",
    "name": "Volkorne Pourpre",
    "family": "volkorne",
    "generation": 1,
    "type": "pure",
    "stats": "90 Force, 1 PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97178.png"
  },
  {
    "id": "volk-indigoetebene",
    "name": "Volkorne Indigo et Ebène",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Indigo",
      "Volkorne Ebène"
    ],
    "stats": "70 Chance, 70 Agilité, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97196.png"
  },
  {
    "id": "volk-orchideeetebene",
    "name": "Volkorne Orchidée et Ebène",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Orchidée",
      "Volkorne Ebène"
    ],
    "stats": "70 Intelligence, 70 Agilité, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97195.png"
  },
  {
    "id": "volk-orchideeetindigo",
    "name": "Volkorne Orchidée et Indigo",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Orchidée",
      "Volkorne Indigo"
    ],
    "stats": "70 Intelligence, 70 Chance, 1 PA",
    "statTags": [
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97194.png"
  },
  {
    "id": "volk-pourpreetebene",
    "name": "Volkorne Pourpre et Ebène",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Pourpre",
      "Volkorne Ebène"
    ],
    "stats": "70 Force, 70 Agilité, 1 PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97193.png"
  },
  {
    "id": "volk-pourpreetindigo",
    "name": "Volkorne Pourpre et Indigo",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Pourpre",
      "Volkorne Indigo"
    ],
    "stats": "70 Force, 70 Chance, 1 PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97192.png"
  },
  {
    "id": "volk-pourpreetorchidee",
    "name": "Volkorne Pourpre et Orchidée",
    "family": "volkorne",
    "generation": 2,
    "type": "bicolore",
    "parents": [
      "Volkorne Pourpre",
      "Volkorne Orchidée"
    ],
    "stats": "70 Force, 70 Intelligence, 1 PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97191.png"
  },
  {
    "id": "volk-amande",
    "name": "Volkorne Amande",
    "family": "volkorne",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Volkorne Pourpre et Ebène",
      "Volkorne Orchidée et Ebène"
    ],
    "stats": "1 PA, 90 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97181.png"
  },
  {
    "id": "volk-roux",
    "name": "Volkorne Roux",
    "family": "volkorne",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Volkorne Pourpre et Orchidée",
      "Volkorne Pourpre et Indigo"
    ],
    "stats": "1 PA, 70 Dommages Poussée",
    "statTags": [
      "pa",
    ],
    "img": "https://api.dofusdb.fr/img/items/97180.png"
  },
  {
    "id": "volk-amandeetebene",
    "name": "Volkorne Amande et Ebène",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97200.png"
  },
  {
    "id": "volk-amandeetindigo",
    "name": "Volkorne Amande et Indigo",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97199.png"
  },
  {
    "id": "volk-amandeetivoire",
    "name": "Volkorne Amande et Ivoire",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 30 Retrait PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97202.png"
  },
  {
    "id": "volk-amandeetorchidee",
    "name": "Volkorne Amande et Orchidée",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97198.png"
  },
  {
    "id": "volk-amandeetpourpre",
    "name": "Volkorne Amande et Pourpre",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97197.png"
  },
  {
    "id": "volk-amandeetroux",
    "name": "Volkorne Amande et Roux",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 50 Dommages Poussée, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97201.png"
  },
  {
    "id": "volk-amandeetturquoise",
    "name": "Volkorne Amande et Turquoise",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Amande",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 30 Retrait PM, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97203.png"
  },
  {
    "id": "volk-ivoireetebene",
    "name": "Volkorne Ivoire et Ebène",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Ivoire",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 30 Retrait PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97213.png"
  },
  {
    "id": "volk-ivoireetindigo",
    "name": "Volkorne Ivoire et Indigo",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Ivoire",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 30 Retrait PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97212.png"
  },
  {
    "id": "volk-ivoireetorchidee",
    "name": "Volkorne Ivoire et Orchidée",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Ivoire",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 30 Retrait PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97211.png"
  },
  {
    "id": "volk-ivoireetpourpre",
    "name": "Volkorne Ivoire et Pourpre",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Ivoire",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 30 Retrait PA",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97210.png"
  },
  {
    "id": "volk-ivoireetturquoise",
    "name": "Volkorne Ivoire et Turquoise",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Ivoire",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 30 Retrait PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97214.png"
  },
  {
    "id": "volk-rouxetebene",
    "name": "Volkorne Roux et Ebène",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "stats",
    ],
    "img": "https://api.dofusdb.fr/img/items/97207.png"
  },
  {
    "id": "volk-rouxetindigo",
    "name": "Volkorne Roux et Indigo",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "stats",
    ],
    "img": "https://api.dofusdb.fr/img/items/97206.png"
  },
  {
    "id": "volk-rouxetivoire",
    "name": "Volkorne Roux et Ivoire",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 30 Retrait PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97208.png"
  },
  {
    "id": "volk-rouxetorchidee",
    "name": "Volkorne Roux et Orchidée",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "stats",
    ],
    "img": "https://api.dofusdb.fr/img/items/97205.png"
  },
  {
    "id": "volk-rouxetpourpre",
    "name": "Volkorne Roux et Pourpre",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97204.png"
  },
  {
    "id": "volk-rouxetturquoise",
    "name": "Volkorne Roux et Turquoise",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Roux",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 30 Retrait PM, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97209.png"
  },
  {
    "id": "volk-turquoiseetebene",
    "name": "Volkorne Turquoise et Ebène",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Turquoise",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97218.png"
  },
  {
    "id": "volk-turquoiseetindigo",
    "name": "Volkorne Turquoise et Indigo",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Turquoise",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97217.png"
  },
  {
    "id": "volk-turquoiseetorchidee",
    "name": "Volkorne Turquoise et Orchidée",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Turquoise",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97216.png"
  },
  {
    "id": "volk-turquoiseetpourpre",
    "name": "Volkorne Turquoise et Pourpre",
    "family": "volkorne",
    "generation": 4,
    "type": "bicolore",
    "parents": [
      "Volkorne Turquoise",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "stats",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97215.png"
  },
  {
    "id": "volk-ivoire",
    "name": "Volkorne Ivoire",
    "family": "volkorne",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Volkorne Pourpre et Indigo",
      "Volkorne Indigo et Ebène"
    ],
    "stats": "1 PA, 40 Retrait PA",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97182.png"
  },
  {
    "id": "volk-turquoise",
    "name": "Volkorne Turquoise",
    "family": "volkorne",
    "generation": 3,
    "type": "pure",
    "parents": [
      "Volkorne Pourpre et Orchidée",
      "Volkorne Orchidée et Ebène"
    ],
    "stats": "1 PA, 40 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97183.png"
  },
  {
    "id": "volk-emeraudeetamande",
    "name": "Volkorne Emeraude et Amande",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Amande"
    ],
    "stats": "7% Chance critique, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97230.png"
  },
  {
    "id": "volk-emeraudeetebene",
    "name": "Volkorne Emeraude et Ebène",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 7% Chance critique, 1 PA",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97229.png"
  },
  {
    "id": "volk-emeraudeetindigo",
    "name": "Volkorne Emeraude et Indigo",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 7% Chance critique, 1 PA",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97228.png"
  },
  {
    "id": "volk-emeraudeetivoire",
    "name": "Volkorne Emeraude et Ivoire",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Ivoire"
    ],
    "stats": "7% Chance critique, 1 PA, 30 Retrait PA",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97233.png"
  },
  {
    "id": "volk-emeraudeetorchidee",
    "name": "Volkorne Emeraude et Orchidée",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 7% Chance critique, 1 PA",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97227.png"
  },
  {
    "id": "volk-emeraudeetpourpre",
    "name": "Volkorne Emeraude et Pourpre",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 7% Chance critique, 1 PA",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97226.png"
  },
  {
    "id": "volk-emeraudeetroux",
    "name": "Volkorne Emeraude et Roux",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Roux"
    ],
    "stats": "7% Chance critique, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97231.png"
  },
  {
    "id": "volk-emeraudeetturquoise",
    "name": "Volkorne Emeraude et Turquoise",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Emeraude",
      "Volkorne Turquoise"
    ],
    "stats": "7% Chance critique, 1 PA, 30 Retrait PM",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97234.png"
  },
  {
    "id": "volk-pruneetamande",
    "name": "Volkorne Prune et Amande",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Amande"
    ],
    "stats": "1 PA, 45 Résistance critique, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97223.png"
  },
  {
    "id": "volk-pruneetebene",
    "name": "Volkorne Prune et Ebène",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97222.png"
  },
  {
    "id": "volk-pruneetemeraude",
    "name": "Volkorne Prune et Emeraude",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Emeraude"
    ],
    "stats": "7% Chance critique, 1 PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97225.png"
  },
  {
    "id": "volk-pruneetindigo",
    "name": "Volkorne Prune et Indigo",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97221.png"
  },
  {
    "id": "volk-pruneetivoire",
    "name": "Volkorne Prune et Ivoire",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 30 Retrait PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97288.png"
  },
  {
    "id": "volk-pruneetorchidee",
    "name": "Volkorne Prune et Orchidée",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97220.png"
  },
  {
    "id": "volk-pruneetpourpre",
    "name": "Volkorne Prune et Pourpre",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97219.png"
  },
  {
    "id": "volk-pruneetroux",
    "name": "Volkorne Prune et Roux",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 45 Résistance critique, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97287.png"
  },
  {
    "id": "volk-pruneetturquoise",
    "name": "Volkorne Prune et Turquoise",
    "family": "volkorne",
    "generation": 6,
    "type": "bicolore",
    "parents": [
      "Volkorne Prune",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 30 Retrait PM, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97224.png"
  },
  {
    "id": "volk-dore",
    "name": "Volkorne Doré",
    "family": "volkorne",
    "generation": 7,
    "type": "pure",
    "parents": [
      "Volkorne Prune et Pourpre",
      "Volkorne Emeraude et Roux"
    ],
    "stats": "250 Vitalité, 1 PA",
    "statTags": [
      "vita",
      "pa"
    ],
    "img": "https://api.dofusdb.fr/img/items/97186.png"
  },
  {
    "id": "volk-emeraude",
    "name": "Volkorne Emeraude",
    "family": "volkorne",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Volkorne Ivoire et Turquoise",
      "Volkorne Ivoire et Orchidée"
    ],
    "stats": "9% Chance critique, 1 PA",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97185.png"
  },
  {
    "id": "volk-prune",
    "name": "Volkorne Prune",
    "family": "volkorne",
    "generation": 5,
    "type": "pure",
    "parents": [
      "Volkorne Amande et Roux",
      "Volkorne Amande et Pourpre"
    ],
    "stats": "1 PA, 60 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97184.png"
  },
  {
    "id": "volk-doreetamande",
    "name": "Volkorne Doré et Amande",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Amande"
    ],
    "stats": "200 Vitalité, 1 PA, 70 Résistance Poussée",
    "statTags": [
      "vita",
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97292.png"
  },
  {
    "id": "volk-doreetebene",
    "name": "Volkorne Doré et Ebène",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Ebène"
    ],
    "stats": "200 Vitalité, 70 Agilité, 1 PA",
    "statTags": [
      "vita",
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97238.png"
  },
  {
    "id": "volk-doreetemeraude",
    "name": "Volkorne Doré et Emeraude",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Emeraude"
    ],
    "stats": "200 Vitalité, 7% Chance critique, 1 PA",
    "statTags": [
      "vita",
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97296.png"
  },
  {
    "id": "volk-doreetindigo",
    "name": "Volkorne Doré et Indigo",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Indigo"
    ],
    "stats": "200 Vitalité, 70 Chance, 1 PA",
    "statTags": [
      "vita",
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97237.png"
  },
  {
    "id": "volk-doreetivoire",
    "name": "Volkorne Doré et Ivoire",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Ivoire"
    ],
    "stats": "200 Vitalité, 1 PA, 30 Retrait PA",
    "statTags": [
      "vita",
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97293.png"
  },
  {
    "id": "volk-doreetorchidee",
    "name": "Volkorne Doré et Orchidée",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Orchidée"
    ],
    "stats": "200 Vitalité, 70 Intelligence, 1 PA",
    "statTags": [
      "vita",
      "pa",
      "stats"
    ],
    "img": "https://api.dofusdb.fr/img/items/97236.png"
  },
  {
    "id": "volk-doreetpourpre",
    "name": "Volkorne Doré et Pourpre",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Pourpre"
    ],
    "stats": "200 Vitalité, 70 Force, 1 PA",
    "statTags": [
      "vita",
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97235.png"
  },
  {
    "id": "volk-doreetprune",
    "name": "Volkorne Doré et Prune",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Prune"
    ],
    "stats": "200 Vitalité, 1 PA, 45 Résistance critique",
    "statTags": [
      "vita",
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97295.png"
  },
  {
    "id": "volk-doreetroux",
    "name": "Volkorne Doré et Roux",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Roux"
    ],
    "stats": "200 Vitalité, 1 PA, 50 Dommages Poussée",
    "statTags": [
      "vita",
      "pa",
    ],
    "img": "https://api.dofusdb.fr/img/items/97291.png"
  },
  {
    "id": "volk-doreetturquoise",
    "name": "Volkorne Doré et Turquoise",
    "family": "volkorne",
    "generation": 8,
    "type": "bicolore",
    "parents": [
      "Volkorne Doré",
      "Volkorne Turquoise"
    ],
    "stats": "200 Vitalité, 1 PA, 30 Retrait PM",
    "statTags": [
      "vita",
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97294.png"
  },
  {
    "id": "volk-amethyste",
    "name": "Volkorne Améthyste",
    "family": "volkorne",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Volkorne Doré et Ebène",
      "Volkorne Prune et Emeraude"
    ],
    "stats": "1 PA, 14% Résistance Air",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97190.png"
  },
  {
    "id": "volk-jade",
    "name": "Volkorne Jade",
    "family": "volkorne",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Volkorne Doré et Pourpre",
      "Volkorne Prune et Emeraude"
    ],
    "stats": "1 PA, 14% Résistance Terre",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97187.png"
  },
  {
    "id": "volk-rubis",
    "name": "Volkorne Rubis",
    "family": "volkorne",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Volkorne Doré et Orchidée",
      "Volkorne Prune et Emeraude"
    ],
    "stats": "1 PA, 14% Résistance Feu",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97188.png"
  },
  {
    "id": "volk-saphir",
    "name": "Volkorne Saphir",
    "family": "volkorne",
    "generation": 9,
    "type": "pure",
    "parents": [
      "Volkorne Doré et Indigo",
      "Volkorne Prune et Emeraude"
    ],
    "stats": "1 PA, 14% Résistance Eau",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97189.png"
  },
  {
    "id": "volk-amethysteetamande",
    "name": "Volkorne Améthyste et Amande",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Amande"
    ],
    "stats": "1 PA, 8% Résistance Air, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97280.png"
  },
  {
    "id": "volk-amethysteetdore",
    "name": "Volkorne Améthyste et Doré",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Doré"
    ],
    "stats": "200 Vitalité, 1 PA, 8% Résistance Air",
    "statTags": [
      "vita",
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97286.png"
  },
  {
    "id": "volk-amethysteetebene",
    "name": "Volkorne Améthyste et Ebène",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 8% Résistance Air",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97279.png"
  },
  {
    "id": "volk-amethysteetemeraude",
    "name": "Volkorne Améthyste et Emeraude",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Emeraude"
    ],
    "stats": "7% Chance critique, 1 PA, 8% Résistance Air",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97285.png"
  },
  {
    "id": "volk-amethysteetindigo",
    "name": "Volkorne Améthyste et Indigo",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 8% Résistance Air",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97278.png"
  },
  {
    "id": "volk-amethysteetivoire",
    "name": "Volkorne Améthyste et Ivoire",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 8% Résistance Air, 30 Retrait PA",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97282.png"
  },
  {
    "id": "volk-amethysteetorchidee",
    "name": "Volkorne Améthyste et Orchidée",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 8% Résistance Air",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97277.png"
  },
  {
    "id": "volk-amethysteetpourpre",
    "name": "Volkorne Améthyste et Pourpre",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 8% Résistance Air",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97276.png"
  },
  {
    "id": "volk-amethysteetprune",
    "name": "Volkorne Améthyste et Prune",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Prune"
    ],
    "stats": "1 PA, 8% Résistance Air, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97284.png"
  },
  {
    "id": "volk-amethysteetroux",
    "name": "Volkorne Améthyste et Roux",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 8% Résistance Air, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97281.png"
  },
  {
    "id": "volk-amethysteetturquoise",
    "name": "Volkorne Améthyste et Turquoise",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Améthyste",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 8% Résistance Air, 30 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97283.png"
  },
  {
    "id": "volk-jadeetamande",
    "name": "Volkorne Jade et Amande",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Amande"
    ],
    "stats": "1 PA, 8% Résistance Terre, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97243.png"
  },
  {
    "id": "volk-jadeetamethyste",
    "name": "Volkorne Jade et Améthyste",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Améthyste"
    ],
    "stats": "1 PA, 8% Résistance Terre, 8% Résistance Air",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97252.png"
  },
  {
    "id": "volk-jadeetdore",
    "name": "Volkorne Jade et Doré",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Doré"
    ],
    "stats": "200 Vitalité, 1 PA, 8% Résistance Terre",
    "statTags": [
      "vita",
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97249.png"
  },
  {
    "id": "volk-jadeetebene",
    "name": "Volkorne Jade et Ebène",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 8% Résistance Terre",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97242.png"
  },
  {
    "id": "volk-jadeetemeraude",
    "name": "Volkorne Jade et Emeraude",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Emeraude"
    ],
    "stats": "7% Chance critique, 1 PA, 8% Résistance Terre",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97248.png"
  },
  {
    "id": "volk-jadeetindigo",
    "name": "Volkorne Jade et Indigo",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 8% Résistance Terre",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97241.png"
  },
  {
    "id": "volk-jadeetivoire",
    "name": "Volkorne Jade et Ivoire",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 8% Résistance Terre, 30 Retrait PA",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97245.png"
  },
  {
    "id": "volk-jadeetorchidee",
    "name": "Volkorne Jade et Orchidée",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 8% Résistance Terre",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97240.png"
  },
  {
    "id": "volk-jadeetpourpre",
    "name": "Volkorne Jade et Pourpre",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 8% Résistance Terre",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97239.png"
  },
  {
    "id": "volk-jadeetprune",
    "name": "Volkorne Jade et Prune",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Prune"
    ],
    "stats": "1 PA, 8% Résistance Terre, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97247.png"
  },
  {
    "id": "volk-jadeetroux",
    "name": "Volkorne Jade et Roux",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 8% Résistance Terre, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97244.png"
  },
  {
    "id": "volk-jadeetrubis",
    "name": "Volkorne Jade et Rubis",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Rubis"
    ],
    "stats": "1 PA, 8% Résistance Terre, 8% Résistance Feu",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97250.png"
  },
  {
    "id": "volk-jadeetsaphir",
    "name": "Volkorne Jade et Saphir",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Saphir"
    ],
    "stats": "1 PA, 8% Résistance Terre, 8% Résistance Eau",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97251.png"
  },
  {
    "id": "volk-jadeetturquoise",
    "name": "Volkorne Jade et Turquoise",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Jade",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 8% Résistance Terre, 30 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97246.png"
  },
  {
    "id": "volk-rubisetamande",
    "name": "Volkorne Rubis et Amande",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Amande"
    ],
    "stats": "1 PA, 8% Résistance Feu, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97257.png"
  },
  {
    "id": "volk-rubisetamethyste",
    "name": "Volkorne Rubis et Améthyste",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Améthyste"
    ],
    "stats": "1 PA, 8% Résistance Feu, 8% Résistance Air",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97290.png"
  },
  {
    "id": "volk-rubisetdore",
    "name": "Volkorne Rubis et Doré",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Doré"
    ],
    "stats": "200 Vitalité, 1 PA, 8% Résistance Feu",
    "statTags": [
      "vita",
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97263.png"
  },
  {
    "id": "volk-rubisetebene",
    "name": "Volkorne Rubis et Ebène",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 8% Résistance Feu",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97256.png"
  },
  {
    "id": "volk-rubisetemeraude",
    "name": "Volkorne Rubis et Emeraude",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Emeraude"
    ],
    "stats": "7% Chance critique, 1 PA, 8% Résistance Feu",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97262.png"
  },
  {
    "id": "volk-rubisetindigo",
    "name": "Volkorne Rubis et Indigo",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 8% Résistance Feu",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97255.png"
  },
  {
    "id": "volk-rubisetivoire",
    "name": "Volkorne Rubis et Ivoire",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 8% Résistance Feu, 30 Retrait PA",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97259.png"
  },
  {
    "id": "volk-rubisetorchidee",
    "name": "Volkorne Rubis et Orchidée",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 8% Résistance Feu",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97254.png"
  },
  {
    "id": "volk-rubisetpourpre",
    "name": "Volkorne Rubis et Pourpre",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 8% Résistance Feu",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97253.png"
  },
  {
    "id": "volk-rubisetprune",
    "name": "Volkorne Rubis et Prune",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Prune"
    ],
    "stats": "1 PA, 8% Résistance Feu, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97261.png"
  },
  {
    "id": "volk-rubisetroux",
    "name": "Volkorne Rubis et Roux",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 8% Résistance Feu, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97258.png"
  },
  {
    "id": "volk-rubisetsaphir",
    "name": "Volkorne Rubis et Saphir",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Saphir"
    ],
    "stats": "1 PA, 8% Résistance Feu, 8% Résistance Eau",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97289.png"
  },
  {
    "id": "volk-rubisetturquoise",
    "name": "Volkorne Rubis et Turquoise",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Rubis",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 8% Résistance Feu, 30 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97260.png"
  },
  {
    "id": "volk-saphiretamande",
    "name": "Volkorne Saphir et Amande",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Amande"
    ],
    "stats": "1 PA, 8% Résistance Eau, 70 Résistance Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97268.png"
  },
  {
    "id": "volk-saphiretamethyste",
    "name": "Volkorne Saphir et Améthyste",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Améthyste"
    ],
    "stats": "1 PA, 8% Résistance Eau, 8% Résistance Air",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97275.png"
  },
  {
    "id": "volk-saphiretdore",
    "name": "Volkorne Saphir et Doré",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Doré"
    ],
    "stats": "200 Vitalité, 1 PA, 8% Résistance Eau",
    "statTags": [
      "vita",
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97274.png"
  },
  {
    "id": "volk-saphiretebene",
    "name": "Volkorne Saphir et Ebène",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Ebène"
    ],
    "stats": "70 Agilité, 1 PA, 8% Résistance Eau",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97267.png"
  },
  {
    "id": "volk-saphiretemeraude",
    "name": "Volkorne Saphir et Emeraude",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Emeraude"
    ],
    "stats": "7% Chance critique, 1 PA, 8% Résistance Eau",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97273.png"
  },
  {
    "id": "volk-saphiretindigo",
    "name": "Volkorne Saphir et Indigo",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Indigo"
    ],
    "stats": "70 Chance, 1 PA, 8% Résistance Eau",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97266.png"
  },
  {
    "id": "volk-saphiretivoire",
    "name": "Volkorne Saphir et Ivoire",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Ivoire"
    ],
    "stats": "1 PA, 8% Résistance Eau, 30 Retrait PA",
    "statTags": [
      "pa",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97270.png"
  },
  {
    "id": "volk-saphiretorchidee",
    "name": "Volkorne Saphir et Orchidée",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Orchidée"
    ],
    "stats": "70 Intelligence, 1 PA, 8% Résistance Eau",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97265.png"
  },
  {
    "id": "volk-saphiretpourpre",
    "name": "Volkorne Saphir et Pourpre",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Pourpre"
    ],
    "stats": "70 Force, 1 PA, 8% Résistance Eau",
    "statTags": [
      "pa",
      "stats",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97264.png"
  },
  {
    "id": "volk-saphiretprune",
    "name": "Volkorne Saphir et Prune",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Prune"
    ],
    "stats": "1 PA, 8% Résistance Eau, 45 Résistance critique",
    "statTags": [
      "pa",
      "cc",
      "res"
    ],
    "img": "https://api.dofusdb.fr/img/items/97272.png"
  },
  {
    "id": "volk-saphiretroux",
    "name": "Volkorne Saphir et Roux",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Roux"
    ],
    "stats": "1 PA, 8% Résistance Eau, 50 Dommages Poussée",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97269.png"
  },
  {
    "id": "volk-saphiretturquoise",
    "name": "Volkorne Saphir et Turquoise",
    "family": "volkorne",
    "generation": 10,
    "type": "bicolore",
    "parents": [
      "Volkorne Saphir",
      "Volkorne Turquoise"
    ],
    "stats": "1 PA, 8% Résistance Eau, 30 Retrait PM",
    "statTags": [
      "pa",
      "res",
    ],
    "img": "https://api.dofusdb.fr/img/items/97271.png"
  }
];
