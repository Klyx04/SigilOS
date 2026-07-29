"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users, CheckCircle, ArrowRight, ArrowLeft, Shield, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getClass } from "@/lib/dofus-assets";

type CharacterOption = {
  id: string; // "PRINCIPAL" | mule pseudo
  name: string;
  isMule?: boolean;
  dofusClass?: string | null;
  level?: number;
};

type ActiveMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  dofusClass?: string;
  currentMilestoneTitle?: string;
  percent: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  guildId: string;
  characters: CharacterOption[];
  selectedCharacter: string;
  onSelectCharacter: (charId: string) => void;
  activeMembers: ActiveMember[];
  hasNoClassDeclared?: boolean;
};

export function RushOnboardingWizardModal({
  isOpen,
  onClose,
  guildId,
  characters,
  selectedCharacter,
  onSelectCharacter,
  activeMembers,
  hasNoClassDeclared = false,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!isOpen) return null;

  const currentSelectedChar = characters.find((c) => c.id === selectedCharacter) || characters[0];
  const uniqueActiveMembers = Array.from(new Map(activeMembers.map(m => [m.profileId || m.userName, m])).values());

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header Wizard Stepper */}
          <div className="p-6 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs">
                {step}/3
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {step === 1 && "Étape 1 : Choix de votre Personnage"}
                  {step === 2 && "Étape 2 : Avancée des Membres"}
                  {step === 3 && "Étape 3 : Prêt pour le Rush !"}
                </h3>
                <p className="text-[10px] text-zinc-400 font-medium">
                  {step === 1 && "Sélectionnez le personnage principal ou la mule avec laquelle vous rushez."}
                  {step === 2 && "Découvrez où en sont vos coéquipiers de guilde."}
                  {step === 3 && "Validation finale et lancement de la timeline."}
                </p>
              </div>
            </div>
            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    s === step ? "bg-emerald-400 scale-125" : s < step ? "bg-emerald-500/40" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content Body */}
          <div className="p-6 flex-1 max-h-[65vh] overflow-y-auto space-y-4">
            {/* STEP 1: Select Character / Class */}
            {step === 1 && (
              <div className="space-y-4">
                {hasNoClassDeclared && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs text-amber-200">
                    <span>Aucune classe n'est déclarée sur votre profil !</span>
                    <Link
                      href={`/dashboard/${guildId}/profile`}
                      className="px-2.5 py-1 rounded-xl bg-amber-500 text-black font-black text-[10px] uppercase flex items-center gap-1 hover:bg-amber-400 transition-colors"
                    >
                      Mon Profil <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                <p className="text-xs text-zinc-300 font-medium">
                  Choisissez le personnage qui réalisera cette progression :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {characters.map((char) => {
                    const isSelected = char.id === selectedCharacter;
                    const classDef = char.dofusClass ? getClass(char.dofusClass) : null;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => onSelectCharacter(char.id)}
                        className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "bg-zinc-900/60 border-white/5 hover:border-white/20 hover:bg-zinc-900"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden ${
                            isSelected ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-zinc-800 border border-white/10"
                          }`}
                        >
                          {classDef ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={classDef.icon} alt={classDef.name} className="w-full h-full object-contain p-1" />
                          ) : char.dofusClass ? (
                            <span className="uppercase text-[10px] text-zinc-300">{char.dofusClass.substring(0, 3)}</span>
                          ) : (
                            <User className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-white truncate">{char.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            {char.isMule ? "Mule" : "Personnage Principal"}
                            {classDef && <span className="ml-1 text-zinc-500">({classDef.name})</span>}
                          </p>
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: Active Members Overview */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300 font-medium">
                  {uniqueActiveMembers.length > 0
                    ? `${uniqueActiveMembers.length} membre(s) de guilde sont actuellement sur ce Rush :`
                    : "Vous êtes le premier de la guilde à vous lancer dans ce Rush !"}
                </p>

                {uniqueActiveMembers.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {uniqueActiveMembers.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-white/5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-300 overflow-hidden">
                            {m.userAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" />
                            ) : (
                              m.userName[0]?.toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">{m.userName}</p>
                            <p className="text-[9.5px] text-zinc-400">
                              {m.currentMilestoneTitle ? `Étape : ${m.currentMilestoneTitle}` : "En cours"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-400">{m.percent}%</span>
                          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${m.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-white/10 rounded-2xl bg-zinc-900/30">
                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-bold text-zinc-300">Soyez le pionnier du Rush !</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Votre progression apparaîtra ici pour guider les membres de la guilde.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Ready to Rush */}
            {step === 3 && (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white uppercase tracking-wider">Tout est configuré !</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Vous allez suivre ce guide avec{" "}
                    <span className="text-emerald-400 font-bold">{currentSelectedChar?.name}</span>.
                  </p>
                </div>
                <div className="p-3 bg-zinc-900/80 border border-white/5 rounded-2xl text-left text-xs space-y-1 text-zinc-300">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" /> Astuces Rush :
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    - Cochez vos quêtes une par une pour notifier la guilde de votre avancée.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    - Cliquez sur le bouton Donjon pour organiser une sortie en 1 clic.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-white/5 bg-zinc-900/50 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Précédent
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-md"
              >
                Suivant <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Lancer mon Rush ! <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}