---
description: Checklist du jour J Discord (16/11/2026) — obfuscation des salons, impact produit et vérifications
---

# 🗓️ Jour J Discord — 16/11/2026 (obfuscation des salons)

> **Pourquoi ce fichier existe.** La veille mensuelle (`src/lib/discord-veille.ts`, cron
> `discord-watch`) rappelait « préparer la checklist jour J (**plan maître §10.5**) ». Or ce plan
> maître n'existe plus dans le dépôt (mesure du 04/11/2026 : aucun fichier `*RESILIENCE-DISCORD*`,
> aucun dossier `refonte-long-terme-discord-compatibilite/`, aucune section `§10.5`). La veille
> citait donc un document introuvable. **Ce fichier est la checklist**, et c'est lui que la veille
> cite désormais. Garde : `tests/unit/discord-veille.test.ts` vérifie que ce chemin existe.

## Ce que Discord change

À partir du **16 novembre 2026**, un bot qui **ne peut pas voir** un salon (`VIEW_CHANNEL` absent)
reçoit des **métadonnées masquées** : le nom du salon n'est plus exploitable. Source :
`docs/plans/PLAN-SALONS-VOCAUX.md` §8.5.

## Impact produit — ce que ça change pour les guildes SigilOS

| Fonctionnalité | Ce qui peut casser | Cause |
|---|---|---|
| Logs de guilde | le **nom** du salon s'affiche `null` | le code lit `channel.name` |
| Notifications / annonces | envoi refusé **403** | le bot n'a plus `VIEW_CHANNEL` |
| Tickets | salon de destination invisible → création impossible | permission retirée |
| Salons vocaux (générateurs) | diagnostic « catégorie invisible » | `VIEW_CHANNEL` sur la catégorie parente |
| Marché / sondages / rôles d'ancienneté | annonce non publiée (403) | même cause |

**Ce n'est donc pas « le bot casse »** : c'est que les erreurs deviennent **muettes** (rafale de
403) ou **illisibles** (`null` à l'écran) si l'UI n'a pas de repli. D'où les deux règles :

1. **IDs only, jamais de noms** — on stocke `channelId`, on ne résout jamais par nom ;
2. **repli d'affichage** systématique — `name ?? "Salon masqué"`.

## Déjà fait (ne pas refaire)

PR #520 (`6e5a779a3`) : anti-obfuscation (`name` nullable, UI « Salon masqué »), signature Ed25519
unifiée, route webhook au format réel, fetch membres centralisés, invite sans `permissions=8`,
User-Agent, doc intents, fix CodeQL SSRF. Détail : `docs/CONTEXT.md` § PRIORITÉ #223.

## À faire AVANT le 16/11

- [ ] **Permissions** : pour chaque salon configuré en base (`GuildConfig` : logs, annonces, tickets,
      marché, sondages, vocaux), vérifier que le bot a `VIEW_CHANNEL` **et** `SEND_MESSAGES`. Se fier
      aux permissions **effectives** (`GET /guilds/{id}/channels` + membre `@me`), jamais à la seule
      présence du salon dans une réponse.
- [ ] **Aucune résolution par nom** : `grep -rn "channels.cache.find" src/` doit être vide ou justifié.
- [ ] **Replis d'affichage** : tout `channel.name` / `role.name` / `member.displayName` affiché porte un
      repli (« Salon masqué » ou équivalent).
- [ ] **Diagnostic 403** : un envoi refusé remonte un message explicite (« le bot ne voit pas ce
      salon »), jamais un échec silencieux.

## À vérifier LE JOUR J (16/11)

- [ ] Bot connecté (`GET /api/v10/gateway` répond, URL `wss://`).
- [ ] Une notification de test arrive dans le salon configuré.
- [ ] Création puis suppression d'un salon **privé** (tickets) : le bot y accède-t-il ?
- [ ] Logs : le nom d'un salon masqué s'affiche « Salon masqué », pas `null`.
- [ ] Aucune rafale de 403 — rappel : 401/403/429 comptent, **plus de 10 000 en 10 min** = restriction
      temporaire du bot.

## Après (J+1)

- [ ] Lancer la veille (`discord-watch`) : elle passe une fois en « Jour J atteint » **critique**, puis
      en `ok` si tout va bien.
- [ ] Consigner le résultat dans `docs/agents/activeContext.md`.

## Interdits (consignes de stabilité long terme)

- **Pas d'upgrade API v11 sans preuve changelog.**
- **Jamais** de nom comme clé de résolution — uniquement des IDs.
- Ne pas élargir les permissions du bot pour « contourner » l'obfuscation : un salon que le bot ne doit
  pas voir reste invisible, c'est le comportement voulu.
