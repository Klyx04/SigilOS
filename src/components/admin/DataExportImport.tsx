"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportGameData, importGameData } from "@/server/actions/game-data-admin-actions";

export default function DataExportImport() {
    const [exporting, setExporting] = useState(false);
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
        } catch (error) {
            toast.error("Fichier invalide");
        }

        setImporting(false);
        e.target.value = "";
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-6 rounded-lg border border-indigo-500/30">
                <h3 className="text-lg font-semibold text-white mb-2">📦 Export / Import</h3>
                <p className="text-sm text-slate-300">
                    Utilisez ces fonctions pour synchroniser les données entre environnements (local → beta → prod)
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export */}
                <div className="bg-slate-800/30 p-6 rounded-lg border border-slate-700/30 space-y-4">
                    <div>
                        <h4 className="font-semibold text-white mb-2">📤 Export</h4>
                        <p className="text-sm text-slate-400 mb-4">
                            Télécharger toutes les données (familles, challenges, donjons) en JSON
                        </p>
                    </div>

                    <Button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                        {exporting ? "⏳ Export en cours..." : "📥 Télécharger l'export JSON"}
                    </Button>

                    <div className="text-xs text-slate-500 space-y-1">
                        <p>✅ Inclut toutes les familles de monstres</p>
                        <p>✅ Inclut tous les challenges</p>
                        <p>✅ Inclut tous les donjons + succès associés</p>
                    </div>
                </div>

                {/* Import */}
                <div className="bg-slate-800/30 p-6 rounded-lg border border-slate-700/30 space-y-4">
                    <div>
                        <h4 className="font-semibold text-white mb-2">📥 Import</h4>
                        <p className="text-sm text-slate-400 mb-4">
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
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            type="button"
                        >
                            {importing ? "⏳ Import en cours..." : "📤 Choisir un fichier JSON"}
                        </Button>
                    </label>

                    <div className="text-xs text-orange-400/80 space-y-1">
                        <p>⚠️ Les données existantes seront mises à jour (upsert)</p>
                        <p>⚠️ Pas de suppression, seulement ajout/modification</p>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-800/30 p-6 rounded-lg border border-slate-700/30">
                <h4 className="font-semibold text-white mb-3">🔄 Workflow Local → Beta → Prod</h4>
                <ol className="space-y-2 text-sm text-slate-300">
                    <li>
                        <span className="inline-block w-6 text-indigo-400">1.</span>
                        Saisir les données en local via cette interface
                    </li>
                    <li>
                        <span className="inline-block w-6 text-indigo-400">2.</span>
                        Exporter le JSON en local
                    </li>
                    <li>
                        <span className="inline-block w-6 text-indigo-400">3.</span>
                        Déployer le code sur beta (<code className="px-2 py-1 bg-slate-900 rounded">./scripts/deploy.sh beta</code>)
                    </li>
                    <li>
                        <span className="inline-block w-6 text-indigo-400">4.</span>
                        Importer le JSON sur <code className="px-2 py-1 bg-slate-900 rounded">beta.sigilos.fr/god/game-data</code>
                    </li>
                    <li>
                        <span className="inline-block w-6 text-indigo-400">5.</span>
                        Tester sur beta, puis merger vers main
                    </li>
                    <li>
                        <span className="inline-block w-6 text-indigo-400">6.</span>
                        Déployer sur prod et importer le même JSON
                    </li>
                </ol>
            </div>
        </div>
    );
}
