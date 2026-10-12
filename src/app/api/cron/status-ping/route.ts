import { NextResponse } from 'next/server';
import { sendGlobalStatusPingCore } from '@/server/status-ping-core';
import { verifyCronSecret } from "@/lib/cron-auth";
import { recordCronExecution } from "@/lib/cron-telemetry";

export async function GET(req: Request) {
    // CRIT-02 FIX — avant le bug : si CRON_SECRET=undefined,
    // "Bearer undefined" ne correspondait à aucun header réel →
    // tout le monde était autorisé car on tombait dans le fallback ?key=undefined
    // qui lui aussi ne matche jamais → la route était OUVERTE sans secret configuré.
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const result = await sendGlobalStatusPingCore({ source: "cron:status-ping" });

        // La passe a tourné mais le MIROIR Discord n'est pas parti (salon en pause
        // d'écriture, bot sans accès) : ce n'est PAS une panne de la plateforme. On
        // répond 200 — cette route sert de sonde de disponibilité (UptimeRobot la sonde
        // en HEAD) : un 500 ferait crier « site down » pour un salon Discord mal
        // configuré. La télémétrie God, elle, le signale bien en échec.
        if (result.success && result.delivered === false) {
            await recordCronExecution("status_ping", {
                success: false,
                summary: result.warning ?? "Miroir Discord non envoyé",
                details: result.stats ?? {},
            });
            return NextResponse.json({
                success: true,
                delivered: false,
                warning: result.warning,
                stats: result.stats,
            });
        }

        if (!result.success) {
            await recordCronExecution("status_ping", {
                success: false,
                summary: "Échec du ping statut global",
                details: { error: result.error },
            });
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        await recordCronExecution("status_ping", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: "Systèmes nominaux",
            details: result.stats ?? {},
        });

        return NextResponse.json({ 
            success: true, 
            status: 'Systems Nominal',
            stats: result.stats 
        });
    } catch (e: any) {
        console.error('[CRON Status Ping] Fatal Error:', e);
        await recordCronExecution("status_ping", {
            success: false,
            summary: "Échec fatal du ping statut global",
            details: { error: e.message || String(e) },
        });
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

// UptimeRobot utilise souvent des requêtes HEAD par défaut pour le monitoring.
// En autorisant HEAD et en le redirigeant vers GET, le CRON s'activera correctement.
export async function HEAD(req: Request) {
    return GET(req);
}
