"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Plus, Trash2, Save, X, GripVertical, Navigation, Info, Database, Sword, Package, Globe, Link as LinkIcon, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { upsertOptimizedGuide, deleteOptimizedGuide } from "@/server/actions/optimized-guide-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Local types
type ObjectiveType = 'QUEST' | 'DUNGEON' | 'RESOURCE' | 'BOSS' | 'OTHER';

type Objective = {
    id: string;
    type: ObjectiveType;
    name: string;
    quantity?: number;
    link?: string;
    imageUrl?: string;
};

type GuideStep = {
    id: string; // local temp ids for dnd
    order: number;
    title: string;
    description: string;
    questIds: string[]; // Legacy support
    objectives: Objective[]; // New structured data
};

type GuideForm = {
    id?: string;
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    isActive: boolean;
    steps: GuideStep[];
};

export default function OptimizedGuideAdminClient({ initialGuides, dofusItems }: { initialGuides: any[], dofusItems: any[] }) {
    const [guides, setGuides] = useState(initialGuides);
    const [selectedGuide, setSelectedGuide] = useState<GuideForm | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Custom Objective Modal/Form state
    const [isAddingObjective, setIsAddingObjective] = useState<{stepIdx: number} | null>(null);
    const [newObjective, setNewObjective] = useState<Partial<Objective>>({ type: 'DUNGEON', quantity: 1 });

    // Dofus items map for easy lookup
    const availableQuests = dofusItems.flatMap(d => d.questChains.flatMap((c: any) => c.entries.map((e: any) => ({ 
        ...e, 
        dofusColor: d.color, 
        dofusImage: d.localImageUrl || d.imageUrl 
    }))));
    
    const getQuestDetails = (id: string) => availableQuests.find(q => q.id === id);

    const handleCreateNew = () => {
        setSelectedGuide({
            slug: "nouvelle-route",
            name: "Nouvelle Route",
            description: "",
            imageUrl: "",
            isActive: false,
            steps: []
        });
    };

    const handleSelectGuide = (guide: any) => {
        const parsedSteps = guide.steps.map((s: any) => {
            // Migration logic: if objectives is missing, build it from questIds
            let objectives = s.objectives as Objective[] || [];
            if (objectives.length === 0 && s.questIds && s.questIds.length > 0) {
                objectives = s.questIds.map((qid: string) => {
                    const qData = getQuestDetails(qid);
                    return {
                        id: qid,
                        type: 'QUEST',
                        name: qData?.name || "Quête",
                        imageUrl: qData?.dofusImage
                    };
                });
            }

            return {
                id: s.id,
                order: s.order,
                title: s.title,
                description: s.description || "",
                questIds: s.questIds || [],
                objectives: objectives
            };
        });

        setSelectedGuide({
            id: guide.id,
            slug: guide.slug,
            name: guide.name,
            description: guide.description || "",
            imageUrl: guide.imageUrl || "",
            isActive: guide.isActive,
            steps: parsedSteps,
        });
    };

    const handleAddStep = () => {
        if (!selectedGuide) return;
        const newStepId = `temp_${Date.now()}`;
        const newSteps = [...selectedGuide.steps, {
            id: newStepId,
            order: selectedGuide.steps.length,
            title: `Étape ${selectedGuide.steps.length + 1}`,
            description: "",
            questIds: [],
            objectives: []
        }];
        setSelectedGuide({ ...selectedGuide, steps: newSteps });
    };

    const handleDeleteStep = (stepId: string) => {
        if (!selectedGuide) return;
        const newSteps = selectedGuide.steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, order: idx }));
        setSelectedGuide({ ...selectedGuide, steps: newSteps });
    };

    const handleSave = async () => {
        if (!selectedGuide) return;
        setIsSaving(true);
        try {
            // Prep data: ensure questIds is synced with objectives for compatibility
            const dataToSave = {
                ...selectedGuide,
                steps: selectedGuide.steps.map(s => ({
                    ...s,
                    questIds: s.objectives.filter(o => o.type === 'QUEST').map(o => o.id)
                }))
            };

            const res = await upsertOptimizedGuide(undefined, dataToSave as any);
            if (res.success) {
                toast.success("Guide sauvegardé avec succès !");
                window.location.reload();
            } else {
                toast.error((res as any).error || "Erreur lors de la sauvegarde");
            }
        } catch (e: any) {
            toast.error(e.message);
        }
        setIsSaving(false);
    };

    // DofusDB Link Parser
    const parseDofusDBLink = (url: string) => {
        if (!url) return;
        
        // Items (Resources, Gear)
        const itemMatch = url.match(/\/item\/(\d+)/i) || url.match(/\/items\/view\/(\d+)/i);
        if (itemMatch) {
            setNewObjective(prev => ({
                ...prev,
                imageUrl: `https://static.dofusdb.fr/items/${itemMatch[1]}.png`,
                link: url
            }));
            return;
        }

        // Monsters (Bosses)
        const monsterMatch = url.match(/\/monster\/(\d+)/i) || url.match(/\/monsters\/view\/(\d+)/i);
        if (monsterMatch) {
            setNewObjective(prev => ({
                ...prev,
                imageUrl: `https://static.dofusdb.fr/monsters/${monsterMatch[1]}.png`,
                link: url
            }));
            return;
        }
    };

    const handleConfirmObjective = () => {
        if (!selectedGuide || isAddingObjective === null || !newObjective.name) return;

        const updatedSteps = [...selectedGuide.steps];
        const step = updatedSteps[isAddingObjective.stepIdx];
        
        const obj: Objective = {
            id: newObjective.id || `custom_${Date.now()}`,
            type: newObjective.type as ObjectiveType,
            name: newObjective.name,
            quantity: newObjective.quantity,
            link: newObjective.link,
            imageUrl: newObjective.imageUrl
        };

        step.objectives.push(obj);
        setSelectedGuide({ ...selectedGuide, steps: updatedSteps });
        setIsAddingObjective(null);
        setNewObjective({ type: 'DUNGEON', quantity: 1 });
    };

    const onDragEnd = (result: DropResult) => {
        if (!selectedGuide || !result.destination) return;

        const { source, destination } = result;
        const newSteps = [...selectedGuide.steps];

        // 1. Moving a Step
        if (source.droppableId === "steps-board" && destination.droppableId === "steps-board") {
            const [moved] = newSteps.splice(source.index, 1);
            newSteps.splice(destination.index, 0, moved);
            const reordered = newSteps.map((s, idx) => ({ ...s, order: idx }));
            setSelectedGuide({ ...selectedGuide, steps: reordered });
            return;
        }

        // 2. Moving an Objective between Drawer (Quests) and a Step
        if (source.droppableId === "drawer-quests" && destination.droppableId.startsWith("step-")) {
            const destStepIdx = newSteps.findIndex(s => `step-${s.id}` === destination.droppableId);
            if (destStepIdx === -1) return;

            const targetQuestId = result.draggableId.replace("drawer-", "");
            const qData = getQuestDetails(targetQuestId);
            
            // Prevent duplicate quests in the same step
            if (!newSteps[destStepIdx].objectives.find(o => o.id === targetQuestId)) {
                const newObj: Objective = {
                    id: targetQuestId,
                    type: 'QUEST',
                    name: qData?.name || "Quête",
                    imageUrl: qData?.dofusImage
                };
                newSteps[destStepIdx].objectives.splice(destination.index, 0, newObj);
                setSelectedGuide({ ...selectedGuide, steps: newSteps });
            }
            return;
        }

        // 3. Moving an Objective internally within/between Steps
        if (source.droppableId.startsWith("step-") && destination.droppableId.startsWith("step-")) {
            const sourceIdx = newSteps.findIndex(s => `step-${s.id}` === source.droppableId);
            const destIdx = newSteps.findIndex(s => `step-${s.id}` === destination.droppableId);
            
            if (sourceIdx === -1 || destIdx === -1) return;

            const [moved] = newSteps[sourceIdx].objectives.splice(source.index, 1);
            newSteps[destIdx].objectives.splice(destination.index, 0, moved);

            setSelectedGuide({ ...selectedGuide, steps: newSteps });
            return;
        }
        
        // 4. Removing from Step
        if (source.droppableId.startsWith("step-") && destination.droppableId === "drawer-quests") {
             const sourceIdx = newSteps.findIndex(s => `step-${s.id}` === source.droppableId);
             if (sourceIdx !== -1) {
                 newSteps[sourceIdx].objectives.splice(source.index, 1);
                 setSelectedGuide({ ...selectedGuide, steps: newSteps });
             }
        }
    };

    return (
        <div className="flex w-full min-h-[70vh] gap-6">
            {/* List Selection Panel */}
            <div className="w-1/4 bg-zinc-900 border border-white/10 rounded-3xl p-4 flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-bold text-white uppercase text-xs tracking-widest opacity-50">Vos Routes</h3>
                    <button onClick={handleCreateNew} className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {guides.map(g => (
                        <button 
                            key={g.id} 
                            onClick={() => handleSelectGuide(g)}
                            className={`p-4 rounded-2xl text-left transition-all group ${selectedGuide?.id === g.id ? 'bg-emerald-600 shadow-xl' : 'bg-black/20 hover:bg-white/5 border border-white/5'}`}
                        >
                            <div className="font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">{g.name}</div>
                            <div className="text-[10px] uppercase font-black opacity-40">{g.steps.length} Étapes</div>
                        </button>
                    ))}
                    {guides.length === 0 && (
                        <div className="text-center text-zinc-500 text-sm p-8 opacity-40 italic">
                            Aucune route configurée
                        </div>
                    )}
                </div>
            </div>

            {/* Editing Panel */}
            {selectedGuide ? (
                <div className="flex-1 flex flex-col bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
                     <div className="flex justify-between flex-wrap gap-4 items-start mb-8 pb-6 border-b border-white/5">
                        <div className="flex-1 space-y-4">
                            <input 
                                value={selectedGuide.name}
                                onChange={e => setSelectedGuide({...selectedGuide, name: e.target.value})}
                                className="w-full bg-transparent text-4xl font-black text-white outline-none placeholder-zinc-800" 
                                placeholder="Nom de la Route"
                            />
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl">
                                     <Globe className="w-3.5 h-3.5 text-zinc-500" />
                                     <input 
                                        value={selectedGuide.slug}
                                        onChange={e => setSelectedGuide({...selectedGuide, slug: e.target.value})}
                                        className="bg-transparent text-xs text-zinc-300 outline-none w-32" 
                                        placeholder="slug-url"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedGuide(null)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-colors text-sm font-bold">
                                Annuler
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-colors text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                                <Save className="w-4 h-4" /> {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </div>
                     </div>

                     <DragDropContext onDragEnd={onDragEnd}>
                        <div className="flex flex-1 gap-6 min-h-0">
                            
                            {/* Drawer: Quêtes disponibles */}
                            <div className="w-80 flex flex-col bg-black/40 border border-white/5 rounded-2xl p-4">
                                <h4 className="font-black text-[10px] uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5 text-emerald-500" /> Bibliothèque de quêtes
                                </h4>
                                <Droppable droppableId="drawer-quests" isDropDisabled={true} type="objective">
                                    {(provided: DroppableProvided) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-3">
                                            {dofusItems.map(dof => (
                                                <div key={dof.id} className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 px-1" style={{ color: dof.color || "#fff"}}>
                                                        {dof.name}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {dof.questChains.flatMap((c:any) => c.entries).map((quest: any, index: number) => (
                                                            <Draggable key={`drawer-${quest.id}`} draggableId={`drawer-${quest.id}`} index={index}>
                                                                {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                                    <div 
                                                                        ref={provided.innerRef} 
                                                                        {...provided.draggableProps} 
                                                                        {...provided.dragHandleProps}
                                                                        className={`p-2.5 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center gap-2 ${snapshot.isDragging ? 'bg-emerald-600 text-white shadow-2xl z-50' : 'bg-black/40 text-zinc-400 hover:bg-white/5 border border-white/5'}`}
                                                                    >
                                                                        <div className="w-4 h-4 rounded-md bg-white/5 flex items-center justify-center text-[8px] opacity-40 shrink-0">L.{quest.level}</div>
                                                                        <span className="truncate">{quest.name}</span>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>

                            {/* Steps Board */}
                            <Droppable droppableId="steps-board" direction="vertical" type="step">
                                {(provided: DroppableProvided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-3">
                                        {selectedGuide.steps.map((step, index) => (
                                            <Draggable key={step.id} draggableId={step.id} index={index}>
                                                {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`bg-zinc-800/40 border border-white/10 rounded-[2rem] p-6 transition-all ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-emerald-500 bg-zinc-800' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-center mb-6 group/step">
                                                            <div className="flex gap-4 items-center flex-1">
                                                                <div {...provided.dragHandleProps} className="cursor-grab p-2 text-zinc-600 hover:text-white transition-colors">
                                                                    <GripVertical className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex flex-col flex-1">
                                                                    <input 
                                                                        value={step.title}
                                                                        onChange={e => {
                                                                            const copy = [...selectedGuide.steps];
                                                                            copy[index].title = e.target.value;
                                                                            setSelectedGuide({...selectedGuide, steps: copy});
                                                                        }}
                                                                        className="bg-transparent text-xl font-black text-white outline-none w-full placeholder-zinc-700"
                                                                    />
                                                                    <input 
                                                                        value={step.description}
                                                                        onChange={e => {
                                                                            const copy = [...selectedGuide.steps];
                                                                            copy[index].description = e.target.value;
                                                                            setSelectedGuide({...selectedGuide, steps: copy});
                                                                        }}
                                                                        placeholder="Description courte de l'étape..."
                                                                        className="bg-transparent text-xs text-zinc-500 outline-none w-full"
                                                                    />
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 opacity-0 group-hover/step:opacity-100 transition-all">
                                                                <button 
                                                                    onClick={() => setIsAddingObjective({ stepIdx: index })}
                                                                    className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                                                                >
                                                                    <Plus className="w-4 h-4" /> Ajouter Objectif
                                                                </button>
                                                                <button onClick={() => handleDeleteStep(step.id)} className="p-2 text-rose-500/50 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Droppable Zone for Objectives inside this step */}
                                                        <Droppable droppableId={`step-${step.id}`} type="objective">
                                                            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                                                <div 
                                                                    ref={provided.innerRef} 
                                                                    {...provided.droppableProps}
                                                                    className={`min-h-[80px] rounded-2xl p-3 transition-all ${snapshot.isDraggingOver ? 'bg-emerald-500/5 border-2 border-dashed border-emerald-500/30' : 'bg-black/20 border-2 border-dashed border-white/[0.03]'}`}
                                                                >
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        {step.objectives.map((obj, oIdx) => (
                                                                            <Draggable key={`${step.id}-${obj.id}-${oIdx}`} draggableId={`${step.id}-${obj.id}-${oIdx}`} index={oIdx}>
                                                                                {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                                                    <div
                                                                                        ref={provided.innerRef}
                                                                                        {...provided.draggableProps}
                                                                                        {...provided.dragHandleProps}
                                                                                        className={`p-3 rounded-xl bg-zinc-900/80 border border-white/5 text-sm font-medium text-zinc-300 flex items-center justify-between group/obj transition-all ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-emerald-500 z-50' : 'hover:border-white/20'}`}
                                                                                    >
                                                                                        <div className="flex items-center gap-3 truncate">
                                                                                            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 shrink-0 overflow-hidden">
                                                                                                {obj.imageUrl ? <img src={obj.imageUrl} className="w-6 h-6 object-contain" /> : (
                                                                                                    obj.type === 'QUEST' ? <Database className="w-4 h-4 opacity-40" /> : <Sword className="w-4 h-4 opacity-40" />
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex flex-col truncate">
                                                                                                <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600 leading-none mb-1">{obj.type}</span>
                                                                                                <span className="truncate font-bold">{obj.name} {obj.quantity && obj.quantity > 1 ? `(x${obj.quantity})` : ''}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        
                                                                                        <button 
                                                                                            onClick={() => {
                                                                                                const copy = [...selectedGuide.steps];
                                                                                                copy[index].objectives.splice(oIdx, 1);
                                                                                                setSelectedGuide({...selectedGuide, steps: copy});
                                                                                            }}
                                                                                            className="p-1.5 text-zinc-600 hover:text-rose-500 transition-colors opacity-0 group-hover/obj:opacity-100"
                                                                                        >
                                                                                            <X className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </Draggable>
                                                                        ))}
                                                                    </div>
                                                                    {provided.placeholder}
                                                                    {step.objectives.length === 0 && !snapshot.isDraggingOver && (
                                                                        <div className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 py-6">
                                                                            Glissez des quêtes ou ajoutez des objectifs
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Droppable>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}

                                        <button onClick={handleAddStep} className="w-full flex items-center justify-center gap-2 py-6 mt-4 border-2 border-dashed border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400 text-zinc-600 rounded-[2rem] transition-all font-black uppercase text-xs tracking-widest">
                                            <Plus className="w-5 h-5" /> Ajouter une Étape
                                        </button>
                                    </div>
                                )}
                            </Droppable>

                        </div>
                     </DragDropContext>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-black/20 border border-white/5 rounded-[3rem] p-12 text-zinc-600">
                    <Navigation className="w-20 h-20 mb-6 opacity-5" />
                    <h2 className="text-2xl font-black text-white opacity-40 mb-2">Centre de contrôle des routes</h2>
                    <p className="max-w-sm text-center text-sm">Sélectionnez une route pour commencer à forger la progression de vos membres.</p>
                </div>
            )}

            {/* Objective Modal */}
            {isAddingObjective !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-black text-white">Nouvel Objectif</h3>
                            <button onClick={() => setIsAddingObjective(null)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6 text-zinc-500" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                {(['DUNGEON', 'RESOURCE', 'BOSS', 'OTHER'] as ObjectiveType[]).map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setNewObjective({...newObjective, type: t})}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${newObjective.type === t ? 'bg-emerald-500/10 border-emerald-500/50 text-white' : 'bg-black/20 border-white/5 text-zinc-500 hover:border-white/10'}`}
                                    >
                                        {t === 'DUNGEON' && <Sword className="w-5 h-5" />}
                                        {t === 'RESOURCE' && <Package className="w-5 h-5" />}
                                        {t === 'BOSS' && <Database className="w-5 h-5" />}
                                        {t === 'OTHER' && <Info className="w-5 h-5" />}
                                        <span className="text-xs font-bold uppercase tracking-widest">{t}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-600 ml-1">Configuration</Label>
                                <Input 
                                    placeholder="Nom de l'objectif (ex: Battez le Comte Harebourg)" 
                                    value={newObjective.name || ''} 
                                    onChange={e => setNewObjective({...newObjective, name: e.target.value})}
                                    className="bg-black/40 border-white/10 rounded-xl h-12"
                                />
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <Input 
                                                placeholder="Lien DofusDB" 
                                                value={newObjective.link || ''} 
                                                onChange={e => {
                                                    setNewObjective({...newObjective, link: e.target.value});
                                                    parseDofusDBLink(e.target.value);
                                                }}
                                                className="bg-black/40 border-white/10 rounded-xl h-12 pl-10"
                                            />
                                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <Input 
                                            type="number" 
                                            placeholder="Qté" 
                                            value={newObjective.quantity || 1} 
                                            onChange={e => setNewObjective({...newObjective, quantity: parseInt(e.target.value)})}
                                            className="bg-black/40 border-white/10 rounded-xl h-12 text-center"
                                        />
                                    </div>
                                </div>
                            </div>

                            {newObjective.imageUrl && (
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <img src={newObjective.imageUrl} className="w-10 h-10 object-contain" />
                                        <span className="text-xs font-bold text-emerald-400">Miniature détectée !</span>
                                    </div>
                                    <button onClick={() => setNewObjective({...newObjective, imageUrl: undefined})} className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors">Retirer</button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleConfirmObjective}
                            disabled={!newObjective.name}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20"
                        >
                            Valider l'objectif
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
