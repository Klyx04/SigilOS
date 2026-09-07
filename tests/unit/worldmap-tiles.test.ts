import { describe, it, expect } from 'vitest';
import { resolveTileBank, findNearestMap } from '@/lib/worldmap-tiles';

// Monde des Douze : 5 niveaux [1, 0.8, 0.6, 0.4, 0.2] mappés sur zooms 0..-4.
const DOUZE = [1, 0.8, 0.6, 0.4, 0.2];

describe('resolveTileBank', () => {
    it('mappe les zooms entiers vers la bonne banque', () => {
        expect(resolveTileBank(DOUZE, 0)).toEqual({ scale: 1, bank: '1' });
        expect(resolveTileBank(DOUZE, -1).bank).toBe('0.8');
        expect(resolveTileBank(DOUZE, -4).bank).toBe('0.2');
    });

    it('arrondit les zooms fractionnaires (zoomSnap 0.1) sans jeter', () => {
        // Avant : scales[2.3] === undefined → cleanScale(undefined) jetait →
        // tuile en erreur = carré noir qui clignote pendant le dézoom.
        expect(resolveTileBank(DOUZE, -2.3).bank).toBe('0.6');
        expect(resolveTileBank(DOUZE, -0.4).bank).toBe('1');
    });

    it('borne les zooms hors plage (fail-closed, ne jette jamais)', () => {
        expect(resolveTileBank(DOUZE, 2).bank).toBe('1');
        expect(resolveTileBank(DOUZE, -9).bank).toBe('0.2');
        expect(resolveTileBank([], -2)).toEqual({ scale: 1, bank: '1' });
    });
});

describe('findNearestMap', () => {
    const maps = new Map([
        ['0,0', { id: 1 }],
        ['3,3', { id: 2 }],
    ]);

    it('retourne la map exacte sans balayer', () => {
        expect(findNearestMap(maps, 0, 0, 5)).toEqual({ foundMap: { id: 1 }, gx: 0, gy: 0 });
    });

    it('snap dans le rayon demandé (le plus proche gagne)', () => {
        // Depuis (4,4), le périmètre r=1 contient (3,3) — pas (0,0) lointain.
        const r = findNearestMap(maps, 4, 4, 5);
        expect(r.foundMap).toEqual({ id: 2 });
        expect([r.gx, r.gy]).toEqual([3, 3]);
    });

    it('ne trouve rien hors rayon (pas de faux positif lointain)', () => {
        const r = findNearestMap(maps, 10, 10, 5);
        expect(r.foundMap).toBeUndefined();
    });
});
