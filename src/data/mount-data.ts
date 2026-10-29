// Fichier généré automatiquement — Base de données exhaustive des montures Dofus (Dragodindes, Muldos, Volkornes)
// Conforme Dofus 3 / Unity & DofusDB — 228 montures réelles en jeu (66 Dragodindes, 82 Muldos, 80 Volkornes)
// 🛡️ Souveraineté : les assets transitent par le proxy local /api/assets-dofus/items/

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
    "img": "/api/assets-dofus/items/97020"
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
    "img": "/api/assets-dofus/items/97018"
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
    "img": "/api/assets-dofus/items/97010"
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
    "img": "/api/assets-dofus/items/97038"
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
    "img": "/api/assets-dofus/items/97046"
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
    "img": "/api/assets-dofus/items/97033"
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
    "img": "/api/assets-dofus/items/97004"
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
    "img": "/api/assets-dofus/items/97017"
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
    "img": "/api/assets-dofus/items/97062"
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
    "img": "/api/assets-dofus/items/97012"
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
    "img": "/api/assets-dofus/items/97036"
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
    "img": "/api/assets-dofus/items/97034"
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
    "img": "/api/assets-dofus/items/97044"
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
    "img": "/api/assets-dofus/items/97042"
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
    "img": "/api/assets-dofus/items/97051"
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
    "img": "/api/assets-dofus/items/97019"
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
    "img": "/api/assets-dofus/items/97022"
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
    "img": "/api/assets-dofus/items/97071"
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
    "img": "/api/assets-dofus/items/97070"
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
    "img": "/api/assets-dofus/items/97041"
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
    "img": "/api/assets-dofus/items/97040"
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
    "img": "/api/assets-dofus/items/97049"
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
    "img": "/api/assets-dofus/items/97048"
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
    "img": "/api/assets-dofus/items/97065"
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
    "img": "/api/assets-dofus/items/97064"
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
    "img": "/api/assets-dofus/items/97054"
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
    "img": "/api/assets-dofus/items/97053"
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
    "img": "/api/assets-dofus/items/97076"
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
    "img": "/api/assets-dofus/items/97016"
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
    "img": "/api/assets-dofus/items/97015"
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
    "img": "/api/assets-dofus/items/97011"
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
    "img": "/api/assets-dofus/items/97069"
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
    "img": "/api/assets-dofus/items/97037"
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
    "img": "/api/assets-dofus/items/97039"
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
    "img": "/api/assets-dofus/items/97045"
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
    "img": "/api/assets-dofus/items/97047"
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
    "img": "/api/assets-dofus/items/97061"
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
    "img": "/api/assets-dofus/items/97063"
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
    "img": "/api/assets-dofus/items/97009"
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
    "img": "/api/assets-dofus/items/97052"
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
    "img": "/api/assets-dofus/items/97068"
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
    "img": "/api/assets-dofus/items/97073"
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
    "img": "/api/assets-dofus/items/97067"
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
    "img": "/api/assets-dofus/items/97072"
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
    "img": "/api/assets-dofus/items/97066"
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
    "img": "/api/assets-dofus/items/97021"
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
    "img": "/api/assets-dofus/items/97023"
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
    "img": "/api/assets-dofus/items/97057"
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
    "img": "/api/assets-dofus/items/97084"
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
    "img": "/api/assets-dofus/items/97035"
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
    "img": "/api/assets-dofus/items/97077"
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
    "img": "/api/assets-dofus/items/97043"
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
    "img": "/api/assets-dofus/items/97078"
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
    "img": "/api/assets-dofus/items/97055"
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
    "img": "/api/assets-dofus/items/97082"
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
    "img": "/api/assets-dofus/items/97050"
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
    "img": "/api/assets-dofus/items/97079"
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
    "img": "/api/assets-dofus/items/97060"
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
    "img": "/api/assets-dofus/items/97087"
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
    "img": "/api/assets-dofus/items/97059"
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
    "img": "/api/assets-dofus/items/97086"
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
    "img": "/api/assets-dofus/items/97056"
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
    "img": "/api/assets-dofus/items/97083"
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
    "img": "/api/assets-dofus/items/97058"
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
    "img": "/api/assets-dofus/items/97085"
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
    "img": "/api/assets-dofus/items/97080"
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
    "img": "/api/assets-dofus/items/97094"
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
    "img": "/api/assets-dofus/items/97091"
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
    "img": "/api/assets-dofus/items/97092"
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
    "img": "/api/assets-dofus/items/97090"
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
    "img": "/api/assets-dofus/items/97093"
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
    "img": "/api/assets-dofus/items/97110"
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
    "img": "/api/assets-dofus/items/97108"
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
    "img": "/api/assets-dofus/items/97105"
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
    "img": "/api/assets-dofus/items/97101"
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
    "img": "/api/assets-dofus/items/97109"
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
    "img": "/api/assets-dofus/items/97107"
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
    "img": "/api/assets-dofus/items/97103"
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
    "img": "/api/assets-dofus/items/97106"
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
    "img": "/api/assets-dofus/items/97102"
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
    "img": "/api/assets-dofus/items/97104"
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
    "img": "/api/assets-dofus/items/97096"
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
    "img": "/api/assets-dofus/items/97095"
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
    "img": "/api/assets-dofus/items/97121"
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
    "img": "/api/assets-dofus/items/97120"
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
    "img": "/api/assets-dofus/items/97119"
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
    "img": "/api/assets-dofus/items/97118"
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
    "img": "/api/assets-dofus/items/97117"
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
    "img": "/api/assets-dofus/items/97116"
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
    "img": "/api/assets-dofus/items/97115"
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
    "img": "/api/assets-dofus/items/97114"
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
    "img": "/api/assets-dofus/items/97113"
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
    "img": "/api/assets-dofus/items/97112"
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
    "img": "/api/assets-dofus/items/97111"
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
      "pm"
    ],
    "img": "/api/assets-dofus/items/97097"
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
    "img": "/api/assets-dofus/items/97098"
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
      "pm"
    ],
    "img": "/api/assets-dofus/items/97138"
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
      "puissance"
    ],
    "img": "/api/assets-dofus/items/97126"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97125"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97124"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97123"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97122"
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
      "pm"
    ],
    "img": "/api/assets-dofus/items/97127"
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
    "img": "/api/assets-dofus/items/97144"
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
    "img": "/api/assets-dofus/items/97145"
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
    "img": "/api/assets-dofus/items/97142"
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
    "img": "/api/assets-dofus/items/97141"
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
      "pm"
    ],
    "img": "/api/assets-dofus/items/97139"
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
    "img": "/api/assets-dofus/items/97165"
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
    "img": "/api/assets-dofus/items/97140"
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
    "img": "/api/assets-dofus/items/97143"
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
    "img": "/api/assets-dofus/items/97100"
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
    "img": "/api/assets-dofus/items/97099"
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
    "img": "/api/assets-dofus/items/97162"
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
    "img": "/api/assets-dofus/items/97160"
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
    "img": "/api/assets-dofus/items/97159"
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
    "img": "/api/assets-dofus/items/97158"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97163"
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
    "img": "/api/assets-dofus/items/97157"
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
    "img": "/api/assets-dofus/items/97156"
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
    "img": "/api/assets-dofus/items/97152"
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
    "img": "/api/assets-dofus/items/97150"
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
    "img": "/api/assets-dofus/items/97149"
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
    "img": "/api/assets-dofus/items/97155"
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
    "img": "/api/assets-dofus/items/97148"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97153"
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
    "img": "/api/assets-dofus/items/97147"
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
    "img": "/api/assets-dofus/items/97146"
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
    "img": "/api/assets-dofus/items/97151"
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
    "img": "/api/assets-dofus/items/97154"
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
    "img": "/api/assets-dofus/items/97161"
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
    "img": "/api/assets-dofus/items/97164"
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
    "img": "/api/assets-dofus/items/97300"
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
    "img": "/api/assets-dofus/items/97297"
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
    "img": "/api/assets-dofus/items/97299"
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
    "img": "/api/assets-dofus/items/97298"
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
    "img": "/api/assets-dofus/items/97314"
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
    "img": "/api/assets-dofus/items/97306"
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
    "img": "/api/assets-dofus/items/97313"
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
    "img": "/api/assets-dofus/items/97312"
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
    "img": "/api/assets-dofus/items/97301"
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
    "img": "/api/assets-dofus/items/97302"
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
    "img": "/api/assets-dofus/items/97303"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97308"
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
    "img": "/api/assets-dofus/items/97305"
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
    "img": "/api/assets-dofus/items/97304"
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
    "img": "/api/assets-dofus/items/97307"
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
    "img": "/api/assets-dofus/items/97309"
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
    "img": "/api/assets-dofus/items/97177"
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
    "img": "/api/assets-dofus/items/97176"
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
    "img": "/api/assets-dofus/items/97179"
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
    "img": "/api/assets-dofus/items/97178"
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
    "img": "/api/assets-dofus/items/97196"
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
    "img": "/api/assets-dofus/items/97195"
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
    "img": "/api/assets-dofus/items/97194"
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
    "img": "/api/assets-dofus/items/97193"
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
    "img": "/api/assets-dofus/items/97192"
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
    "img": "/api/assets-dofus/items/97191"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97181"
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
      "pa"
    ],
    "img": "/api/assets-dofus/items/97180"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97200"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97199"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97202"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97198"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97197"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97201"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97203"
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
    "img": "/api/assets-dofus/items/97213"
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
    "img": "/api/assets-dofus/items/97212"
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
    "img": "/api/assets-dofus/items/97211"
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
    "img": "/api/assets-dofus/items/97210"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97214"
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
      "stats"
    ],
    "img": "/api/assets-dofus/items/97207"
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
      "stats"
    ],
    "img": "/api/assets-dofus/items/97206"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97208"
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
      "stats"
    ],
    "img": "/api/assets-dofus/items/97205"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97204"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97209"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97218"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97217"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97216"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97215"
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
    "img": "/api/assets-dofus/items/97182"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97183"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97230"
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
    "img": "/api/assets-dofus/items/97229"
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
    "img": "/api/assets-dofus/items/97228"
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
    "img": "/api/assets-dofus/items/97233"
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
    "img": "/api/assets-dofus/items/97227"
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
    "img": "/api/assets-dofus/items/97226"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97231"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97234"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97223"
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
    "img": "/api/assets-dofus/items/97222"
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
    "img": "/api/assets-dofus/items/97225"
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
    "img": "/api/assets-dofus/items/97221"
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
    "img": "/api/assets-dofus/items/97288"
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
    "img": "/api/assets-dofus/items/97220"
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
    "img": "/api/assets-dofus/items/97219"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97287"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97224"
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
    "img": "/api/assets-dofus/items/97186"
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
    "img": "/api/assets-dofus/items/97185"
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
    "img": "/api/assets-dofus/items/97184"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97292"
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
    "img": "/api/assets-dofus/items/97238"
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
    "img": "/api/assets-dofus/items/97296"
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
    "img": "/api/assets-dofus/items/97237"
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
    "img": "/api/assets-dofus/items/97293"
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
    "img": "/api/assets-dofus/items/97236"
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
    "img": "/api/assets-dofus/items/97235"
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
    "img": "/api/assets-dofus/items/97295"
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
      "pa"
    ],
    "img": "/api/assets-dofus/items/97291"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97294"
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
    "img": "/api/assets-dofus/items/97190"
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
    "img": "/api/assets-dofus/items/97187"
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
    "img": "/api/assets-dofus/items/97188"
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
    "img": "/api/assets-dofus/items/97189"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97280"
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
    "img": "/api/assets-dofus/items/97286"
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
    "img": "/api/assets-dofus/items/97279"
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
    "img": "/api/assets-dofus/items/97285"
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
    "img": "/api/assets-dofus/items/97278"
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
    "img": "/api/assets-dofus/items/97282"
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
    "img": "/api/assets-dofus/items/97277"
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
    "img": "/api/assets-dofus/items/97276"
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
    "img": "/api/assets-dofus/items/97284"
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
      "res"
    ],
    "img": "/api/assets-dofus/items/97281"
  }
];
