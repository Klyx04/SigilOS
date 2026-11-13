import { describe, it, expect } from 'vitest';
import {
    getAllOfficialMissions,
    searchOfficialGuildMissions,
    getOfficialMissionById,
    mapOfficialToDraftMission,
} from '@/lib/game-data/guild-missions-catalog';

describe('Guild Missions Official Catalog', () => {
    it('charge le catalogue complet (468 missions)', () => {
        const missions = getAllOfficialMissions();
        expect(missions.length).toBe(468);
    });

    it('trouve des missions par recherche textuelle (Baleine, Solar, Miséreux)', () => {
        const baleine = searchOfficialGuildMissions({ query: 'Ventre de la Baleine' });
        expect(baleine.length).toBeGreaterThan(0);
        expect(baleine[0].title).toBe('Ventre de la Baleine');
        expect(baleine[0].category).toBe('DONJON');
        expect(baleine[0].rank).toBe(5);

        const solar = searchOfficialGuildMissions({ query: 'Expédition de Solar' });
        expect(solar.length).toBeGreaterThan(0);
        expect(solar[0].monsterId).toBe(5100);

        const misereux = searchOfficialGuildMissions({ query: 'Régulation des Miséreux' });
        expect(misereux.length).toBeGreaterThan(0);
        expect(misereux[0].category).toBe('REGULATION');
    });

    it('trouve les missions événementielles (Spéciales)', () => {
        const nowel = searchOfficialGuildMissions({ isSpecial: true, contextPreset: 'NOWEL' });
        expect(nowel.length).toBeGreaterThan(0);
        expect(nowel.some(m => m.title.includes('Nowel'))).toBe(true);

        const vulkania = searchOfficialGuildMissions({ isSpecial: true, contextPreset: 'VULKANIA' });
        expect(vulkania.length).toBeGreaterThan(0);
        expect(vulkania.some(m => m.title.includes('Grozilla'))).toBe(true);
    });

    it('mappe fidèlement une mission officielle vers le draft de l’éditeur', () => {
        const mission = getOfficialMissionById(366); // Ventre de la Baleine
        expect(mission).toBeDefined();
        if (mission) {
            const draft = mapOfficialToDraftMission(mission);
            expect(draft.title).toBe('Ventre de la Baleine');
            expect(draft.category).toBe('DONJON');
            expect(draft.rank).toBe(5);
            expect(draft.xpReward).toBe(900);
            expect(draft.guildatonsReward).toBe(80);
            expect(draft.payload.officialMissionId).toBe(366);
            expect(draft.payload.bossName).toBe('Protozorreur');
        }
    });
});
