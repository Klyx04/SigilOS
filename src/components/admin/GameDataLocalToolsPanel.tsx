"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Flame, Link2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import {
    backfillNativeEffects,
    purgePlaceholderEffectLabels,
} from "@/server/actions/game-item-actions";
import { autoAssociateAllZoneFamilies } from "@/server/actions/game-data-actions";

/**
 * 🧰 Outils **locaux** (aucun appel réseau) — sortis des panneaux de siphon.
 *
 * Ces trois boutons vivaient au milieu des siphons réseau (`GameItemSiphonPanel` pour
 * les deux premiers, `ZoneManager` pour le troisième) : mélanger « je parle à DofusDB »
 * et « je recalcule chez moi » rendait le diagnostic impossible — on ne savait pas si
 * un échec venait du réseau ou de notre base. Ici, ils sont regroupés et étiquetés.
 *
 * **Déplacés, pas dupliqués** (§4.3) : les boutons d'origine ont été retirés de leurs
 * panneaux respectifs.
 */

export function GameDataLocalToolsPanel() {
    const [backfilling, setBackfilling] = useState(false);
    const [purging, setPurging] = useState(false);
    const [linking, setLinking] = useState(false);

    /**
     * 🩹 Rattrape les plages natives (`nativeEffects`) des items siphonnés AVANT
     * l'ajout de la colonne S2.2. Idempotent : relancer ne réécrit que le vide.
     * Boucle bornée (60 × 1000) : une ligne sans effet exploitable fait sortir la
     * boucle, il n'y a donc rien à « attendre indéfiniment ».
     */
    const handleBackfillNatives = async () => {
        setBackfilling(true);
        try {
            let repaired = 0;
            let remaining = 0;
            for (let pass = 0; pass < 60; pass++) {
                const res = await backfillNativeEffects(1000);
                if (!res.success || !res.data) {
                    toast.error(res.error || "Rattrapage impossible");
                    return;
                }
                repaired += res.data.repaired;
                remaining = res.data.remaining;
                if (res.data.repaired === 0 || remaining === 0) break;
            }
            // Mesuré : `repaired = 0` veut dire « rien en attente » (les items sans jets —
            // ressources, consommables, cosmétiques — portent `effects = []`, il n'y a rien
            // à calculer). Le dire évite de croire à une panne.
            if (repaired === 0) {
                toast.success(
                    "Effets natifs : déjà à jour — aucune fiche en attente. " +
                    "(Les items sans jets — ressources, consommables, cosmétiques — n'en auront jamais : normal.)",
                );
                return;
            }
            const suffix = remaining > 0 ? ` — ${remaining} item(s) sans jets de plus (normal)` : "";
            toast.success(`Effets natifs : ${repaired} fiche(s) réparée(s)${suffix}.`);
        } catch (err) {
            toast.error(`Rattrapage impossible : ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setBackfilling(false);
        }
    };

    /**
     * 🧹 Purge les libellés-gabarits `GameEffect.name` (« Effet 63 », « }{ soins »)
     * ramenés par le siphon `/effects`. Idempotent, **aucune suppression** : les
     * lignes sans source locale restent inchangées et sont ignorées à l'affichage.
     */
    const handlePurgeEffectLabels = async () => {
        setPurging(true);
        try {
            const res = await purgePlaceholderEffectLabels();
            if (!res.success || !res.data) {
                toast.error(res.error || "Purge impossible");
                return;
            }
            const { scanned, repaired, cleaned, unresolved } = res.data;
            if (scanned === 0) {
                toast.success("Libellés d'effets : déjà à jour — aucun gabarit en base.");
                return;
            }
            const regles = repaired + cleaned;
            if (regles === 0) {
                toast.info(
                    `Libellés d'effets : rien à réparer — les ${unresolved} gabarits n'ont ni caractéristique ` +
                    `jointe exploitable (valeur 0 chez DofusDB) ni libellé réel à dé-punctuariser. ` +
                    `Ils restent inchangés et ignorés à l'affichage.`,
                );
                return;
            }
            const detail = [
                repaired > 0 ? `${repaired} par la caractéristique jointe` : null,
                cleaned > 0 ? `${cleaned} nettoyé(s) (accolades de gabarit retirées)` : null,
            ].filter(Boolean).join(", ");
            toast.success(
                `Libellés d'effets : ${regles}/${scanned} réglé(s)${detail ? ` — ${detail}` : ""}` +
                (unresolved > 0 ? `, ${unresolved} sans source exploitable (ignorés à l'affichage).` : "."),
            );
        } catch (err) {
            toast.error(`Purge impossible : ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setPurging(false);
        }
    };

    /** #144 — matching strict (nom exact) zones ↔ familles via les archimonstres siphonnés. */
    const handleAssociateFamilies = async () => {
        setLinking(true);
        try {
            const res = await autoAssociateAllZoneFamilies();
            if (!res.success || !res.data) {
                toast.error(res.error || "Erreur lors de l'association");
                return;
            }
            if (res.data.familiesLinked === 0) {
                if (res.data.archisWithZone === 0) {
                    toast.info("Aucun archimonstre siphonné avec zone/sous-zone → rien à associer");
                    return;
                }
                // Mesuré : quand `matchedZones > 0` et 0 nouvelle liaison, c'est que tout ce
                // qui pouvait être lié l'EST déjà. Dire « aucune correspondance » était faux
                // et faisait croire à une panne.
                if (res.data.matchedZones > 0) {
                    toast.success(
                        `Familles ↔ zones : déjà à jour — ${res.data.matchedZones} zone(s) portent le nom d'une ` +
                        `zone d'archimonstre et sont déjà liées (${res.data.alreadyUpToDate}).`,
                    );
                    return;
                }
                toast.info(
                    "Aucune correspondance : aucune zone gérée ne porte le nom d'une zone/sous-zone d'archimonstre " +
                    "et aucun nom de famille n'apparaît dedans.",
                );
                return;
            }
            toast.success(`${res.data.familiesLinked} famille(s) associée(s) sur ${res.data.zonesScanned} zone(s)`);
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setLinking(false);
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-surface/60 p-4 space-y-4" aria-labelledby="god-local-tools">
            <header className="flex flex-wrap items-center gap-2">
                <Wrench className="h-4 w-4 text-warning" aria-hidden="true" />
                <h3 id="god-local-tools" className="text-sm font-black uppercase tracking-wider text-foreground">
                    Maintenance locale
                </h3>
                <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                    sans réseau
                </span>
            </header>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Ces outils ne parlent <strong className="text-foreground">jamais</strong> à DofusDB : si l&apos;un
                échoue, la cause est dans notre base, jamais dans le réseau. Idempotents — les relancer ne coûte rien.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-elevated/40 p-3 flex flex-col">
                    <h4 className="text-xs font-bold text-foreground">Effets natifs des items</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground flex-1">
                        Calcule les plages natives manquantes (colonne ajoutée après le premier siphon) —
                        remède direct au message « aucun effet natif importé » de l&apos;éditeur de jet FM.
                        Idempotent : s&apos;il n&apos;y a rien en attente, il le dit (« déjà à jour ») au lieu
                        d&apos;afficher un 0 ambigu.
                    </p>
                    <Button
                        onClick={() => void handleBackfillNatives()}
                        disabled={backfilling}
                        variant="outline"
                        className="w-full mt-2 rounded-xl gap-2"
                    >
                        {backfilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {backfilling ? "Rattrapage…" : "Rattraper les effets natifs"}
                    </Button>
                </div>

                <div className="rounded-xl border border-border bg-elevated/40 p-3 flex flex-col">
                    <h4 className="text-xs font-bold text-foreground">Libellés d&apos;effets gabarits</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground flex-1">
                        Réécrit les noms « Effet 63 » et les gabarits à accolades à partir de la caractéristique
                        jointe, puis retire la ponctuation de gabarit des libellés réels
                        (« Vole &#125; PM » → « Vole PM »). Aucune suppression ni invention : ce qui n&apos;a pas de
                        source exploitable reste inchangé et ignoré à l&apos;affichage.
                    </p>
                    <Button
                        onClick={() => void handlePurgeEffectLabels()}
                        disabled={purging}
                        variant="outline"
                        className="w-full mt-2 rounded-xl gap-2"
                    >
                        {purging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                        {purging ? "Purge…" : "Purger les libellés d'effets gabarits"}
                    </Button>
                </div>

                <div className="rounded-xl border border-border bg-elevated/40 p-3 flex flex-col">
                    <h4 className="text-xs font-bold text-foreground">Familles ↔ zones</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground flex-1">
                        Matching strict (nom exact) entre les zones gérées et celles des archimonstres déjà
                        siphonnés — aucun faux positif : ce qui ne matche pas est laissé tel quel. Quand tout
                        ce qui matche est déjà lié, il le dit (« déjà à jour ») au lieu de laisser croire à un
                        échec.
                    </p>
                    <Button
                        onClick={() => void handleAssociateFamilies()}
                        disabled={linking}
                        variant="outline"
                        className="w-full mt-2 rounded-xl gap-2 border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-400 hover:text-fuchsia-300"
                    >
                        {linking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        {linking ? "Association…" : "Associer familles (auto)"}
                    </Button>
                </div>
            </div>
        </section>
    );
}
