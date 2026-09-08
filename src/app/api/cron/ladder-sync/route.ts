import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { recordCronExecution } from "@/lib/cron-telemetry";

// Wait function to avoid spamming the worker / Ankama
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function GET(req: Request) {
    try {
        const startedAt = Date.now();
        // CRIT-02 FIX — suppression du fallback ?token= (secret dans l'URL = fuite dans les logs)
        if (!verifyCronSecret(req)) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const workerUrl = process.env.DOFUS_LADDER_WORKER_URL;
        const workerSecret = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;

        if (!workerUrl) {
            return new NextResponse("Worker URL not configured", { status: 500 });
        }

        // 2. Fetch profiles that need updating
        // Cutoff time: older than 12 hours
        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
        
        // Let's process 5 members per run to be safe
        const profiles = await db.userProfile.findMany({
            where: {
                status: "ACTIVE",
                pseudoDofus: { not: null },
                OR: [
                    { lastLadderUpdate: null },
                    { lastLadderUpdate: { lt: cutoff } }
                ]
            },
            take: 5,
            orderBy: {
                lastLadderUpdate: 'asc'
            },
            select: { 
                id: true, 
                pseudoDofus: true, 
                guildId: true,
                guild: {
                    select: { dofusServerId: true }
                }
            }
        });

        if (profiles.length === 0) {
            await recordCronExecution("ladder_sync", { success: true, durationMs: Date.now() - startedAt, summary: "Aucun profil à synchroniser (0)", details: { batch: 0, success_count: 0, fail_count: 0 } });
            return NextResponse.json({ message: "No profiles to update.", count: 0 });
        }

        const results = [];

        // 3. Process each profile sequentially
        for (const profile of profiles) {
            const pseudo = profile.pseudoDofus as string;
            const serverId = profile.guild?.dofusServerId || "295"; // Default to Draconiros
            
            try {
                const headers: any = {};
                if (workerSecret) headers["X-SigilOS-Key"] = workerSecret;

                // --- FETCH SUCCES ---
                const succesRes = await fetch(`${workerUrl}?type=succes&server_id=${serverId}&name=${encodeURIComponent(pseudo)}`, { headers });
                const succesData = await succesRes.json();
                
                // Be gentle with the target server
                await delay(2000);

                // --- FETCH GENERAL ---
                const generalRes = await fetch(`${workerUrl}?type=general&server_id=${serverId}&name=${encodeURIComponent(pseudo)}`, { headers });
                const generalData = await generalRes.json();

                // Wait between members
                await delay(3000);

                // Check if we found them
                if (succesData.success || generalData.success) {
                    const updateData: any = {
                        lastLadderUpdate: new Date()
                    };

                    if (succesData.success && typeof succesData.points === 'number') {
                        updateData.successPoints = succesData.points;
                        if (succesData.level) updateData.dofusLevel = succesData.level;
                    }

                    if (generalData.success) {
                        if (generalData.level) updateData.dofusLevel = generalData.level;
                        if (generalData.totalXp) updateData.totalXp = BigInt(generalData.totalXp);
                        if (generalData.classe) updateData.classe = generalData.classe;
                    }

                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: updateData
                    });

                    results.push({ pseudo, success: true, points: succesData.points, level: generalData.level || succesData.level });
                } else {
                    // Character not found or API error.
                    // We still update the lastLadderUpdate so we don't infinitely retry them in the next 12h
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: { lastLadderUpdate: new Date() }
                    });
                    results.push({ pseudo, success: false, reason: "Not found on ladder" });
                }

            } catch (err) {
                console.error(`Error updating ladder for ${pseudo}:`, err);
                results.push({ pseudo, success: false, error: String(err) });
            }
        }

        const summary = `Synchronisation effectuée sur ${profiles.length} profils.\n- Réussis : ${results.filter(r => r.success).length}\n- Échecs : ${results.filter(r => !r.success).length}`;

        // SEND NOTIFICATION TO GOD DASHBOARD & DISCORD
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "Ladder General/Succès Sync",
            message: summary,
            type: "WORKER_SYNC",
            success: results.some(r => r.success) || profiles.length === 0, // Success if at least one worked or nothing to do
            metadata: { 
                batch_size: profiles.length,
                success_count: results.filter(r => r.success).length,
                fail_count: results.filter(r => !r.success).length
            }
        });

        await recordCronExecution("ladder_sync", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: `${profiles.length} profils traités (${results.filter(r => r.success).length} réussis, ${results.filter(r => !r.success).length} échecs)`,
            details: { batch: profiles.length, success_count: results.filter(r => r.success).length, fail_count: results.filter(r => !r.success).length },
        });

        return NextResponse.json({
            message: "Batch completed",
            count: profiles.length,
            results
        });

    } catch (error: any) {
        console.error("Cron Ladder Sync Error:", error);
        
        // Notify of fatal failure
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "CRITICAL: Ladder Sync Failed",
            message: `Erreur fatale dans le cron ladder sync : ${error.message || String(error)}`,
            type: "WORKER_SYNC",
            success: false,
            ping: true // Fatal failure should ping discord
        });

        await recordCronExecution("ladder_sync", {
            success: false,
            summary: `Échec de la sync ladder : ${error.message || String(error)}`,
            details: { error: String(error) },
        });

        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
