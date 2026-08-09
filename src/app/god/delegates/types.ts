// Types partagés du module God / delegues.
export interface BrickGrantView {
    id: string;
    delegateId: string;
    userId: string;
    brickId: string;
    guildId: string | null;
    startAt: string;
    expiresAt: string | null;
    grantedBy: string;
    reason: string | null;
    revokedAt: string | null;
    createdAt: string;
}
