import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContributionLadder } from '@/server/actions/ladder-actions';
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
            findMany: vi.fn()
        }
    }
}));

describe('getContributionLadder', () => {
    const mockGuildId = 'test-guild-123';
    const mockUserId = 'user-123';
    const mockGuildConfigId = 'guild-config-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error if user is not authenticated', async () => {
        vi.mocked(auth).mockResolvedValue(null as any);

        const result = await getContributionLadder(mockGuildId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Non authentifié');
    });

    it('should return error if guild config is not found', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue(null);

        const result = await getContributionLadder(mockGuildId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Guilde non trouvée');
    });

    it('should return empty array when no contribution points exist', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: mockGuildConfigId,
            rolesMapping: {}
        } as any);

        vi.mocked(db.userProfile.findFirst).mockResolvedValue({
            id: 'profile-1'
        } as any);

        vi.mocked(db.userProfile.findMany).mockResolvedValue([]);

        const result = await getContributionLadder(mockGuildId);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
    });

    it('should return correct ranking (descending by contribution points)', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: mockGuildConfigId,
            rolesMapping: {}
        } as any);

        vi.mocked(db.userProfile.findFirst).mockResolvedValue({
            id: 'profile-1'
        } as any);

        const mockProfiles = [
            {
                id: 'profile-1',
                discordNickname: 'Alice',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-01-01'),
                pseudoDofus: 'AliceDofus',
                classe: 'Iop',
                contributionPoints: 100,
                user: { image: 'alice.jpg' }
            },
            {
                id: 'profile-2',
                discordNickname: 'Bob',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-02-01'),
                pseudoDofus: 'BobDofus',
                classe: 'Cra',
                contributionPoints: 50,
                user: { image: 'bob.jpg' }
            }
        ];

        vi.mocked(db.userProfile.findMany).mockResolvedValue(mockProfiles as any);

        const result = await getContributionLadder(mockGuildId);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].rank).toBe(1);
        expect(result.data![0].value).toBe(100);
        expect(result.data![0].discordNickname).toBe('Alice');
        expect(result.data![1].rank).toBe(2);
        expect(result.data![1].value).toBe(50);
        expect(result.data![1].discordNickname).toBe('Bob');
    });

    it('should apply tie-breaker correctly (older member wins)', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: mockGuildConfigId,
            rolesMapping: {}
        } as any);

        vi.mocked(db.userProfile.findFirst).mockResolvedValue(null);

        const mockProfiles = [
            {
                id: 'profile-1',
                discordNickname: 'OlderMember',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2023-01-01'), // Older
                pseudoDofus: 'Older',
                classe: 'Iop',
                contributionPoints: 50,
                user: { image: 'older.jpg' }
            },
            {
                id: 'profile-2',
                discordNickname: 'NewerMember',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-01-01'), // Newer
                pseudoDofus: 'Newer',
                classe: 'Cra',
                contributionPoints: 50,
                user: { image: 'newer.jpg' }
            }
        ];

        vi.mocked(db.userProfile.findMany).mockResolvedValue(mockProfiles as any);

        const result = await getContributionLadder(mockGuildId);

        expect(result.success).toBe(true);
        expect(result.data![0].discordNickname).toBe('OlderMember');
        expect(result.data![1].discordNickname).toBe('NewerMember');
    });

    it('should filter only ACTIVE profiles', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: mockGuildConfigId,
            rolesMapping: {}
        } as any);

        vi.mocked(db.userProfile.findFirst).mockResolvedValue(null);

        // Mock implementation should only return ACTIVE profiles with contributionPoints > 0
        const mockProfiles = [
            {
                id: 'profile-1',
                discordNickname: 'ActiveUser',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-01-01'),
                pseudoDofus: 'Active',
                classe: 'Iop',
                contributionPoints: 50,
                user: { image: 'active.jpg' }
            }
        ];

        vi.mocked(db.userProfile.findMany).mockResolvedValue(mockProfiles as any);

        const result = await getContributionLadder(mockGuildId);

        expect(db.userProfile.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: 'ACTIVE',
                    contributionPoints: { gt: 0 }
                })
            })
        );
    });

    it('should mark current user correctly', async () => {
        vi.mocked(auth).mockResolvedValue({
            user: { id: mockUserId }
        } as any);

        vi.mocked(db.guildConfig.findUnique).mockResolvedValue({
            id: mockGuildConfigId,
            rolesMapping: {}
        } as any);

        vi.mocked(db.userProfile.findFirst).mockResolvedValue({
            id: 'profile-1'
        } as any);

        const mockProfiles = [
            {
                id: 'profile-1',
                discordNickname: 'CurrentUser',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-01-01'),
                pseudoDofus: 'Current',
                classe: 'Iop',
                contributionPoints: 100,
                user: { image: 'current.jpg' }
            },
            {
                id: 'profile-2',
                discordNickname: 'OtherUser',
                discordRoleColor: null,
                discordRoleName: null,
                discordJoinedAt: new Date('2024-02-01'),
                pseudoDofus: 'Other',
                classe: 'Cra',
                contributionPoints: 50,
                user: { image: 'other.jpg' }
            }
        ];

        vi.mocked(db.userProfile.findMany).mockResolvedValue(mockProfiles as any);

        const result = await getContributionLadder(mockGuildId);

        expect(result.data![0].isCurrentUser).toBe(true);
        expect(result.data![1].isCurrentUser).toBe(false);
    });
});
