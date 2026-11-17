import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { Navigation, TreePine } from "lucide-react";
import OptimizedGuideAdminClient from "./OptimizedGuideAdminClient";

export const metadata = {
  title: "GOD | Guides Optimisés — Éditeur",
  description: "Interface super-admin pour construire les guides optimisés Dofus",
};

export default async function DofusGuidesGodPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  // P2 — un sous-god avec la brique "game-data-guides" accède aussi (sinon super-admin).
  const isAdmin = await isSuperAdmin() || await canAccessBrick("game-data-guides");
  if (!isAdmin) redirect("/");

  const [guides, firstGuild] = await Promise.all([
    db.optimizedGuide.findMany({
      include: {
        milestones: {
          orderBy: { order: "asc" },
          include: {
            sequences: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Première guild active pour le bouton Preview
    db.guildConfig.findFirst({
      where: { isActive: true },
      select: { discordGuildId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const firstGuildId = firstGuild?.discordGuildId ?? null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success uppercase tracking-wide">
            <TreePine className="w-4 h-4" />
            <span>Éditeur Guide</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold text-foreground font-heading tracking-tighter leading-none">
            Guides Optimisés <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-success via-success to-success">
              Contrôle Total
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-medium">
            Importez les JSON Ganymède, éditez l'arbre visuellement, et suivez la progression des membres.
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-semibold text-success tabular-nums">{guides.length}</div>
            <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Guides</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-info tabular-nums">
              {guides.reduce((acc, g) => acc + g.milestones.length, 0)}
            </div>
            <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Milestones</div>
          </div>
        </div>
      </div>

      <div className="min-h-[600px]">
        <OptimizedGuideAdminClient initialGuides={guides as any} firstGuildId={firstGuildId} />
      </div>
    </div>
  );
}
