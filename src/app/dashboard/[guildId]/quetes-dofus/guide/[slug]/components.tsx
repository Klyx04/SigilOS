"use client";
import React from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Skull, Target, Copy } from "lucide-react";
import { toast } from "sonner";

export const GlassCard = ({ children, className = "", style = {} }: any) => (
  <div className={`bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl ${className}`} style={style}>
    {children}
  </div>
);

export const Badge = ({ children, color = "emerald", className = "" }: any) => {
  const colors: any = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    gold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    zinc: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};

export const MapBadge = ({ posX, posY, mapName, onClick }: { posX: number; posY: number; mapName?: string; onClick: any }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(posX, posY, mapName); }}
    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[10px] font-bold text-cyan-400 transition-all group active:scale-95">
    <MapPin className="w-3 h-3 group-hover:scale-110 transition-transform text-cyan-500" />
    <span>{mapName || `[${posX},${posY}]`}</span>
  </button>
);

export const StepRow = ({ step, isChecked, onToggle, onMapClick, guideRef }: any) => {
  const hasPos = step.pos_x !== 0 || step.pos_y !== 0;

  const handleTextClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 1. Détection des liens DofusDB (items, monstres, etc)
    const customTag = target.closest('[data-type="custom-tag"]');
    if (customTag) {
      e.stopPropagation();
      const id = customTag.getAttribute('data-id') || customTag.getAttribute('dofusdbid');
      const type = customTag.getAttribute('type');
      if (id && type) {
        let url = `https://dofusdb.fr/fr/database/${type}/${id}`;
        // Cas particulier pour les donjons si nécessaire
        if (type === 'dungeon') url = `https://dofusdb.fr/fr/database/dungeon/${id}`;
        window.open(url, '_blank');
        return;
      }
    }

    // 2. Détection des positions [x, y]
    const text = target.innerText || "";
    const posMatch = text.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/);
    
    if (posMatch) {
      e.stopPropagation();
      const x = posMatch[1];
      const y = posMatch[2];
      const cmd = `/travel ${x} ${y}`;
      navigator.clipboard.writeText(cmd);
      toast.success(`Position ${posMatch[0]} copiée !`, {
        description: "La commande /travel est dans ton presse-papier.",
        icon: <Copy className="w-4 h-4 text-emerald-500" />,
      });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: isChecked ? 0.4 : 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      transition={{ duration: 0.3 }}
      onClick={() => onToggle(`${guideRef}-${step.stepNumber}`)}
      className={`group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-default relative overflow-hidden ${isChecked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/5 border-white/5 hover:border-white/10"}`}
    >
      {isChecked && (
        <motion.div 
          initial={{ width: 0 }} 
          animate={{ width: "100%" }} 
          className="absolute inset-y-0 left-0 bg-emerald-500/5 pointer-events-none" 
        />
      )}

      {isChecked && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="absolute inset-0 bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/20 pointer-events-none z-0" 
        />
      )}

      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border transition-all z-10 cursor-pointer ${isChecked ? "bg-emerald-500 border-emerald-400 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-90" : "bg-zinc-900 border-zinc-800 text-zinc-600 group-hover:border-zinc-700"}`}>
        {isChecked ? <Check className="w-4 h-4 font-black" /> : <span className="text-[10px] font-black">{step.stepNumber}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1 transition-all">
          {step.name && (
            <span className={`text-[11px] font-black transition-all ${isChecked ? "text-emerald-500/50 line-through" : "text-zinc-200"}`}>
              {step.name}
            </span>
          )}
          {hasPos && <MapBadge posX={step.pos_x} posY={step.pos_y} mapName={step.map} onClick={onMapClick} />}
        </div>
        <div 
          className={`text-[11px] leading-relaxed ganymade-step-text transition-all duration-500 ${isChecked ? "text-zinc-600 grayscale opacity-40 italic line-through decoration-emerald-500/30" : "text-zinc-400"}`} 
          onClick={handleTextClick}
          dangerouslySetInnerHTML={{ __html: step.web_text
            .replace(/<input[^>]*type="checkbox"[^>]*>/g, '')
            .replace(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g, '<span class="pos-interactive">$&</span>') 
          }} 
        />
      </div>
    </motion.div>
  );
};
