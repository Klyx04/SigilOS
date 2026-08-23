-- Enable 'quests' module for all guilds that don't have it yet
UPDATE "GuildModules"
SET quests = true
WHERE quests = false OR quests IS NULL;

-- Check result
SELECT id, quests FROM "GuildModules" LIMIT 5;
