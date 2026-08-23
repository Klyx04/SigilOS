import { BookOpen, RefreshCcw, Database, Shield } from "lucide-react";

export function WorkflowExplanation() {
    return (
        <div className="bg-background/40 border border-border rounded-[2rem] p-8 mb-12 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-black text-foreground italic truncate tracking-tight mb-8 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-info" />
                Workflow de Création & Synchronisation des Quêtes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Etape 1 */}
                <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center border border-info/20 text-info ">
                        <span className="font-black text-xl">1</span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-foreground uppercase text-caption tracking-[0.2em] text-info">La Coquille Vide</h3>
                        <p className="text-caption text-muted-foreground leading-relaxed font-bold">
                            Ajoute manuellement une coquille vide pour un nouveau Dofus en base de données. Il sera marqué "Guide à venir" mais permet aux joueurs de cocher l'obtention.
                        </p>
                    </div>
                </div>

                {/* Etape 2 */}
                <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400 ">
                        <span className="font-black text-xl">2</span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-foreground uppercase text-caption tracking-[0.2em] text-sky-400">Structure du Modèle</h3>
                        <p className="text-caption text-muted-foreground leading-relaxed font-bold">
                            Dans le code backend (<code className="text-sky-300">dofus-quest-actions.ts</code>), paramètre la suite des IDs de quêtes (DofusDB) qui composent le chemin de ce Dofus.
                        </p>
                    </div>
                </div>

                {/* Etape 3 */}
                <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 text-success ">
                        <span className="font-black text-xl">3</span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-foreground uppercase text-caption tracking-[0.2em] text-success">Compilation</h3>
                        <p className="text-caption text-muted-foreground leading-relaxed font-bold">
                            Clique sur le bouton <strong className="text-success border-b border-success">Compiler ce Dofus</strong> (ou CLI). SigilOS va aspirer les coordonnées, PNJ, objets et donjons depuis DofusDB.
                        </p>
                    </div>
                </div>

                {/* Etape 4 */}
                <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center border border-warning/20 text-warning ">
                        <span className="font-black text-xl">4</span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-foreground uppercase text-caption tracking-[0.2em] text-warning">Déploiement</h3>
                        <p className="text-caption text-muted-foreground leading-relaxed font-bold">
                            Une fois le taux d'enrichissement affiché à 100%, clique sur <strong className="text-warning border-b border-warning">Synchroniser toute la base</strong> pour envoyer les données aux utilisateurs.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
