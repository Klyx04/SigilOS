"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportGameData, importGameData, exportGameDataToGit } from "@/server/actions/game-data-admin-actions";

export default function DataExportImport() {
    const [exporting, setExporting] = useState(false);
    const [exportingGit, setExportingGit] = useState(false);
    const [importing, setImporting] = useState(false);

    async function handleExport() {
        setExporting(true);
        const result = await exportGameData();

        if (result.success && result.data) {
            const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `game-data-backup-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export réussi");
        } else {
            toast.error(result.error || "Erreur d'export");
        }

        setExporting(false);
    }

    async function handleExportToGit() {
        setExportingGit(true);
        const result = await exportGameDataToGit();

        if (result.success) {
            toast.success(result.data || "Export Git réussi", { duration: 5000 });
        } else {
            toast.error(result.error || "Erreur d'export Git");
        }

        setExportingGit(false);
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);

        try {
            const text = await file.text();
            const result = await importGameData(text);

            if (result.success) {
                toast.success(result.data || "Import réussi");
            } else {
                toast.error(result.error || "Erreur d'import");
            }
        } catch {
            toast.error("Fichier invalide");
        }

        setImporting(false);
        e.target.value = "";
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-info/20 to-info/20 p-6 rounded-lg border border-info/30 space-y-2">
                <h3 className="text-lg font-semibold text-foreground mb-2">📦 Export / Import des données de jeu</h3>
                <p className="text-sm text-foreground">
                    <strong className="text-foreground">À quoi ça sert :</strong> synchroniser <strong>à la main</strong> les données de
                    jeu entre environnements (local → beta → prod), quand on ne passe pas par le siphon DofusDB. C'est un outil de
                    <strong className="text-foreground"> sauvegarde / migration</strong>, pas une source de données quotidienne.
                </p>
                <p className="text-sm text-muted-foreground">
                    ✅ Couvre <strong className="text-foreground">4 tables</strong> : Zones · Familles de monstres · Succès (challenges) · Donjons (+ succès associés).
                </p>
                <p className="text-xs text-warning/90">
                    ⚠️ <strong>Non couvert :</strong> quêtes (GameQuest), archis/boss, monstres spéciaux, légendaires, récoltables, avis de
                    recherche — ces données viennent du <strong>siphon DofusDB / Metamob</strong> et ne transitent pas par cet onglet.
                    C'est principalement pour ça qu'on s'en sert rarement.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export */}
                <div className="bg-elevated/30 p-6 rounded-lg border border-border/30 space-y-4">
                    <div>
                        <h4 className="font-semibold text-foreground mb-2">📤 Export</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Télécharger les données gérées à la main (Zones, Familles, Succès, Donjons) en JSON
                        </p>
                    </div>

                    <Button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full bg-info hover:bg-info"
                    >
                        {exporting ? "⏳ Export en cours..." : "📥 Télécharger l'export JSON"}
                    </Button>

                    <div className="text-xs text-muted-foreground space-y-1">
                        <p>✅ Inclut les zones</p>
                        <p>✅ Inclut les familles de monstres (+ liens vers les zones)</p>
                        <p>✅ Inclut les succès (challenges)</p>
                        <p>✅ Inclut les donjons + succès associés</p>
                    </div>
                </div>

                {/* Export to Git (Development Only) */}
                <div className="bg-gradient-to-br from-green-900/20 to-success/20 p-6 rounded-lg border border-green-500/30 space-y-4">
                    <div>
                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                            🌱 Export vers Git
                            <span className="text-xs bg-green-600 px-2 py-0.5 rounded-full">DEV ONLY</span>
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sauvegarder directement dans <code className="px-1.5 py-0.5 bg-surface rounded text-green-400">prisma/seed-data/game-data.json</code>
                        </p>
                    </div>

                    <Button
                        onClick={handleExportToGit}
                        disabled={exportingGit}
                        className="w-full bg-green-600 hover:bg-green-700"
                    >
                        {exportingGit ? "⏳ Export en cours..." : "📦 Sauvegarder dans Git"}
                    </Button>

                    <div className="text-xs text-green-400/80 space-y-1">
                        <p>✅ Sauvegarde dans le fichier de seed</p>
                        <p>✅ Prêt pour commit Git</p>
                        <p>✅ Auto-deployed via deploy.sh</p>
                    </div>
                    <p className="text-xs text-warning/90">
                        ⚠️ Disponible <strong>uniquement en développement</strong>. Sur beta/prod, l'action est bloquée
                        (NODE_ENV=production) → utilise l'export JSON ci-contre.
                    </p>
                </div>

                {/* Import */}
                <div className="bg-elevated/30 p-6 rounded-lg border border-border/30 space-y-4">
                    <div>
                        <h4 className="font-semibold text-foreground mb-2">📥 Import</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Importer des données depuis un fichier JSON (upsert)
                        </p>
                    </div>

                    <label className="block">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            disabled={importing}
                            className="hidden"
                            id="import-file"
                        />
                        <Button
                            onClick={() => document.getElementById("import-file")?.click()}
                            disabled={importing}
                            className="w-full bg-info hover:bg-info"
                            type="button"
                        >
                            {importing ? "⏳ Import en cours..." : "📤 Choisir un fichier JSON"}
                        </Button>
                    </label>

                    <div className="text-xs text-warning/80 space-y-1">
                        <p>⚠️ Les données existantes seront mises à jour (upsert)</p>
                        <p>⚠️ Pas de suppression, seulement ajout/modification</p>
                    </div>
                </div>
            </div>

            {/* Comment l'utiliser */}
            <div className="bg-elevated/30 p-6 rounded-lg border border-border/30 space-y-4">
                <h4 className="font-semibold text-foreground mb-1">📖 Comment l'utiliser</h4>

                <div className="space-y-3 text-sm text-muted-foreground">
                    <div>
                        <strong className="text-foreground">Méthode 1 — JSON (tous environnements)</strong>
                        <p className="mt-1">
                            ① « Télécharger l'export JSON » sur l'environnement source → ② « Choisir un fichier JSON » sur
                            l'environnement cible. Fonctionne partout (local, beta, prod).
                            <span className="text-warning/90"> C'est la méthode à privilégier sur beta/prod.</span>
                        </p>
                    </div>
                    <div>
                        <strong className="text-foreground">Méthode 2 — Git / seed (développement uniquement)</strong>
                        <p className="mt-1">
                            « Sauvegarder dans Git » écrit dans <code className="px-1.5 py-0.5 bg-surface rounded">prisma/seed-data/game-data.json</code>
                            → commit → <code className="px-1.5 py-0.5 bg-surface rounded">npm run seed:game-data</code>.
                            En dev uniquement.
                        </p>
                    </div>
                </div>

                <div className="border-t border-border pt-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Workflow recommandé Local → Beta → Prod</h5>
                    <ol className="space-y-2 text-sm text-foreground">
                        <li><span className="inline-block w-6 text-info">1.</span> Saisir les données en local via cette interface (ou via le siphon DofusDB)</li>
                        <li><span className="inline-block w-6 text-info">2.</span> Exporter le JSON en local (ou « Sauvegarder dans Git » + commit)</li>
                        <li><span className="inline-block w-6 text-info">3.</span> Déployer le code sur beta (<code className="px-2 py-1 bg-surface rounded">./scripts/deploy.sh beta</code>)</li>
                        <li><span className="inline-block w-6 text-info">4.</span> Importer le JSON sur <code className="px-2 py-1 bg-surface rounded">beta.sigilos.fr/god?tab=game-data</code> (onglet Import/Export)</li>
                        <li><span className="inline-block w-6 text-info">5.</span> Tester sur beta, puis merger vers main</li>
                        <li><span className="inline-block w-6 text-info">6.</span> Déployer sur prod et importer le même JSON</li>
                    </ol>
                </div>

                <div className="border-t border-border pt-3 text-xs text-warning/90 space-y-1">
                    <p>⚠️ L'import fait un <strong>upsert</strong> (ajout/modification, jamais de suppression).</p>
                    <p>
                        ⚠️ Si tu comptes surtout sur le <strong>siphon DofusDB</strong>, cet onglet est en grande partie
                        <strong> supplémentaire</strong> — garde-le pour les données saisies à la main ou une migration ponctuelle.
                    </p>
                </div>
            </div>
        </div>
    );
}
