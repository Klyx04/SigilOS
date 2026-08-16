"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, X, AlertTriangle } from "lucide-react";

type ResetConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  characterName: string;
  isLoading?: boolean;
};

export function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  characterName,
  isLoading = false,
}: ResetConfirmModalProps) {
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
            className="bg-surface border border-border rounded-3xl p-5 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-12 h-12 mx-auto rounded-2xl bg-danger/15 border border-danger/25 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>

            {/* Title */}
            <h3 className="text-center text-base font-black text-foreground mb-2">
              Réinitialiser la progression
            </h3>

            {/* Description */}
            <p className="text-center text-xs text-muted-foreground mb-6 leading-relaxed">
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
                className="flex-1 px-4 py-2.5 rounded-xl bg-elevated hover:bg-muted text-muted-foreground text-caption font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger hover:bg-danger text-danger-foreground text-caption font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}