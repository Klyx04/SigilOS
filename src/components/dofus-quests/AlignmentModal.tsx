"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALIGNMENTS, ORDERS, getAlignmentLevelSteps } from "@/lib/dofus-assets";
import { updateUserProfile, updateMuleAlignment } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Édite alignement / ordre / tranche depuis le bandeau du guide.
 * Persiste via updateUserProfile (perso principal) OU updateMuleAlignment
 * (mule → altPseudos, synchro parfaite avec le profil perso).
 */
export default function AlignmentModal({
  open,
  onOpenChange,
  guildId,
  mulePseudo,
  alignment,
  alignmentOrder,
  alignmentLevel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  mulePseudo?: string | null;
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number;
}) {
  const router = useRouter();
  const [a, setA] = useState<string | null>(alignment && alignment !== "neutre" ? alignment : null);
  const [o, setO] = useState<string | null>(alignmentOrder ?? null);
  const [lvl, setLvl] = useState(alignmentLevel ?? 0);
  const [saving, setSaving] = useState(false);

  // Resynchronise les états locaux à chaque ouverture (props serveur fraîches).
  useEffect(() => {
    if (open) {
      setA(alignment && alignment !== "neutre" ? alignment : null);
      setO(alignmentOrder ?? null);
      setLvl(alignmentLevel ?? 0);
    }
  }, [open, alignment, alignmentOrder, alignmentLevel]);

  const orders = a ? ((ORDERS as unknown as Record<string, any[]>)[a] || []) : [];
  const selectedOrder = orders.find((x: any) => x.id === o);
  const levelSteps = selectedOrder ? getAlignmentLevelSteps(selectedOrder) : [];

  const save = async () => {
    setSaving(true);
    try {
      const res = mulePseudo
        ? await updateMuleAlignment({
            guildId,
            pseudo: mulePseudo,
            alignment: a ?? "neutre",
            alignmentOrder: a ? (o ?? null) : null,
            alignmentLevel: a ? (selectedOrder ? lvl : 0) : 0,
          })
        : await updateUserProfile({
            guildId,
            alignment: a ?? "neutre",
            alignmentOrder: a ? (o ?? null) : null,
            alignmentLevel: a ? (selectedOrder ? lvl : 0) : 0,
          });
      if (res.success) {
        toast.success("Alignement mis à jour");
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Erreur de mise à jour");
      }
    } catch {
      toast.error("Erreur de mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white outline-none">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-zinc-500">
            Alignement & Ordre
          </DialogTitle>
        </DialogHeader>

        {/* Alignement */}
        <p className="text-caption font-black uppercase tracking-widest text-zinc-500 mb-2">Alignement</p>
        <div className="flex gap-2 mb-4">
          {ALIGNMENTS.map(alg => (
            <button
              key={alg.id}
              type="button"
              onClick={() => {
                setA(alg.id === "neutre" ? null : alg.id);
                setO(null);
                setLvl(0);
              }}
              className={`align-opt${a === alg.id ? " active" : ""}`}
            >
              <img src={alg.icon} alt="" className="w-5 h-5 object-contain"/>
              <span>{alg.name}</span>
            </button>
          ))}
        </div>

        {/* Ordre (si alignement non neutre) */}
        {a && (
          <>
            <p className="text-caption font-black uppercase tracking-widest text-zinc-500 mb-2">Ordre</p>
            <div className="space-y-1.5 mb-4">
              {orders.map((ord: any) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => { setO(ord.id); setLvl(0); }}
                  className={`align-opt row${o === ord.id ? " active" : ""}`}
                >
                  <img src={ord.icon} alt="" className="w-5 h-5 object-contain"/>
                  <span>{ord.name}</span>
                </button>
              ))}
            </div>

            {selectedOrder && (
              <>
                <p className="text-caption font-black uppercase tracking-widest text-zinc-500 mb-2">Tranche</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    type="button"
                    onClick={() => setLvl(0)}
                    className={`align-tranche${lvl === 0 ? " active" : ""}`}
                  >
                    Aucune
                  </button>
                  {levelSteps.map(({ level: k, title }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLvl(k)}
                      className={`align-tranche${lvl === k ? " active" : ""}`}
                      title={title || `Niveau ${k}`}
                    >
                      {k} · {title || `Niveau ${k}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="align-cancel" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </button>
          <button type="button" className="align-save" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin"/> : null}
            Enregistrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
