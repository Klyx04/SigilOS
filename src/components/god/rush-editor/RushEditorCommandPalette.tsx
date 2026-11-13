"use client";

/**
 * Palette `Ctrl+K` du studio (E1) : aller à une quête / un bloc, créer, changer d'onglet.
 *
 * Le filtrage passe par la **règle pure** `filterRushEditorCommands` (mêmes mots-clés que
 * la recherche : nom, qid, cité, Ordre, classe) — `shouldFilter={false}` pour éviter un
 * second filtre divergent dans `cmdk`.
 */

import { useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { filterRushEditorCommands, type RushEditorCommand } from "@/lib/rush-editor-selection";

export function RushEditorCommandPalette({
  open,
  onOpenChange,
  commands,
  actions,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Index quêtes + blocs (`buildRushEditorCommands`). */
  commands: RushEditorCommand[];
  /** Actions du studio (créer un bloc, ouvrir Config…). */
  actions: RushEditorCommand[];
  onRun: (command: RushEditorCommand) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleCommands = filterRushEditorCommands(commands, query);
  const visibleActions = filterRushEditorCommands(actions, query);

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const run = (command: RushEditorCommand) => {
    handleOpenChange(false);
    onRun(command);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      title="Palette du studio"
      description="Aller à une quête ou un bloc, ou lancer une action"
      className="sm:max-w-lg"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Aller à une quête, un bloc, une action…"
        aria-label="Rechercher dans la palette"
      />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        {visibleCommands.length > 0 && (
          <CommandGroup heading="Quêtes et blocs">
            {visibleCommands.map((command) => (
              <CommandItem key={command.id} value={command.id} onSelect={() => run(command)}>
                <span className="truncate">{command.label}</span>
                <span className="ml-auto shrink-0 pl-2 text-caption text-muted-foreground">{command.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {visibleCommands.length > 0 && visibleActions.length > 0 && <CommandSeparator />}

        {visibleActions.length > 0 && (
          <CommandGroup heading="Actions">
            {visibleActions.map((command) => (
              <CommandItem key={command.id} value={command.id} onSelect={() => run(command)}>
                <span className="truncate">{command.label}</span>
                {command.hint && (
                  <span className="ml-auto shrink-0 pl-2 text-caption text-muted-foreground">{command.hint}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
