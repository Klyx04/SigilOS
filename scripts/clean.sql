DELETE FROM "DofusQuestChain" WHERE "dofusItemId" IN (SELECT id FROM "DofusItem" WHERE slug IN ('tachete', 'argente-scint', 'argent-scint', 'argente-scintillant'));
