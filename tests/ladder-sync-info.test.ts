import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLadderSyncInfo, getSuccessLadder } from '@/server/actions/ladder-actions';
import { auth } from '@/auth';
import { db } from '@/lib/prisma';

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
            findMany: vi.fn(),
            count: vi.fn(),
            aggregate: vi.fn()
        }
    }
}));

describe('getLadderSyncInfo', () => {
    const mockGuildId = 'sync-info-guild';
    const mockUserId = 'user-sync-info';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error if user is not authenticated', async () => {
        vi.mocked(auth).mockResolvedValue(null as any);

        const result = await getLadderSyncInfo(mockGuildId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Non authentifié');
    });

    it('should return last sync date and coverage', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as any);
        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({ id: 'gc-1' } as any);
        vi.mocked(db.userProfile.aggregate).mockResolvedValue({
            _max: { lastLadderUpdate: new Date('2026-10-01T14:03:00.000Z') },
            _count: { _all: 120 }
        } as any);
        vi.mocked(db.userProfile.count).mockResolvedValue(118 as any);

        const result = await getLadderSyncInfo(mockGuildId);

        expect(result.success).toBe(true);
        expect(result.data?.lastSyncAt).toBe('2026-10-01T14:03:00.000Z');
        expect(result.data?.syncedCount).toBe(118);
        expect(result.data?.totalCount).toBe(120);
    });

    it('should return null date when never synced', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as any);
        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({ id: 'gc-1' } as any);
        vi.mocked(db.userProfile.aggregate).mockResolvedValue({
            _max: { lastLadderUpdate: null },
            _count: { _all: 2 }
        } as any);
        vi.mocked(db.userProfile.count).mockResolvedValue(0 as any);

        const result = await getLadderSyncInfo(mockGuildId);

        expect(result.success).toBe(true);
        expect(result.data?.lastSyncAt).toBeNull();
        expect(result.data?.syncedCount).toBe(0);
    });
});

describe('getSuccessLadder search (server-side)', () => {
    const mockGuildId = 'success-search-guild';

    const mockProfiles = (overrides: any[] = []) => [
        { id: 'p1', discordNickname: 'Raizow', discordRoleColor: null, discordRoleName: null, discordJoinedAt: new Date(), pseudoDofus: 'Twoda-Jr', classe: 'Cra', successPoints: 5000, vacationStart: null, vacationEnd: null, user: { image: null } },
        { id: 'p2', discordNickname: 'Élève dissipé', discordRoleColor: null, discordRoleName: null, discordJoinedAt: new Date(), pseudoDofus: null, classe: null, successPoints: 100, vacationStart: null, vacationEnd: null, user: { image: null } },
        ...overrides
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({ id: 'gc-9', rolesMapping: {} } as any);
        vi.mocked(db.userProfile.findFirst).mockResolvedValue(null);
        vi.mocked(db.userProfile.findMany).mockResolvedValue(mockProfiles() as any);
    });

    it('should filter across all members and adjust totalCount', async () => {
        const result = await getSuccessLadder(mockGuildId, 1, 25, 'twoda jr');

        expect(result.success).toBe(true);
        expect(result.data?.entries).toHaveLength(1);
        expect(result.data?.entries[0].pseudoDofus).toBe('Twoda-Jr');
        expect(result.data?.totalCount).toBe(1);
        expect(result.data?.totalPages).toBe(1);
    });

    it('should match accents without accents', async () => {
        const result = await getSuccessLadder(mockGuildId, 1, 25, 'eleve');

        expect(result.success).toBe(true);
        expect(result.data?.entries).toHaveLength(1);
        expect(result.data?.entries[0].discordNickname).toBe('Élève dissipé');
    });

    it('should return everything on empty search', async () => {
        const result = await getSuccessLadder(mockGuildId, 1, 25, '');

        expect(result.success).toBe(true);
        expect(result.data?.totalCount).toBe(2);
    });
});
