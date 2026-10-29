// Fichier généré automatiquement — Base de données exhaustive des montures Dofus (Dragodindes, Muldos, Volkornes)
// Conforme Dofus 3 / Unity & DofusDB — 228 montures réelles en jeu (66 Dragodindes, 82 Muldos, 80 Volkornes)
// 🛡️ Souveraineté : chaque icône est un fichier local (public/images/guides/elevage/mounts/), aucun appel tiers à l'exécution.

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
    "img": "/images/guides/elevage/mounts/dd-amande.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doree.webp"
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
    "img": "/images/guides/elevage/mounts/dd-rousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetdoree.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebene.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigoetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetebene.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetebene.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-orchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pourpreetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-orchideeetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigoetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigoetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-orchideeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-turquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ivoireetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-turquoiseetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigoetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-indigoetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ivoireetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-turquoiseetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ivoireetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-turquoiseetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ivoireetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraude.webp"
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
    "img": "/images/guides/elevage/mounts/dd-prune.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetrousse.webp"
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
    "img": "/images/guides/elevage/mounts/dd-amandeetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetamande.webp"
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
    "img": "/images/guides/elevage/mounts/dd-doreeetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetdoree.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/dd-ebeneetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetebene.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/dd-emeraudeetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/dd-pruneetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-dore.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-orchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigoetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigoetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-orchideeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-amande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-roux.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigoetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-orchideeetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pourpreetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetdore.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoise.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-amandeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigoetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-orchideeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pourpreetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetdore.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetroux.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-emeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-prune.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-amandeetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-doreetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ebeneetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-indigoetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ivoireetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-orchideeetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pourpreetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetdore.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetroux.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-pruneetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-rouxetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-turquoiseetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-aiguemarine.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-azur.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-corail.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetaiguemarine.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetamande.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetazur.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetcorail.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetdore.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetebene.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetroux.webp"
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
    "img": "/images/guides/elevage/mounts/muldo-ambreetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-indigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-orchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-indigoetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-orchideeetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-orchideeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pourpreetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pourpreetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pourpreetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amande.webp"
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
    "img": "/images/guides/elevage/mounts/volk-roux.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetroux.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amandeetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoireetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoireetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoireetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoireetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoireetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rouxetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-turquoiseetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-turquoiseetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-turquoiseetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-turquoiseetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-ivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-turquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetamande.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetroux.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraudeetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetamande.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetroux.webp"
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
    "img": "/images/guides/elevage/mounts/volk-pruneetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-dore.webp"
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
    "img": "/images/guides/elevage/mounts/volk-emeraude.webp"
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
    "img": "/images/guides/elevage/mounts/volk-prune.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetamande.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetprune.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetroux.webp"
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
    "img": "/images/guides/elevage/mounts/volk-doreetturquoise.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethyste.webp"
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
    "img": "/images/guides/elevage/mounts/volk-jade.webp"
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
    "img": "/images/guides/elevage/mounts/volk-rubis.webp"
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
    "img": "/images/guides/elevage/mounts/volk-saphir.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetamande.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetdore.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetebene.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetemeraude.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetindigo.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetivoire.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetorchidee.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetpourpre.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetprune.webp"
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
    "img": "/images/guides/elevage/mounts/volk-amethysteetroux.webp"
  }
];
