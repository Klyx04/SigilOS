"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";

type ResetConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  characterName: string;
  isLoading?: boolean;
};

/**
 * Confirmation de réinitialisation — portail maison (aucun `Dialog` Radix : la
 * modale doit rester dans le document qui la porte, PiP comprise).
 *
 * DA « Gouache Wakfu » (05/11/2026) : `rounded-3xl` (24 px, hors plafond de
 * 12 px), `shadow-2xl` (ombre molle) et `font-black` disparaissent au profit de
 * la matière `.da-modal` — liseré `--da-outline`, rayon 12 px, aucune ombre.
 * Les libellés et l'ordre des boutons sont inchangés.
 */
export function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  characterName,
  isLoading = false,
}: ResetConfirmModalProps) {
  const daScope = daScopeProps(useDaTheme());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            {...daScope}
            className="da-modal da-portal w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="da-modal-body">
              {/* Icon */}
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[10px] border border-danger/25 bg-danger/15">
                <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
              </div>

              {/* Title */}
              <h3 className="mb-2 text-center text-base font-bold text-foreground">
                Réinitialiser la progression
              </h3>

              {/* Description */}
              <p className="mb-6 text-center text-xs leading-relaxed text-muted-foreground">
                Tu es sur le point de <strong className="text-danger">tout remettre à zéro</strong> pour{" "}
                <strong className="text-foreground">{characterName}</strong>.
                <br />
                Cette action est irréversible.
              </p>

              {/* Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 rounded-[6px] bg-elevated px-4 py-2.5 text-caption font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[6px] bg-danger px-4 py-2.5 text-caption font-bold text-danger-foreground transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="size-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Reset
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}