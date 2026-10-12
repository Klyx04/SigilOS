import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasKnownGameCoords, resolveTileBank, findNearestMap, WORLDMAP_TILE_SIZE } from '@/lib/worldmap-tiles';

// Monde des Douze : 5 niveaux [1, 0.8, 0.6, 0.4, 0.2] mappés sur zooms 0..-4.
const DOUZE = [1, 0.8, 0.6, 0.4, 0.2];

describe('WORLDMAP_TILE_SIZE', () => {
    // Une banque compte `ceil(totalWidth*scale/250) × ceil(totalHeight*scale/250)`
    // fichiers. Mesure du 11/10/2026 sur les tuiles réellement servies : le compte
    // par banque vaut exactement ce produit, dans **tous** les mondes — en 256 px la
    // banque 0,8 du monde 1 vaudrait 32×25 = 800 (servi : 832) et la banque 1 du
    // monde 38 vaudrait 16×12 = 192 (servi : 204).
    const pyramid = (totalWidth: number, totalHeight: number, scales: number[]) =>
        scales.map((scale) => {
            const gridScale = parseFloat(scale.toFixed(4));
            const cols = Math.ceil((totalWidth * gridScale) / WORLDMAP_TILE_SIZE);
            const rows = Math.ceil((totalHeight * gridScale) / WORLDMAP_TILE_SIZE);
            return cols * rows;
        });

    it('reproduit la pyramide servie du monde 1 (10 000×8 000)', () => {
        expect(pyramid(10000, 8000, [1, 0.800000011920929, 0.6000000238418579, 0.4000000059604645, 0.20000000298023224]))
            .toEqual([1280, 832, 480, 208, 56]);
    });

    it('reproduit la pyramide servie des mondes 2 et 38 (pas d\'exception)', () => {
        expect(pyramid(4750, 3904, [1, 0.75, 0.5, 0.25])).toEqual([304, 180, 80, 20]);
        expect(pyramid(4085, 2861, [1, 0.75, 0.5, 0.25])).toEqual([204, 117, 54, 15]);
    });
});

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

describe('hasKnownGameCoords', () => {
    it('accepte toute position sauf le sentinelle (0, 0)', () => {
        expect(hasKnownGameCoords({ x: 5, y: -19 })).toBe(true);
        expect(hasKnownGameCoords({ x: 0, y: -3 })).toBe(true);
        expect(hasKnownGameCoords({ x: -3, y: 0 })).toBe(true);
        expect(hasKnownGameCoords({ x: 0, y: 0 })).toBe(false);
    });

    it('refuse les positions absentes ou non numériques (fail-closed)', () => {
        expect(hasKnownGameCoords(null)).toBe(false);
        expect(hasKnownGameCoords(undefined)).toBe(false);
        expect(hasKnownGameCoords({})).toBe(false);
        expect(hasKnownGameCoords({ x: 4 })).toBe(false);
        expect(hasKnownGameCoords({ x: null, y: 2 })).toBe(false);
        expect(hasKnownGameCoords({ x: NaN, y: 2 })).toBe(false);
    });

    it('(0, 0) est bien le tas des maps sans coordonnées du fichier réel', () => {
        const worldmap = JSON.parse(readFileSync('public/game-data/worldmap.json', 'utf8')) as {
            maps: Array<{ x: number; y: number; subAreaId?: number | null; worldMap: number }>;
        };
        const world1 = worldmap.maps.filter((m) => m.worldMap === 1 && m.x === 0 && m.y === 0);
        const subAreasAtZero = new Set(world1.map((m) => m.subAreaId));
        // 1 784 maps du monde 1 (mesure du 28/09/2026), réparties sur 270 de ses
        // 289 sous-zones : aucune coordonnée réelle ne peut l'être.
        expect(world1.length).toBeGreaterThan(1700);
        expect(subAreasAtZero.size).toBeGreaterThan(200);
        expect(world1.filter((m) => hasKnownGameCoords(m))).toHaveLength(0);
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
