"use client";

import React, { useState } from "react";
import { MoreVertical, RotateCcw, ExternalLink, MessageSquare, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface RushActionMenuProps {
  onReset?: () => void;
  onFeedback?: () => void;
  dofusdbUrl?: string | null;
  noobsUrl?: string | null;
  itemName?: string;
}

export function RushActionMenu({
  onReset,
  onFeedback,
  dofusdbUrl,
  noobsUrl,
  itemName = "ce jalon",
}: RushActionMenuProps) {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Actions secondaires"
            className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-zinc-950/95 border-white/10 text-zinc-200 text-xs">
          {noobsUrl && (
            <DropdownMenuItem asChild>
              <a
                href={noobsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                <span>DofusPourLesNoobs</span>
              </a>
            </DropdownMenuItem>
          )}

          {dofusdbUrl && (
            <DropdownMenuItem asChild>
              <a
                href={dofusdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                <span>Fiche DofusDB</span>
              </a>
            </DropdownMenuItem>
          )}

          {onFeedback && (
            <DropdownMenuItem onClick={onFeedback} className="flex items-center gap-2 cursor-pointer">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
              <span>Signaler une erreur</span>
            </DropdownMenuItem>
          )}

          {onReset && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => setResetConfirmOpen(true)}
                className="flex items-center gap-2 text-red-400 focus:text-red-300 focus:bg-red-950/30 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Réinitialiser</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Reset */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-serif">
              Réinitialiser la progression ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400 leading-relaxed">
              Cette action effacera les étapes validées et le repère actif pour {itemName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-zinc-900 border-white/10 hover:bg-zinc-800 text-xs">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onReset?.();
                setResetConfirmOpen(false);
              }}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
