import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/utils";

/**
 * `/llms.txt` — fiche d'identité du site pour les agents qui la lisent.
 *
 * ⚠️ `llms.txt` est une **proposition** (Jeremy Howard / Answer.AI, 2024), pas un standard :
 * aucun grand fournisseur d'IA ne s'est engagé à la consommer. Le fichier est donc écrit
 * comme une fiche **factuelle** — pas comme un argumentaire ; un modèle n'exécute aucune
 * instruction lue dans un fichier, et un fichier qui survend fait citer du contenu inexistant.
 *
 * Règles de rédaction (21/09/2026) :
 *   1. SOURCE UNIQUE — il n'y a plus de `public/llms.txt` : ce fichier statique l'emportait
 *      sur cette route et figeait des URLs de PRODUCTION jusque sur la bêta ;
 *   2. les URLs sont générées par `getAppBaseUrl()` (bêta ou prod selon l'environnement) ;
 *   3. on ne décrit que ce qui existe réellement (pas de catalogue de guides non publiés).
 *
 * Le nom du dossier (`llms.txt/`) est volontaire : un segment statique contenant un point
 * sert exactement le chemin `/llms.txt` (même mécanique que `app/robots.txt/route.ts`).
 */
export const dynamic = "force-static";
export const revalidate = 86400; // 24h cache

export async function GET() {
  const baseUrl = getAppBaseUrl();
  // Date du fichier servi (build puis rafraîchissement toutes les 24 h) — pas une promesse.
  const updatedAt = new Date().toISOString().slice(0, 10);

  const content = `# SigilOS

> Tableau de bord web + bot Discord pour les guildes de Dofus (Unity). Gratuit, sans publicité.
> Connexion Discord uniquement : aucun mot de passe de jeu, aucun jeton Ankama demandé.

- Site : ${baseUrl}
- Guides publics : ${baseUrl}/guides
- Guide Rush Sylvestre (quêtes, trajets, overlay) : ${baseUrl}/guides/rush-sylvestre
- Fiches de boss & donjons : ${baseUrl}/boss
- Almanax du jour : ${baseUrl}/almanax
- Carte du monde : ${baseUrl}/carte-du-monde
- Modules : ${baseUrl}/modules
- FAQ : ${baseUrl}/legal/faq
- Plan du site (toutes les URL publiques) : ${baseUrl}/sitemap.xml

## Ce que le site propose

- **Overlay en jeu** : mini-fenêtre toujours au premier plan au-dessus du client Dofus —
  étapes de quête, coordonnée copiée en un clic sous la forme \`/w x,y\`, ressources à prévoir.
  Utilisable sans compte : la progression reste alors dans le navigateur.
- **Guides étape par étape** : le Rush du Dofus Sylvestre (quêtes ordonnées, trajets,
  prérequis, objets à prévoir) et les guides publiés (forgemagie, élevage, brisage).
- **Fiches de boss et de donjons** : sorts, portées, résistances.
- **Almanax** : offrande du jour et prévisions des jours suivants.
- **Quête du Dofus Ocre** : le joueur lie son compte Metamob avec sa propre clé API
  (lecture seule) pour suivre les archimonstres et les pierres d'âme qu'il lui reste.

## Réservé aux membres d'une guilde activée (connexion Discord)

- Progression d'un guide partagée entre membres : sur quelle quête chacun est, repères,
  « qui peut aider » (métier, donjon, alignement).
- Sorties de guilde, missions internes, suivi des membres, statistiques, bot Discord.

## À savoir

- Aucun mot de passe Ankama, ni adresse e-mail, ni jeton de jeu n'est demandé ou conservé.
- Les données publiées (pseudo de personnage, progression) le sont par choix du joueur.
- Le site est en bêta : une partie des pages est réservée aux membres d'une guilde activée.

---
Dernière mise à jour : ${updatedAt}
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
