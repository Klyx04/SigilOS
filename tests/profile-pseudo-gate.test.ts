import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserProfile } from '@/server/actions/profile-actions';
import { auth } from '@/auth';
import { db } from '@/lib/prisma';
import { getUserContext } from '@/server/actions/user-actions';

// Mock auth
vi.mock('@/auth', () => ({
    auth: vi.fn()
}));

// Mock db
vi.mock('@/lib/prisma', () => ({
    db: {
        guildConfig: {
            findUnique: vi.fn()
        },
        userProfile: {
            findFirst: vi.fn(),
            upsert: vi.fn()
        },
        platformConfig: {
            findUnique: vi.fn()
        }
    }
}));

// Mock user-actions (contexte + invalidation cache)
vi.mock('@/server/actions/user-actions', () => ({
    getUserContext: vi.fn(),
    checkGuildPermission: vi.fn(),
    invalidateUserContextCache: vi.fn()
}));

// Mock next/cache (revalidatePath hors requête)
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn()
}));

describe('updateUserProfile — gate pseudo ladder + fallback God', () => {
    const guildId = 'gate-guild';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DOFUS_LADDER_WORKER_URL', 'https://ladder.test');
        vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            isMember: true,
            isSuperAdmin: false
        } as any);
        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: 'gc-1',
            discordGuildId: guildId,
            rolesMapping: {},
            missionNotifyChannelId: null,
            missionValidationNotifyRoleId: null,
            dofusServerId: '295',
            dofusServerName: null
        } as any);
        vi.mocked(db.userProfile.findFirst).mockResolvedValue(null); // pseudo libre
        vi.mocked(db.userProfile.upsert).mockResolvedValue({ id: 'p1' } as any);
        vi.mocked(db.platformConfig.findUnique).mockResolvedValue({ ladderManualFallback: false } as any);
    });

    // checkPseudo (type=general) puis snapshot (succes + general)
    const mockLadderFound = (points = 13324, totalXp = '9010295762') => {
        vi.stubGlobal('fetch', vi.fn(async (url: any) => {
            const u = String(url);
            if (u.includes('type=general')) {
                return { ok: true, json: async () => ({ success: true, found: true, totalXp, level: 52, classe: 'Cra' }) };
            }
            return { ok: true, json: async () => ({ success: true, found: true, points, level: 52 }) };
        }) as any);
    };

    const mockLadderNotFound = () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true, json: async () => ({ success: false, found: false })
        })) as any);
    };

    it('pseudo sur le ladder → succès + snapshot importé (points/XP/niveau)', async () => {
        mockLadderFound();

        const res = await updateUserProfile({ guildId, pseudoDofus: 'Darkfeudala' });

        expect(res.success).toBe(true);
        const upsertArg = vi.mocked(db.userProfile.upsert).mock.calls[0][0] as any;
        expect(upsertArg.update.pseudoDofus).toBe('Darkfeudala');
        expect(upsertArg.update.successPoints).toBe(13324);
        expect(upsertArg.update.totalXp).toBe(BigInt('9010295762'));
        expect(upsertArg.update.dofusLevel).toBe(52);
        expect(upsertArg.update.lastLadderUpdate).toBeInstanceOf(Date);
    });

    it('pseudo absent + fallback OFF → refus, rien écrit', async () => {
        mockLadderNotFound();

        const res = await updateUserProfile({ guildId, pseudoDofus: 'Sfqcsqvc' });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/introuvable/);
        expect(db.userProfile.upsert).not.toHaveBeenCalled();
    });

    it('pseudo absent + fallback God ON → accepté (saisie manuelle assumée)', async () => {
        mockLadderNotFound();
        vi.mocked(db.platformConfig.findUnique).mockResolvedValue({ ladderManualFallback: true } as any);

        const res = await updateUserProfile({ guildId, pseudoDofus: 'Pseudo-Manuel' });

        expect(res.success).toBe(true);
        const upsertArg = vi.mocked(db.userProfile.upsert).mock.calls[0][0] as any;
        expect(upsertArg.update.pseudoDofus).toBe('Pseudo-Manuel');
        // Pas de données ladder inventées
        expect(upsertArg.update.successPoints).toBeUndefined();
        expect(upsertArg.update.totalXp).toBeUndefined();
    });

    it('classe explicite prioritaire sur la classe ladder', async () => {
        mockLadderFound();

        const res = await updateUserProfile({ guildId, pseudoDofus: 'Darkfeudala', classe: 'sram' });

        expect(res.success).toBe(true);
        const upsertArg = vi.mocked(db.userProfile.upsert).mock.calls[0][0] as any;
        expect(upsertArg.update.classe).toBe('sram');
    });
});
