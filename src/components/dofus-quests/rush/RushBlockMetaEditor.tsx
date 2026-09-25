"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Link as LinkIcon, ExternalLink, X, Check } from "lucide-react";
import { validateCoordinate } from "@/lib/rush-rich-meta";

export interface RushBlockMetaValues {
  coord: string;
  linkUrl: string;
  linkLabel: string;
  text: string;
}

export function RushBlockMetaEditor({
  values,
  onChange,
  accentColor = "#ec4899",
  isSeparator = false,
}: {
  values: RushBlockMetaValues;
  onChange: (patch: Partial<RushBlockMetaValues>) => void;
  accentColor?: string | null;
  isSeparator?: boolean;
}) {
  const [localCoord, setLocalCoord] = useState(values.coord || "");
  const [localUrl, setLocalUrl] = useState(values.linkUrl || "");
  const [localLabel, setLocalLabel] = useState(values.linkLabel || "");
  const [localText, setLocalText] = useState(values.text || "");

  // Synchro si les valeurs externes changent (ex: changement de milestone)
  useEffect(() => { setLocalCoord(values.coord || ""); }, [values.coord]);
  useEffect(() => { setLocalUrl(values.linkUrl || ""); }, [values.linkUrl]);
  useEffect(() => { setLocalLabel(values.linkLabel || ""); }, [values.linkLabel]);
  useEffect(() => { setLocalText(values.text || ""); }, [values.text]);

  const validatedCoord = validateCoordinate(localCoord);
  const isValidUrl = localUrl.trim().startsWith("http://") || localUrl.trim().startsWith("https://");

  const handleCoordChange = (val: string) => {
    setLocalCoord(val);
    const parsed = validateCoordinate(val);
    onChange({ coord: parsed ? parsed.formatted : val.trim() });
  };

  const handleUrlChange = (val: string) => {
    setLocalUrl(val);
    onChange({ linkUrl: val.trim() });
  };

  const handleLabelChange = (val: string) => {
    setLocalLabel(val);
    onChange({ linkLabel: val });
  };

  const handleTextChange = (val: string) => {
    setLocalText(val);
    onChange({ text: val });
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor || "#ec4899" }} />
          {isSeparator ? "Position & Lien du séparateur" : "Position & Lien du conseil"}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Ordre standardisé garanti</span>
      </div>

      {/* Ligne 1 : Position avec 2 champs X et Y */}
      <div>
        <label className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Position Dofus (X et Y)
          </span>
          {validatedCoord ? (
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> Reconnue : [{validatedCoord.formatted}] (copie /travel {validatedCoord.formatted})
            </span>
          ) : (localCoord ? (
            <span className="text-[10px] text-amber-400 font-mono">Coordonnées incomplètes</span>
          ) : null)}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs text-zinc-500 font-mono font-bold">X:</span>
            <input
              type="text"
              value={validatedCoord ? String(validatedCoord.x) : (localCoord.split(",")[0]?.trim() || "")}
              onChange={(e) => {
                const valX = e.target.value.trim();
                const curY = validatedCoord ? String(validatedCoord.y) : (localCoord.split(",")[1]?.trim() || "");
                const combined = valX || curY ? `${valX}, ${curY}` : "";
                handleCoordChange(combined);
              }}
              placeholder="ex: -55"
              className="w-full bg-black/60 border border-white/10 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs text-zinc-500 font-mono font-bold">Y:</span>
            <input
              type="text"
              value={validatedCoord ? String(validatedCoord.y) : (localCoord.split(",")[1]?.trim() || "")}
              onChange={(e) => {
                const curX = validatedCoord ? String(validatedCoord.x) : (localCoord.split(",")[0]?.trim() || "");
                const valY = e.target.value.trim();
                const combined = curX || valY ? `${curX}, ${valY}` : "";
                handleCoordChange(combined);
              }}
              placeholder="ex: 15"
              className="w-full bg-black/60 border border-white/10 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
          {localCoord ? (
            <button
              type="button"
              onClick={() => handleCoordChange("")}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Effacer la position"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Ligne 2 : Lien externe (URL + Libellé) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
            Lien externe cliquable (quête, DPLN, DofusDB...)
          </span>
          {isValidUrl ? (
            <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> URL valide
            </span>
          ) : null}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* URL */}
          <div className="relative flex items-center">
            <input
              type="url"
              value={localUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="URL: https://www.dofuspourlesnoobs.com/..."
              className={`w-full bg-black/60 border rounded-lg pl-3 pr-7 py-1.5 text-xs text-sky-300 placeholder:text-zinc-600 focus:outline-none transition-colors ${
                isValidUrl ? "border-sky-500/50" : "border-white/10 focus:border-sky-500/40"
              }`}
            />
            {localUrl ? (
              <button
                type="button"
                onClick={() => handleUrlChange("")}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
                title="Effacer l'URL"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>

          {/* Label */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={localLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Nom du lien (ex: Chaque chose en son temps)"
              className="w-full bg-black/60 border border-white/10 rounded-lg pl-3 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 transition-colors"
            />
            {localLabel ? (
              <button
                type="button"
                onClick={() => handleLabelChange("")}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
                title="Effacer le libellé"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Aperçu direct du lien */}
        {isValidUrl && (
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-zinc-500">Aperçu :</span>
            <a
              href={localUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-success hover:underline"
            >
              {localLabel.trim() || localUrl}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </div>

      {/* Ligne 3 : Note / Conseil libre */}
      <div>
        <label className="text-[11px] font-medium text-zinc-400 mb-1 block">
          {isSeparator ? "Description libre du séparateur (optionnel)" : "Conseil ou note libre (optionnel)"}
        </label>
        <textarea
          value={localText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={
            isSeparator
              ? "Description ou texte d'ambiance..."
              : "Consigne, astuce ou précision pour le joueur..."
          }
          rows={2}
          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/40 resize-none transition-colors"
        />
      </div>
    </div>
  );
}
