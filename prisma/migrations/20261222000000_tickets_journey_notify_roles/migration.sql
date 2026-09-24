-- 🎫 Tickets v2 — rôles **mentionnés à l'ouverture** d'un ticket, par parcours.
--
-- Demande user : « une option permettant de ping tel rôle ou tel rôle quand un ticket
-- est créé ». Jusqu'ici le bot mentionnait **tous** les rôles staff de la catégorie, sans
-- choix possible ; `TicketTeam.notifyRoleIds` existait mais n'était lu par personne.
--
-- Migration **additive** : colonne avec défaut vide, aucune donnée touchée, aucun
-- renommage. Vide = on reprend les rôles de l'équipe du parcours (repli), jamais
-- `@everyone` par défaut. Garde `IF NOT EXISTS` de la convention du dépôt : rejouée à la
-- main sur une base partiellement à jour, elle ne casse pas.

ALTER TABLE "TicketJourney" ADD COLUMN IF NOT EXISTS "notifyRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
