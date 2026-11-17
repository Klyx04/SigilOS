"use client";
import React, { useState, useEffect, useMemo } from "react";
import { 
  Upload, Plus, Trash2, Save, Edit3, Users, TreePine, FileJson, 
  Check, X, Loader2, AlertTriangle, ChevronDown, ChevronRight, 
  Copy, ArrowUp, ArrowDown, ExternalLink, Zap, Settings2, Eye, Package
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  importGanymedeGuide, upsertMilestone, deleteMilestone, upsertSequence, 
  deleteSequence, getGuideAdminFull, getGuildProgressSummary, 
  deleteAllMilestones, importSubGuide, listSubGuides, getSubGuideSteps, updateSubGuideStep, deleteSubGuide,
  updateGuideSettings, repairAlignmentRefs
} from "@/server/actions/optimized-guide-actions";
import { searchDungeonsLocal, searchItemsDofusDB, searchQuestsLocalThenDofusDB, getQuestPrerequisites } from "@/server/actions/dofus-search-actions";
import { toast } from "sonner";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";
import { sanitizeHtml } from "@/lib/security";
import { fixBrokenImages } from "@/lib/ganymede-parser";

type Guide = { id: string; name: string; slug: string; isActive: boolean; isUnderConstruction?: boolean; displayMode?: string; milestones: Milestone[] };
type Milestone = { id: string; title: string; subtitle?: string; description?: string; type: string; accentColor: string; imageUrl?: string; order: number; chapter: number; chapterLabel: string; posX: number; posY: number; isOptional: boolean; sequences: Sequence[] };
type Sequence = { id: string; milestoneId?: string; subGuideRef: string; subGuideName: string; stepFrom?: number; stepTo?: number; note?: string; isOptional: boolean; order: number };

// 🧱 Royal Block System
type ContentBlock = 
  | { type: 'TEXT', content: string }
  | { type: 'QUEST', title: string, id: string, name: string, dofusDbId?: number | null, prerequisites?: any }
  | { type: 'TASK', label: string, checked: boolean }
  | { type: 'TAG', tagType: 'item' | 'dungeon', name: string, id: string, imageUrl?: string, quantity?: string }
  | { type: 'JOB', name: string, iconUrl: string }
  | { type: 'IMAGE', url: string, alt?: string };


export default function OptimizedGuideAdminClient({ initialGuides, firstGuildId }: { initialGuides: Guide[]; firstGuildId?: string | null }) {
  const [tab, setTab] = useState<"import" | "edit" | "progress" | "settings">("edit");
  const [guide, setGuide] = useState<Guide | null>(initialGuides[0] ?? null);
  const [milestones, setMilestones] = useState<Milestone[]>(initialGuides[0]?.milestones ?? []);
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [importedSubs, setImportedSubs] = useState<any[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([1]));
  const [editingMs, setEditingMs] = useState<Milestone | null>(null);
  const [editingSeq, setEditingSeq] = useState<Partial<Sequence> | null>(null);
  const [composerMode, setComposerMode] = useState<boolean>(false);
  const [progress, setProgress] = useState<any[]>([]);
  const [batchReport, setBatchReport] = useState<{ ok: {ref: string; name: string; steps: number}[]; fail: {file: string; error: string}[] } | null>(null);
  const [seqSteps, setSeqSteps] = useState<any[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [activeBlocks, setActiveBlocks] = useState<ContentBlock[]>([]);
  const [editorMode, setEditorMode] = useState<'VISUAL' | 'CODE'>('VISUAL');
  const [showJobPicker, setShowJobPicker] = useState<boolean>(false);
  const [searchingBlockIdx, setSearchingBlockIdx] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🔍 Milestone Filter States
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterOptional, setFilterOptional] = useState<string>("all");

  const updateCoordinateWorld = (blockIdx: number, matchIdx: number, newWorldId: string) => {
    const n = [...activeBlocks];
    const block = n[blockIdx];
    if (block.type !== 'TEXT') return;
    
    let currentIdx = 0;
    const newContent = block.content.replace(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+))?\s*\]/g, (match, x, y, oldW) => {
      if (currentIdx === matchIdx) {
        currentIdx++;
        return `[${x}, ${y}${newWorldId !== "1" ? `, ${newWorldId}` : ""}]`;
      }
      currentIdx++;
      return match;
    });
    
    (n[blockIdx] as any).content = newContent;
    setActiveBlocks(n);
    toast.success("Monde mis à jour dans le texte !");
  };

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
        if (type === 'dungeon') url = `https://dofusdb.fr/fr/database/dungeon/${id}`;
        window.open(url, '_blank');
        return;
      }
    }

    // 2. Détection des positions [x, y] or [x, y, world]
    const text = target.innerText || "";
    const posMatch = text.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+))?\s*\]/);
    
    if (posMatch) {
      e.stopPropagation();
      const x = posMatch[1];
      const y = posMatch[2];
      const cmd = `/travel ${x} ${y}`;
      navigator.clipboard.writeText(cmd);
      toast.success(`Position ${posMatch[0]} copiée !`, {
        description: "La commande /travel est dans ton presse-papier.",
        icon: <Copy className="w-4 h-4 text-success" />,
      });
    }
  };

  const reload = async () => {
    if (!guide) return;
    const res = await getGuideAdminFull(guide.id);
    if (res.success && res.guide) {
      setMilestones(res.guide.milestones as any);
      // If we were editing a milestone, update it in the editor too
      if (editingMs) {
        const updated = res.guide.milestones.find((m: any) => m.id === editingMs.id);
        if (updated) setEditingMs(updated as any);
      }
    }
  };

  const loadProgress = async () => {
    if (!guide) return;
    setLoading(true);
    try {
      const res = await getGuildProgressSummary(guide.id);
      if (res.success) setProgress((res as any).allProgress || []);
    } catch { toast.error("Erreur stats"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "progress") loadProgress();
  }, [tab, guide?.id]);

  // 👑 SOCIAL HEATMAP: Pre-calculate active members per milestone
  const milestoneHeatmap = React.useMemo(() => {
    const map: Record<string, number> = {};
    progress.forEach(p => {
      if (!p.isCompleted) {
        map[p.milestoneId] = (map[p.milestoneId] || 0) + 1;
      }
    });
    return map;
  }, [progress]);

  const handleReset = async () => {
    if (!guide) return;
    if (!confirm(`Supprimer les ${milestones.length} milestones de "${guide.name}" ? Cette action est irréversible.`)) return;
    setLoading(true);
    try {
      await deleteAllMilestones(guide.id);
      setMilestones([]);
      toast.success("Milestones supprimés — prêt pour un nouvel import");
    } catch { toast.error("Erreur reset"); }
    finally { setLoading(false); }
  };

  const loadSubs = async () => {
    try { const res = await listSubGuides(); if (res.success) setImportedSubs(res.subs); } catch {}
  };

  const handleSubImport = async (files: File[]) => {
    if (!files.length) return;
    setSubLoading(true);
    const report: { ok: {ref: string; name: string; steps: number}[]; fail: {file: string; error: string}[] } = { ok: [], fail: [] };
    for (const file of files) {
      try {
        const json = JSON.parse(await file.text());
        const res = await importSubGuide(json);
        if (res.success) {
          report.ok.push({ ref: res.guideRef, name: res.guideName, steps: res.totalSteps });
        } else {
          report.fail.push({ file: file.name, error: (res as any).error ?? "Erreur inconnue" });
        }
      } catch (e: any) {
        report.fail.push({ file: file.name, error: e?.message ?? "JSON invalide" });
      }
    }
    setBatchReport(report);
    if (report.fail.length === 0) {
      toast.success(`✅ Batch terminé — ${report.ok.length} sous-guides importés`);
    } else {
      toast.error(`⚠️ ${report.ok.length} OK · ${report.fail.length} erreurs`);
    }
    await loadSubs();
    setSubLoading(false);
  };

  useEffect(() => { loadSubs(); }, []);

  const htmlToBlocks = (html: string): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove all checkboxes as requested
    doc.querySelectorAll('input[type="checkbox"]').forEach(i => i.remove());

    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        
        // 1. Specialized Royal Blocks
        if (el.dataset.type === 'quest-block' || el.classList.contains('quest-block')) {
          const dofusDbIdVal = el.getAttribute('dofusdbid') ? parseInt(el.getAttribute('dofusdbid')!, 10) : null;
          blocks.push({ 
            type: 'QUEST', 
            title: el.getAttribute('title') || el.textContent?.trim() || 'Quête', 
            id: el.getAttribute('questid') || el.getAttribute('id') || '', 
            name: el.getAttribute('questname') || el.getAttribute('name') || '',
            dofusDbId: dofusDbIdVal || undefined
          });
          return;
        }

        if (el.dataset.type === 'job-tag') {
          blocks.push({ type: 'JOB', name: el.getAttribute('name') || '', iconUrl: el.getAttribute('iconurl') || '' });
          return;
        }

        if (el.dataset.type === 'taskList' || el.tagName === 'UL') {
          el.querySelectorAll('li').forEach(li => {
            // Deep search for any DofusDB-related element
            const tagEl = li.querySelector('[data-type="custom-tag"], .tag-item, .tag-dungeon, .tag-monster, .tag-quest, [dofusdbid], img[src*="dofusdb.fr"], img[src*="ankama.com"]');
            
            if (tagEl) {
              const isDungeon = tagEl.classList.contains('tag-dungeon') || tagEl.getAttribute('type') === 'dungeon' || tagEl.getAttribute('href')?.includes('dungeon');
              const href = tagEl.getAttribute('href') || tagEl.getAttribute('src') || '';
              const dbMatch = href.match(/(object|item|dungeon|monster|quest|items|monsters|common|jobs)\/(\d+)/);
              const id = tagEl.getAttribute('data-id') || tagEl.getAttribute('dofusdbid') || tagEl.getAttribute('id') || dbMatch?.[2] || '';
              
              if (id) {
                // Try to find quantity in the LI text nodes
                const qtyMatch = li.textContent?.match(/(\d+)\s*x?$/) || li.textContent?.match(/^x?\s*(\d+)/);
                blocks.push({ 
                  type: 'TAG', 
                  tagType: isDungeon ? 'dungeon' : 'item',
                  name: tagEl.getAttribute('name') || tagEl.getAttribute('alt') || tagEl.textContent?.trim() || 'Objet/Donjon',
                  id: id,
                  imageUrl: tagEl.getAttribute('imageurl') || tagEl.getAttribute('src') || undefined,
                  quantity: tagEl.getAttribute('quantity') || qtyMatch?.[1] || undefined
                });
                return;
              }
            }
            
            // Fallback: If it's a structural task but not a DofusDB tag
            const cleanLabel = li.innerHTML.replace(/<input[^>]*checkbox[^>]*>/g, '').replace(/<span[^>]*checkbox[^>]*>.*?<\/span>/g, '').replace(/<\/?[^>]+(>|$)/g, "").trim();
            if (cleanLabel) blocks.push({ type: 'TASK', label: cleanLabel, checked: false });
          });
          return;
        }

        // 2. Intelligent DofusDB / TAG detection (Catching Ankama & DofusDB assets)
        const isTag = el.classList.contains('tag-item') || el.classList.contains('tag-dungeon') || el.classList.contains('tag-monster') || el.classList.contains('tag-quest') || el.dataset.type === 'custom-tag';
        const isDbLink = el.tagName === 'A' && (el.getAttribute('href')?.includes('dofusdb.fr') || el.getAttribute('href')?.includes('dofus-lab.io'));
        const isDbImg = el.tagName === 'IMG' && (
          el.getAttribute('src')?.includes('dofusdb.fr') || 
          el.getAttribute('src')?.includes('ankama.com') || 
          el.getAttribute('src')?.includes('dofus')
        );

        // 3. Standalone Image (check first to prevent it from being hijacked by tag parsing)
        if (el.tagName === 'IMG' && (el.classList.contains('guide-image') || (!isTag && !el.getAttribute('dofusdbid') && !el.getAttribute('data-id')))) {
          blocks.push({ type: 'IMAGE', url: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' });
          return;
        }

        if (isTag || isDbLink || isDbImg) {
          const isDungeon = el.classList.contains('tag-dungeon') || el.getAttribute('type') === 'dungeon' || el.getAttribute('href')?.includes('dungeon');
          const href = el.getAttribute('href') || el.getAttribute('src') || '';
          const dbMatch = href.match(/(object|item|dungeon|monster|quest|items|monsters|common|jobs)\/(\d+)/);
          const id = el.getAttribute('data-id') || el.getAttribute('dofusdbid') || el.getAttribute('id') || dbMatch?.[2] || '';
          
          if (id) {
            // Check if there was a preceding quantity text block we should merge
            let quantity = el.getAttribute('quantity') || undefined;
            if (!quantity && blocks.length > 0) {
               const last = blocks[blocks.length - 1];
               if (last.type === 'TEXT' && /^\d+\s*x?$/.test(last.content.trim())) {
                  quantity = last.content.trim().replace('x', '');
                  blocks.pop(); // Remove the fragmented quantity block
               }
            }

            blocks.push({ 
              type: 'TAG', 
              tagType: isDungeon ? 'dungeon' : 'item',
              name: el.getAttribute('name') || el.getAttribute('alt') || el.textContent?.trim() || 'Objet/Donjon',
              id: id,
              imageUrl: el.getAttribute('imageurl') || el.getAttribute('src') || undefined,
              quantity: quantity
            });
            return;
          }
        }

        // 4. Containers or Formatting
        // If it's a structural container with nested blocks, recurse. 
        // If it's just formatting (SPAN, B, I) or a container with only text/formatting, keep as TEXT.
        const structuralTags = ['DIV', 'P', 'SECTION', 'BR'];
        const hasSpecialChildren = el.querySelector('[data-type], .tag-item, .tag-dungeon, .tag-monster, .tag-quest, img, a[href*="dofusdb.fr"]') !== null;

        if (hasSpecialChildren || structuralTags.includes(el.tagName)) {
           Array.from(el.childNodes).forEach(child => walk(child));
        } else {
           const content = el.outerHTML.trim();
           // Only push if there's actual content or meaningful tags
           if (content && content !== '<br>' && (el.textContent?.trim() || el.querySelector('img, span, b, i'))) {
             blocks.push({ type: 'TEXT', content });
           }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          // Merge quantity logic
          if (/^\d+x?$/.test(text) && blocks.length > 0) {
            const last = blocks[blocks.length - 1];
            if (last.type === 'TAG') {
              (last as any).quantity = text.replace('x', '');
              return;
            }
          }
          blocks.push({ type: 'TEXT', content: text });
        }
      }
    };

    doc.body.childNodes.forEach(child => walk(child));
    
    // Merge consecutive text blocks to avoid fragmentation
    const merged: ContentBlock[] = [];
    blocks.forEach(b => {
      if (b.type === 'TEXT' && merged.length > 0 && merged[merged.length-1].type === 'TEXT') {
        (merged[merged.length-1] as any).content += ' ' + b.content;
      } else {
        merged.push(b);
      }
    });

    return merged.length > 0 ? merged : [{ type: 'TEXT', content: html }];
  };

  // 👑 State isolation: clear step editor when switching sequences
  useEffect(() => {
    setEditingStepIndex(null);
    setActiveBlocks([]);
    setEditorMode('VISUAL');
  }, [editingSeq?.id, editingSeq?.subGuideRef]);

  const blocksToHtml = (blocks: ContentBlock[]): string => {
    let html = "";
    let inTagGroup = false;

    blocks.forEach((b, idx) => {
      // Handle TAG grouping for grid layout
      if (b.type === 'TAG') {
        if (!inTagGroup) {
          html += "<ul>";
          inTagGroup = true;
        }
        const img = b.imageUrl ? `<img src="${b.imageUrl}" alt="${b.name}">` : '';
        const qty = b.quantity ? `<strong>${b.quantity}</strong>` : '';
        html += `<li class="tag-item" data-id="${b.id}" data-type="custom-tag" type="${b.tagType}" dofusdbid="${b.id}" name="${b.name}" imageurl="${b.imageUrl || ''}" quantity="${b.quantity || ''}">${img}${qty}<span>${b.name}</span></li>`;
      } else {
        if (inTagGroup) {
          html += "</ul>";
          inTagGroup = false;
        }

        if (b.type === 'QUEST') html += `<div data-type="quest-block" class="quest-block" title="${b.title}" questid="${b.id}" questname="${b.name}" dofusdbid="${b.dofusDbId || ''}"><p>${b.title}</p></div>`;
        else if (b.type === 'TASK') html += `<div class="tactical-step"><span class="bullet">▹</span> ${b.label}</div>`;
        else if (b.type === 'JOB') html += `<span data-type="job-tag" name="${b.name}" iconurl="${b.iconUrl}" class="flex items-center gap-1 text-warning font-bold"><img src="${b.iconUrl}" class="w-4 h-4"> ${b.name}</span>`;
        else if (b.type === 'IMAGE') html += `<img src="${b.url}" alt="${b.alt || ''}" class="guide-image" />`;
        else if (b.type === 'TEXT') html += b.content.startsWith('<p>') ? b.content : `<p>${b.content}</p>`;
      }

      // Close last group if needed
      if (idx === blocks.length - 1 && inTagGroup) {
        html += "</ul>";
      }
    });

    return html;
  };

  // 👑 Auto-load steps when opening Royal Composer
  useEffect(() => {
    if (editingSeq?.subGuideRef) {
      setLoading(true);
      getSubGuideSteps(editingSeq.subGuideRef)
        .then(res => {
          if (res.success) setSeqSteps(res.steps || []);
          else toast.error((res as any).error || "Erreur de chargement des étapes");
        })
        .finally(() => setLoading(false));
    } else {
      setSeqSteps([]);
    }
  }, [editingSeq?.subGuideRef]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter(m => {
      if (filterType !== "all" && m.type !== filterType) return false;
      
      if (filterSearch.trim() !== "") {
        const query = filterSearch.toLowerCase();
        const titleMatch = m.title.toLowerCase().includes(query);
        const descMatch = m.description?.toLowerCase().includes(query) ?? false;
        const subMatch = m.subtitle?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !descMatch && !subMatch) return false;
      }
      
      if (filterOptional === "required" && m.isOptional) return false;
      if (filterOptional === "optional" && !m.isOptional) return false;
      
      return true;
    });
  }, [milestones, filterType, filterSearch, filterOptional]);

  const chapters = useMemo(() => {
    return Array.from(new Set(filteredMilestones.map(m => m.chapter))).sort((a, b) => a - b);
  }, [filteredMilestones]);

  const byChapter = (ch: number) => filteredMilestones.filter(m => m.chapter === ch).sort((a, b) => a.order - b.order);

  const handleImport = async (file: File) => {
    if (!guide) return toast.error("Sélectionne un guide");
    setLoading(true);
    try {
      const json = JSON.parse(await file.text());
      const res = await importGanymedeGuide(guide.id, json);
      if (res.success) { toast.success(res.message ?? "Importé !"); await reload(); setTab("edit"); }
      else toast.error((res as any).error ?? "Erreur");
    } catch { toast.error("JSON invalide"); }
    finally { setLoading(false); }
  };

  const saveMilestone = async (ms: Milestone) => {
    setLoading(true);
    try {
      const res = await upsertMilestone({ ...ms, guideId: guide!.id });
      if (res.success) { 
        toast.success("Sauvegardé"); 
        await reload(); 
        // Don't close editor automatically to allow multi-sequence edits
      }
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Supprimer ce milestone ?")) return;
    await deleteMilestone(id); toast.success("Supprimé"); await reload(); setEditingMs(null);
  };

  const saveSeq = async () => {
    if (!editingSeq?.milestoneId) return;
    setLoading(true);
    try {
      await upsertSequence({ ...editingSeq as any, milestoneId: editingSeq.milestoneId, order: editingSeq.order ?? 1 });
      toast.success("Séquence sauvegardée"); 
      await reload(); 
      setEditingSeq(null);
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };

  const handleClone = async (ms: Milestone) => {
    const { id, sequences, ...data } = ms;
    setLoading(true);
    try {
      const res = await upsertMilestone({ 
        ...data, 
        guideId: guide!.id, 
        title: `${data.title} (Copie)`,
        order: data.order + 1 
      });
      if (res.success) {
        toast.success("Milestone dupliqué");
        await reload();
      }
    } catch { toast.error("Erreur clone"); }
    finally { setLoading(false); }
  };

  const moveMilestone = async (ms: Milestone, direction: 'up' | 'down') => {
    const sortedInChapter = byChapter(ms.chapter);
    const idx = sortedInChapter.findIndex(m => m.id === ms.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    if (targetIdx < 0 || targetIdx >= sortedInChapter.length) return;
    
    const target = sortedInChapter[targetIdx];
    const oldOrder = ms.order;
    const newOrder = target.order;
    
    setLoading(true);
    try {
      await Promise.all([
        upsertMilestone({ ...ms, guideId: guide!.id, order: newOrder }),
        upsertMilestone({ ...target, guideId: guide!.id, order: oldOrder })
      ]);
      await reload();
    } catch { toast.error("Erreur tri"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 lg:p-8">
      
      {/* ── HEADER: Guide Selector & Actions ──────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${guide?.slug.includes('gp0') ? 'bg-success/10 border-success/30' : 'bg-info/10 border-info/30'}`}>
            {guide?.slug.includes('gp0') ? <TreePine className="w-8 h-8 text-success" /> : <FileJson className="w-8 h-8 text-info" />}
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-3 leading-none">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-surface">
                Roadmap Architect
              </span>
            </h1>
            <p className="text-muted-foreground text-caption uppercase font-semibold tracking-wide mt-1">
              {guide?.slug.includes('gp0') ? "Orchestrateur Tactique (Maître)" : "Bibliothèque de Sous-Guide"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={guide?.id} 
            onChange={(e) => {
              const g = initialGuides.find(x => x.id === e.target.value);
              if (g) { setGuide(g); setMilestones(g.milestones); }
            }}
            className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:ring-2 ring-success/20 outline-none"
          >
            {initialGuides.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {firstGuildId ? (
            <a 
              href={`/dashboard/${firstGuildId}/quetes-dofus/guide/${guide?.slug}`} 
              target="_blank" 
              className="flex items-center gap-2 px-4 py-2.5 bg-surface/10 border border-border rounded-xl text-muted-foreground text-xs font-semibold hover:bg-elevated transition-all"
            >
              <Eye className="w-4 h-4" /> Preview
            </a>
          ) : (
            <span className="flex items-center gap-2 px-4 py-2.5 bg-surface/10 border border-border rounded-xl text-muted-foreground text-xs font-semibold cursor-not-allowed" title="Aucune guild active trouvée">
              <Eye className="w-4 h-4" /> Preview
            </span>
          )}
        </div>
      </div>

      {/* ── NAVIGATION: Tabs ──────────────────────────────── */}
      <div className="flex gap-2 bg-surface/50 rounded-xl p-1.5 border border-border shadow-inner">
        {[
          { id: "edit", label: "Architecture", icon: TreePine, color: "text-success" },
          { id: "import", label: "Import Ganymède", icon: FileJson, color: "text-info" },
          { id: "progress", label: "Analyse Membres", icon: Users, color: "text-accent" },
          { id: "settings", label: "Configuration", icon: Settings2, color: "text-muted-foreground" },
        ].map((t: any) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-caption font-semibold uppercase tracking-[0.2em] transition-all
              ${tab === t.id ? "bg-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className={`w-4 h-4 ${tab === t.id ? t.color : ""}`} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENT ────────────────────────────────────────── */}
      <div className="min-h-[600px]">
        <AnimatePresence mode="wait">
          
          {/* ── ARCHITECTURE TAB ───────────────────────────── */}
          {tab === "edit" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} 
              className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left: Chapter Tree */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex justify-between items-center bg-surface/40 p-6 rounded-xl border border-border">
                  <div className="flex items-center gap-8">
                    <div className="space-y-1">
                      <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Architecture Globale</div>
                      <div className="text-xl font-semibold text-foreground flex items-center gap-2">
                        {milestones.length} <span className="text-muted-foreground font-bold">Objectifs</span>
                      </div>
                    </div>
                    <div className="w-px h-10 bg-surface/10" />
                    <div className="space-y-1">
                      <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Social Radar</div>
                      <div className="text-xl font-semibold text-info flex items-center gap-2">
                        {progress.filter(m => !m.isCompleted).length} <span className="text-muted-foreground font-bold text-xs uppercase">Membres Actifs</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      const allOpen = expandedChapters.size === chapters.length;
                      setExpandedChapters(allOpen ? new Set() : new Set(chapters));
                    }}
                    className="px-4 py-2 bg-surface/10 hover:bg-elevated rounded-xl text-caption font-semibold uppercase tracking-wide text-muted-foreground transition-all"
                  >
                    {expandedChapters.size === chapters.length ? "Tout fermer" : "Tout déplier"}
                  </button>
                </div>
                  <button onClick={async () => {
                    if (!guide) return;
                    const lastMs = milestones[milestones.length - 1];
                    const nextOrder = (lastMs?.order ?? 0) + 1;
                    const nextCh = (lastMs?.chapter ?? 0) + 1;
                    const res = await upsertMilestone({ 
                      guideId: guide.id, 
                      title: "Nouveau Point d'Intérêt", 
                      type: "QUETE_SERIE", 
                      accentColor: "#10b981", 
                      order: nextOrder, 
                      chapter: nextCh, 
                      chapterLabel: `Chapitre ${nextCh}`,
                      posX: 0, posY: 0 
                    });
                    if (res.success) { await reload(); toast.success("Nouvel objectif créé"); }
                  }} className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-xl text-xs font-semibold hover:bg-success shadow-sm shadow-success/20 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" />Ajouter un Chapitre
                  </button>

                  {/* 🔍 Barre de filtres moderne et compacte */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface/60 p-4 rounded-xl border border-border shadow-sm">
                    {/* Recherche texte */}
                    <div className="relative">
                      <input 
                        type="text" 
                        value={filterSearch} 
                        onChange={e => setFilterSearch(e.target.value)} 
                        placeholder="Rechercher par mot-clé..." 
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:border-success/50 outline-none transition-colors"
                      />
                      {filterSearch && (
                        <button onClick={() => setFilterSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">×</button>
                      )}
                    </div>

                    {/* Filtre Type */}
                    <select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)} 
                      className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-success/50 outline-none transition-colors"
                    >
                      <option value="all">Tous types</option>
                      <option value="DOFUS">DOFUS</option>
                      <option value="DONJON">Donjon</option>
                      <option value="QUETE_SERIE">Quêtes en série</option>
                      <option value="MONSTRE">Recherche</option>
                      <option value="AUTRE">Autre</option>
                    </select>

                    {/* Filtre Optionnel */}
                    <select 
                      value={filterOptional} 
                      onChange={e => setFilterOptional(e.target.value)} 
                      className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-success/50 outline-none transition-colors"
                    >
                      <option value="all">Tous (Obligatoire / Bonus)</option>
                      <option value="required">Obligatoire uniquement</option>
                      <option value="optional">Bonus uniquement</option>
                    </select>
                  </div>

                  <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2 pb-40">
                  {chapters.map(ch => {
                    const items = byChapter(ch);
                    const label = items[0]?.chapterLabel ?? `Chapitre ${ch}`;
                    const isOpen = expandedChapters.has(ch);
                    return (
                      <div key={ch} className="group relative">
                        {/* Chapter Vertical Line */}
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-elevated/50 group-last:hidden" />
                        
                        <div className="bg-surface/50 border border-border rounded-xl overflow-hidden hover:border-border transition-colors">
                          <button onClick={() => setExpandedChapters(prev => { const s = new Set(prev); s.has(ch) ? s.delete(ch) : s.add(ch); return s; })}
                            className="w-full flex items-center justify-between p-5 bg-surface/80 hover:bg-elevated/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                              </div>
                              <div className="text-left">
                                <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block">Phase {ch}</span>
                                <span className="text-foreground font-semibold text-lg">{label}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground bg-surface/10 px-3 py-1 rounded-full border border-border">
                              {items.length} Objectifs
                            </span>
                          </button>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="p-4 space-y-3">
                                  {items.map((ms, idx) => (
                                    <div key={ms.id} onClick={() => setEditingMs(ms)}
                                      className={`group/ms relative flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border shadow-sm
                                        ${editingMs?.id === ms.id 
                                          ? "border-success/50 bg-success/10 shadow-success/10" 
                                          : "border-border bg-background/40 hover:border-border-strong hover:bg-surface"}`}>
                                      
                                      {/* Reorder Buttons (Visible on hover) */}
                                      <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/ms:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); moveMilestone(ms, 'up'); }} className="p-1 hover:text-foreground transition-colors"><ArrowUp className="w-4 h-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); moveMilestone(ms, 'down'); }} className="p-1 hover:text-foreground transition-colors"><ArrowDown className="w-4 h-4" /></button>
                                      </div>

                                      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden" 
                                        style={{ background: `${ms.accentColor}20`, border: `1px solid ${ms.accentColor}40` }}>
                                        <div className="absolute inset-0 blur-sm opacity-20" style={{ background: ms.accentColor }} />
                                        <span className="text-lg font-semibold relative" style={{ color: ms.accentColor }}>{idx + 1}</span>
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-foreground truncate">{ms.title}</div>
                                        {ms.sequences.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {ms.sequences.map(s => (
                                              <span key={s.id} className="text-caption px-1.5 py-0.5 rounded bg-elevated text-muted-foreground border border-border">
                                                {s.subGuideRef} : {s.subGuideName}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* HEATMAP BADGE */}
                                      {milestoneHeatmap[ms.id] > 0 && (
                                        <div className="px-3 py-1 bg-info/10 border border-info/20 rounded-full flex items-center gap-2">
                                          <Users className="w-3 h-3 text-info" />
                                          <span className="text-caption font-semibold text-info">{milestoneHeatmap[ms.id]}</span>
                                        </div>
                                      )}

                                      <span className={`text-caption px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${ms.isOptional ? "bg-accent/20 text-accent" : "bg-elevated text-muted-foreground"}`}>
                                        {ms.isOptional ? "Bonus" : ms.type}
                                      </span>

                                      <div className="flex items-center gap-2 opacity-0 group-hover/ms:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); handleClone(ms); }} className="p-2 hover:bg-elevated rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Dupliquer"><Copy className="w-4 h-4" /></button>
                                        <Edit3 className="w-4 h-4 text-success" />
                                      </div>
                                    </div>
                                  ))}
                                  
                                  <button onClick={async () => {
                                    if (!guide) return;
                                    const nextOrder = (items[items.length - 1]?.order ?? 0) + 1;
                                    const res = await upsertMilestone({ 
                                      guideId: guide.id, 
                                      title: "Nouvel Objectif", 
                                      type: "QUETE_SERIE", 
                                      accentColor: "#10b981", 
                                      order: nextOrder, 
                                      chapter: ch, 
                                      chapterLabel: label,
                                      posX: 0, posY: 0 
                                    });
                                    if (res.success) { await reload(); toast.success("Objectif ajouté au chapitre"); }
                                  }} className="w-full py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-muted-foreground hover:border-border transition-all text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2">
                                    <Plus className="w-4 h-4" /> Ajouter une étape à ce chapitre
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Detailed Editor */}
              <div className="lg:col-span-5 relative">
                <AnimatePresence mode="wait">
                  {editingMs ? (
                    <motion.div 
                      key={editingMs.id}
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-surface/80 border border-border rounded-xl p-6 sticky top-8 shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 bg-success rounded-full" />
                          <h3 className="text-xl font-semibold text-foreground">Éditeur de Mission</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => doDelete(editingMs.id)} className="p-2 hover:bg-destructive/10 rounded-xl text-destructive transition-colors" title="Supprimer définitivement">
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => setEditingMs(null)} className="p-2 hover:bg-elevated rounded-xl text-muted-foreground transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Titre de la Mission</label>
                            <input type="text" value={editingMs.title} onChange={e => setEditingMs(p => ({ ...p!, title: e.target.value }))}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground font-bold focus:border-success/50 outline-none transition-colors" />
                          </div>
                          
                          <div className="col-span-2">
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Sous-titre / Lore</label>
                            <input type="text" value={editingMs.subtitle ?? ""} onChange={e => setEditingMs(p => ({ ...p!, subtitle: e.target.value }))}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-muted-foreground text-sm focus:border-success/50 outline-none transition-colors italic" />
                          </div>

                          <div>
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">N° Chapitre</label>
                            <input type="number" value={editingMs.chapter} onChange={e => setEditingMs(p => ({ ...p!, chapter: parseInt(e.target.value) || 0 }))}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground font-bold outline-none" />
                          </div>
                          
                          <div>
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Nom Chapitre</label>
                            <input type="text" value={editingMs.chapterLabel} onChange={e => setEditingMs(p => ({ ...p!, chapterLabel: e.target.value }))}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground font-bold outline-none" />
                          </div>

                          <div>
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Accent Visuel</label>
                            <div className="flex items-center gap-3">
                              <input type="color" value={editingMs.accentColor} onChange={e => setEditingMs(p => ({ ...p!, accentColor: e.target.value }))} 
                                className="w-12 h-12 rounded-xl cursor-pointer bg-background border border-border p-1" />
                              <input value={editingMs.accentColor} onChange={e => setEditingMs(p => ({ ...p!, accentColor: e.target.value }))} 
                                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground font-mono text-xs outline-none" />
                            </div>
                          </div>

                          <div>
                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Catégorie</label>
                            <select value={editingMs.type} onChange={e => setEditingMs(p => ({ ...p!, type: e.target.value }))} 
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground font-bold outline-none appearance-none">
                              {["INFO", "SEPARATEUR", "DOFUS", "DONJON", "ALIGNEMENT", "QUETE_SERIE", "METIER", "PREREQUIS"].map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                      </div>

                        <div className="flex items-center gap-4 bg-background/50 p-4 rounded-xl border border-border">
                           <input type="checkbox" id="isOpt" checked={editingMs.isOptional} onChange={e => setEditingMs(p => ({ ...p!, isOptional: e.target.checked }))} 
                             className="w-5 h-5 accent-purple-500 rounded cursor-pointer" />
                           <label htmlFor="isOpt" className="flex-1 cursor-pointer">
                              <span className="block text-foreground font-semibold text-sm">Mission Optionnelle</span>
                              <span className="block text-caption text-muted-foreground uppercase font-bold">Ne bloque pas la progression principale</span>
                           </label>
                        </div>

                        {/* Sequences Editor */}
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em]">Instructions Tactiques</h4>
                            <button onClick={() => setEditingSeq({ milestoneId: editingMs.id, order: editingMs.sequences.length + 1, isOptional: false })} 
                              className="flex items-center gap-1 px-3 py-1 bg-success/10 text-success rounded-lg text-caption font-semibold hover:bg-success/20 transition-all">
                              <Plus className="w-3 h-3" /> NOUVELLE SÉQUENCE
                            </button>
                          </div>

                          <div className="space-y-3">
                            {editingMs.sequences.sort((a,b) => a.order - b.order).map(seq => (
                              <div key={seq.id} className="group/seq bg-background border border-border rounded-xl p-4 hover:border-border-strong transition-all">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-caption font-semibold text-success">
                                      {seq.subGuideRef.replace("GP", "")}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-foreground truncate">{seq.subGuideName}</div>
                                      <div className="text-caption text-muted-foreground font-bold mt-0.5">
                                        {seq.stepFrom ? `Étapes ${seq.stepFrom}${seq.stepTo ? ` → ${seq.stepTo}` : ""}` : "Guide Complet"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover/seq:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingSeq({ ...seq, milestoneId: editingMs.id })} className="p-1.5 hover:bg-elevated rounded-lg text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="w-4 h-4" /></button>
                                    <button onClick={async () => { if(confirm("Supprimer?")) { await deleteSequence(seq.id); await reload(); } }} className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>
                                {seq.note && (
                                  <div className="mt-3 text-caption bg-warning/5 text-warning/80 p-2 rounded-xl border border-warning/10 italic flex items-start gap-2">
                                    <Zap className="w-3 h-3 flex-shrink-0" /> {seq.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-4 pt-6">
                           <button onClick={() => setEditingMs(null)} className="flex-1 py-4 bg-elevated text-muted-foreground rounded-xl font-semibold text-xs hover:bg-elevated transition-colors">
                              ANNULER
                           </button>
                           <button onClick={() => saveMilestone(editingMs)} disabled={loading} 
                             className="flex-[2] py-4 bg-success text-success-foreground rounded-xl font-semibold text-xs hover:bg-success shadow-sm shadow-success/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                             SAUVEGARDER TOUT
                           </button>
                        </div>
                      </div>

                        {/* 👑 ROYAL COMPOSER: The Immersive Sequence Editor */}
                        <AnimatePresence>
                          {editingSeq && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 1.1 }} 
                              animate={{ opacity: 1, scale: 1 }} 
                              exit={{ opacity: 0, scale: 1.1 }}
                              className="fixed inset-0 z-[100] bg-background/98  flex flex-col overflow-hidden"
                            >
                              {/* Header bar */}
                              <div className="h-20 border-b border-border bg-surface/40 px-8 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                  <button onClick={() => { setEditingSeq(null); setSeqSteps([]); }} 
                                    className="p-3 hover:bg-elevated rounded-xl text-muted-foreground hover:text-foreground transition-all group">
                                    <ChevronRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                  </button>
                                  <div>
                                    <h4 className="text-foreground font-semibold text-xl flex items-center gap-3">
                                      Royal Composer
                                      <span className="text-caption font-semibold bg-success/10 text-success px-2 py-0.5 rounded border border-success/20 uppercase tracking-wide">v2.0</span>
                                    </h4>
                                    <p className="text-muted-foreground text-caption uppercase font-semibold tracking-[0.2em]">Édition avancée de la séquence tactique</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={async () => {
                                      if (!editingSeq.subGuideRef) return toast.error("Entrez une référence");
                                      setLoading(true);
                                      const res = await getSubGuideSteps(editingSeq.subGuideRef);
                                      if (res.success) { setSeqSteps(res.steps || []); toast.success(`${(res.steps || []).length} étapes synchronisées`); }
                                      else toast.error((res as any).error || "Erreur de chargement");
                                      setLoading(false);
                                    }}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-info/10 text-info rounded-xl text-caption font-semibold hover:bg-info/20 transition-all"
                                  >
                                    <Zap className="w-4 h-4" /> SYNCHRO GANYMÈDE
                                  </button>
                                  <button onClick={saveSeq} disabled={loading}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-success text-success-foreground rounded-xl text-xs font-semibold hover:bg-success shadow-sm shadow-success/20 active:scale-95 transition-all">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAUVEGARDER TOUT
                                  </button>
                                </div>
                              </div>

                              <div className="flex-1 flex overflow-hidden">
                                {/* Left: Structure & Meta */}
                                <div className="w-96 border-r border-border bg-surface/20 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                                  <div className="space-y-6">
                                    <div>
                                      <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Référence Tactique</label>
                                      <input value={editingSeq.subGuideRef ?? ""} onChange={e => setEditingSeq(p => ({ ...p!, subGuideRef: e.target.value.toUpperCase() }))}
                                        className="w-full bg-surface border border-border rounded-xl px-6 py-4 text-success font-mono text-center text-3xl font-semibold focus:border-success/50 outline-none" placeholder="GP..." />
                                    </div>
                                    
                                    <div>
                                      <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Nom du Segment</label>
                                      <input value={editingSeq.subGuideName ?? ""} onChange={e => setEditingSeq(p => ({ ...p!, subGuideName: e.target.value }))}
                                        className="w-full bg-surface border border-border rounded-xl px-5 py-4 text-foreground font-semibold text-sm focus:border-success/50 outline-none" placeholder="Titre de la quête..." />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Étape Début</label>
                                        <input type="number" value={editingSeq.stepFrom ?? ""} onChange={e => setEditingSeq(p => ({ ...p!, stepFrom: e.target.value ? parseInt(e.target.value) : undefined }))}
                                          className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-foreground font-semibold text-center outline-none" />
                                      </div>
                                      <div>
                                        <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Étape Fin</label>
                                        <input type="number" value={editingSeq.stepTo ?? ""} onChange={e => setEditingSeq(p => ({ ...p!, stepTo: e.target.value ? parseInt(e.target.value) : undefined }))}
                                          className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-foreground font-semibold text-center outline-none" />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Note Spéciale</label>
                                      <textarea value={editingSeq.note ?? ""} onChange={e => setEditingSeq(p => ({ ...p!, note: e.target.value }))}
                                        className="w-full bg-surface border border-border rounded-xl px-5 py-4 text-muted-foreground text-sm min-h-[100px] outline-none italic" placeholder="Instructions spécifiques pour ce segment..." />
                                    </div>
                                  </div>

                                  <div className="pt-8 border-t border-border">
                                    <div className="flex items-center gap-3 text-muted-foreground mb-6">
                                      <Users className="w-5 h-5" />
                                      <span className="text-xs font-semibold uppercase tracking-wide">Impact Cohorte</span>
                                    </div>
                                    <div className="p-5 rounded-xl bg-surface/50 border border-border text-caption text-muted-foreground font-bold leading-relaxed">
                                      Cette séquence sera ajoutée à l'arbre de progression de tous les membres de la guilde ayant activé ce guide.
                                    </div>
                                  </div>
                                </div>

                                {/* Main: Step Canvas */}
                                <div className="flex-1 bg-background p-12 overflow-y-auto custom-scrollbar relative">
                                  {loading && (
                                    <div className="absolute inset-0 z-50 bg-background/50  flex flex-col items-center justify-center space-y-4">
                                      <Loader2 className="w-12 h-12 text-success animate-spin" />
                                      <p className="text-muted-foreground font-semibold text-xs uppercase tracking-wide animate-pulse">Chargement du Plan de Bataille...</p>
                                    </div>
                                  )}

                                  <div className="max-w-4xl mx-auto space-y-12 pb-64">
                                    <div className="flex justify-between items-end border-b border-border pb-8">
                                      <div>
                                        <h2 className="text-4xl font-semibold text-foreground">Plan de Bataille</h2>
                                        <p className="text-muted-foreground mt-2 text-lg">
                                          {seqSteps.length > 0 ? `${seqSteps.length} étapes détectées pour ${editingSeq.subGuideRef}` : "Définissez les étapes tactiques et le contenu narratif"}
                                        </p>
                                      </div>
                                      <button onClick={() => {
                                        const nextNum = (seqSteps[seqSteps.length - 1]?.stepNumber ?? 0) + 1;
                                        setSeqSteps([...seqSteps, { stepNumber: nextNum, web_text: "<p>Nouvelle étape...</p>", plainText: "Nouvelle étape..." }]);
                                      }} className="px-6 py-3 bg-surface/10 hover:bg-elevated border border-border rounded-xl text-xs font-semibold text-foreground flex items-center gap-2 transition-all">
                                        <Plus className="w-4 h-4" /> AJOUTER UNE ÉTAPE
                                      </button>
                                    </div>

                                    {seqSteps.length === 0 && !loading && (
                                      <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                                        <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center text-foreground">
                                          <AlertTriangle className="w-12 h-12" />
                                        </div>
                          <div className="max-w-md">
                                          <h4 className="text-foreground font-semibold text-xl mb-2">Aucune étape en cache</h4>
                                          <p className="text-muted-foreground text-sm">Le guide <span className="text-success">{editingSeq.subGuideRef}</span> n'a pas encore été importé ou est vide.</p>
                                          <button 
                                            onClick={() => setTab("import")}
                                            className="mt-6 px-6 py-3 bg-elevated hover:bg-elevated text-foreground rounded-xl text-xs font-semibold transition-all"
                                          >
                                            ALLER À L'IMPORT
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    <div className="space-y-6">
                                      {(() => {
                                        const filtered = seqSteps.filter(s => 
                                          (!editingSeq.stepFrom || s.stepNumber >= editingSeq.stepFrom) && 
                                          (!editingSeq.stepTo || s.stepNumber <= editingSeq.stepTo)
                                        );

                                        if (seqSteps.length > 0 && filtered.length === 0) {
                                          return (
                                            <div className="py-20 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                                              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                                <AlertTriangle className="w-8 h-8" />
                                              </div>
                                              <div className="max-w-xs">
                                                <h4 className="text-foreground font-bold">Filtre trop restrictif</h4>
                                                <p className="text-muted-foreground text-xs mt-1">
                                                  Aucune étape ne correspond à la plage {editingSeq.stepFrom} → {editingSeq.stepTo || 'Fin'}.
                                                  Vérifiez les numéros d'étapes du guide {editingSeq.subGuideRef}.
                                                </p>
                                              </div>
                                              <button 
                                                onClick={() => setEditingSeq(p => ({ ...p!, stepFrom: undefined, stepTo: undefined }))}
                                                className="px-4 py-2 bg-elevated hover:bg-elevated text-foreground rounded-xl text-caption font-semibold transition-all"
                                              >
                                                EFFACER LE FILTRE
                                              </button>
                                            </div>
                                          );
                                        }

                                        return filtered.map((s, idx) => (
                                          <div key={idx} className="group relative">
                                          {/* Connecting Line */}
                                          <div className="absolute left-8 -bottom-6 w-0.5 h-6 bg-elevated/30 group-last:hidden" />
                                          
                                          <div className="bg-surface/40 border border-border rounded-xl p-8 hover:border-border transition-all">
                                            <div className="flex items-start justify-between gap-6 mb-6">
                                              <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-xl bg-elevated border border-border flex items-center justify-center text-2xl font-semibold text-success">
                                                  {s.stepNumber}
                                                </div>
                                                <div>
                                                  <h5 className="text-foreground font-semibold text-xl">{s.name || `Étape Tactique #${s.stepNumber}`}</h5>
                                                  <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                      <TreePine className="w-3 h-3" /> {editingSeq.subGuideRef}
                                                    </span>
                                                    {s.map && <span className="text-caption font-semibold text-info uppercase tracking-wide flex items-center gap-1">
                                                      <Zap className="w-3 h-3" /> {s.map} [{s.pos_x}, {s.pos_y}]
                                                    </span>}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => {
                                                  if(confirm("Supprimer cette étape?")) {
                                                    const next = [...seqSteps];
                                                    next.splice(idx, 1);
                                                    setSeqSteps(next);
                                                  }
                                                }} className="p-3 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                                                <button onClick={() => {
                                                  if (editingStepIndex === idx) {
                                                    setEditingStepIndex(null);
                                                    setActiveBlocks([]);
                                                  } else {
                                                    setEditingStepIndex(idx);
                                                    setActiveBlocks(htmlToBlocks(s.web_text));
                                                    setEditorMode('VISUAL');
                                                  }
                                                }}
                                                  className={`p-4 rounded-xl transition-all ${editingStepIndex === idx ? "bg-success text-success-foreground" : "bg-surface/10 text-muted-foreground hover:text-foreground"}`}>
                                                  {editingStepIndex === idx ? <Check className="w-6 h-6" /> : <Edit3 className="w-6 h-6" />}
                                                </button>
                                              </div>
                                            </div>

                                            {editingStepIndex === idx ? (
                                              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                                
                                                {/* Tabs: Visual / Code */}
                                                <div className="flex gap-2 p-1 bg-background rounded-xl border border-border w-fit">
                                                  <button onClick={() => {
                                                    if (editorMode === 'CODE') setActiveBlocks(htmlToBlocks(s.web_text));
                                                    setEditorMode('VISUAL');
                                                  }} 
                                                    className={`px-4 py-1.5 rounded-xl text-caption font-semibold uppercase tracking-wide transition-all ${editorMode === 'VISUAL' ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Visual</button>
                                                  <button onClick={() => {
                                                    if (editorMode === 'VISUAL') {
                                                      const html = blocksToHtml(activeBlocks);
                                                      const next = [...seqSteps];
                                                      next[idx].web_text = html;
                                                      setSeqSteps(next);
                                                    }
                                                    setEditorMode('CODE');
                                                  }} 
                                                    className={`px-4 py-1.5 rounded-xl text-caption font-semibold uppercase tracking-wide transition-all ${editorMode === 'CODE' ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Code (HTML)</button>
                                                </div>

                                                {editorMode === 'VISUAL' ? (
                                                  <div className="space-y-4">
                                                    {activeBlocks.map((block, bIdx) => (
                                                      <div key={bIdx} className="group/block relative bg-background border border-border rounded-xl p-4 hover:border-success/30 transition-all">
                                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity">
                                                           <button onClick={() => {
                                                              const next = [...activeBlocks];
                                                              next.splice(bIdx, 1);
                                                              setActiveBlocks(next);
                                                           }} className="p-1 bg-destructive text-destructive-foreground rounded-full"><X className="w-3 h-3" /></button>
                                                        </div>

                                                        {block.type === 'TAG' && (
                                                          <div className="flex items-center gap-6 p-2">
                                                            {/* Mini Tactical Card Preview */}
                                                            <div className="w-24 h-24 bg-surface rounded-xl flex flex-col items-center justify-center border border-border relative overflow-hidden flex-shrink-0 group/card">
                                                              {block.imageUrl ? (
                                                                <img src={block.imageUrl} className="w-16 h-16 object-contain z-10" />
                                                              ) : (
                                                                <Package className="w-8 h-8 text-foreground" />
                                                              )}
                                                              {block.quantity && (
                                                                <div className="absolute top-1 right-1 bg-info text-info-foreground text-caption font-semibold px-1.5 py-0.5 rounded shadow-sm z-20">
                                                                  {block.quantity}
                                                                </div>
                                                              )}
                                                              <div className="absolute inset-0 bg-info/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                            </div>

                                                            <div className="flex-1 space-y-3 relative">
                                                              <div className="flex items-center gap-2">
                                                                <div className={`text-caption font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${block.tagType === 'item' ? 'bg-info/10 text-info border border-info/20' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                                                                  {block.tagType === 'item' ? 'Objet / Ressource' : 'Donjon / Boss'}
                                                                </div>
                                                                <button onClick={() => {
                                                                  const url = `https://dofusdb.fr/fr/database/${block.tagType}/${block.id}`;
                                                                  window.open(url, '_blank');
                                                                }} className="text-muted-foreground hover:text-info transition-colors">
                                                                  <ExternalLink className="w-3 h-3" />
                                                                </button>
                                                              </div>

                                                              <div className="flex flex-col gap-2">
                                                                <div className="relative">
                                                                  <input value={block.name} 
                                                                    onChange={async (e) => { 
                                                                      const val = e.target.value;
                                                                      const n = [...activeBlocks]; (n[bIdx] as any).name = val; setActiveBlocks(n); 
                                                                      
                                                                      if (val.length > 2) {
                                                                        setSearchingBlockIdx(bIdx);
                                                                        setIsSearching(true);
                                                                        const res = block.tagType === 'item' ? await searchItemsDofusDB(val) : await searchDungeonsLocal(val);
                                                                        if (res.success) setSearchResults(res.data || []);
                                                                        setIsSearching(false);
                                                                      } else {
                                                                        setSearchingBlockIdx(null);
                                                                      }
                                                                    }} 
                                                                    className="w-full bg-surface/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-semibold text-sm focus:border-info/50 outline-none transition-all" placeholder="Nom de l'item..." />
                                                                  
                                                                  {/* Search Results Dropdown */}
                                                                  {searchingBlockIdx === bIdx && searchResults.length > 0 && (
                                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-sm z-[150] overflow-hidden max-h-64 overflow-y-auto custom-scrollbar ">
                                                                      {searchResults.map((r: any) => (
                                                                        <button key={r.id} onClick={() => {
                                                                          const n = [...activeBlocks];
                                                                          (n[bIdx] as any).name = r.name;
                                                                          (n[bIdx] as any).id = r.id;
                                                                          (n[bIdx] as any).imageUrl = r.imageUrl;
                                                                          setActiveBlocks(n);
                                                                          setSearchingBlockIdx(null);
                                                                          setSearchResults([]);
                                                                        }} className="w-full flex items-center gap-4 p-3 hover:bg-elevated text-left border-b border-border last:border-none transition-colors">
                                                                          <img src={r.imageUrl} className="w-10 h-10 object-contain" />
                                                                          <div className="flex-1 min-w-0">
                                                                            <div className="text-foreground text-xs font-semibold truncate">{r.name}</div>
                                                                            <div className="text-muted-foreground text-caption uppercase font-bold">Nv. {r.level} • ID: {r.id}</div>
                                                                          </div>
                                                                        </button>
                                                                      ))}
                                                                    </div>
                                                                  )}
                                                                </div>
                                                                
                                                                <div className="flex gap-2">
                                                                  <div className="flex-1 relative">
                                                                     <input value={block.id} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).id = e.target.value; setActiveBlocks(n); }} 
                                                                       className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-muted-foreground font-mono text-caption outline-none" placeholder="ID DofusDB" />
                                                                  </div>
                                                                  <div className="w-20 relative">
                                                                     <input value={block.quantity || ''} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).quantity = e.target.value; setActiveBlocks(n); }} 
                                                                       className="w-full bg-background border border-info/30 rounded-lg px-3 py-1.5 text-info font-semibold text-xs text-center outline-none" placeholder="Qté" />
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )}

                                                        {block.type === 'QUEST' && (
                                                          <div className="flex items-center gap-6 p-2">
                                                            {/* Mini Tactical Card Preview */}
                                                            <div className="w-24 h-24 bg-surface rounded-xl flex flex-col items-center justify-center border border-border relative overflow-hidden flex-shrink-0 group/card">
                                                              <Package className="w-8 h-8 text-foreground" />
                                                              <div className="absolute inset-0 bg-success/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                            </div>

                                                            <div className="flex-1 space-y-3 relative">
                                                              <div className="text-caption font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-success/10 text-success border border-success/20 w-fit">
                                                                Quête / Succès
                                                              </div>

                                                              <div className="flex flex-col gap-2">
                                                                <input value={block.title} 
                                                                  onChange={(e) => { 
                                                                    const n = [...activeBlocks]; 
                                                                    (n[bIdx] as any).title = e.target.value; 
                                                                    setActiveBlocks(n); 
                                                                  }} 
                                                                  className="w-full bg-surface/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-semibold text-sm focus:border-info/50 outline-none transition-all" placeholder="Titre d'affichage de la quête..." />
                                                                
                                                                <div className="flex gap-2">
                                                                  <input value={block.name} 
                                                                    onChange={(e) => { 
                                                                      const n = [...activeBlocks]; 
                                                                      (n[bIdx] as any).name = e.target.value; 
                                                                      setActiveBlocks(n); 
                                                                    }} 
                                                                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-foreground font-bold text-xs outline-none" placeholder="Nom de la quête" />
                                                                  
                                                                  <input value={block.id} 
                                                                    onChange={(e) => { 
                                                                      const n = [...activeBlocks]; 
                                                                      (n[bIdx] as any).id = e.target.value; 
                                                                      setActiveBlocks(n); 
                                                                    }} 
                                                                    className="w-32 bg-background border border-border rounded-lg px-3 py-1.5 text-muted-foreground font-mono text-caption outline-none" placeholder="ID" />
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )}

                                                        {block.type === 'IMAGE' && (
                                                          <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-caption font-semibold text-accent uppercase tracking-wide"><Package className="w-3 h-3" /> Bloc Image / Illustration</div>
                                                            <div className="flex items-center gap-4 bg-surface border border-border p-4 rounded-xl group/img">
                                                              <div className="w-24 h-24 bg-background rounded-xl overflow-hidden border border-border group-hover/img:border-success/50 transition-all flex items-center justify-center">
                                                                <img src={block.url} className="w-full h-full object-contain" />
                                                              </div>
                                                              <div className="flex-1 space-y-2">
                                                                <input value={block.url} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).url = e.target.value; setActiveBlocks(n); }} 
                                                                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-muted-foreground text-caption font-mono" placeholder="URL Image..." />
                                                                <input value={block.alt || ''} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).alt = e.target.value; setActiveBlocks(n); }} 
                                                                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs font-bold" placeholder="Description (Alt)..." />
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )}

                                                        {block.type === 'JOB' && (
                                                          <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center border border-warning/20">
                                                              <img src={block.iconUrl} className="w-8 h-8 object-contain" />
                                                            </div>
                                                            <div className="flex-1">
                                                              <div className="text-caption font-semibold text-warning uppercase tracking-wide">Métier Requis</div>
                                                              <div className="text-foreground font-semibold">{block.name}</div>
                                                            </div>
                                                          </div>
                                                        )}

                                                        {block.type === 'TASK' && (
                                                          <div className="flex items-center gap-4">
                                                            <div className="w-6 h-6 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success font-semibold text-sm">▹</div>
                                                            <input value={block.label} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).label = e.target.value; setActiveBlocks(n); }} 
                                                              className="flex-1 bg-transparent border-none text-foreground font-medium outline-none" placeholder="Instruction tactique..." />
                                                          </div>
                                                        )}

                                                        {block.type === 'TEXT' && (
                                                          <div className="space-y-3">
                                                            {/* Rendered Preview for HTML content */}
                                                            {(block.content.includes('<') || block.content.includes('/>') || block.content.includes('&') || block.content.includes('[')) && (
                                                              <div className="p-4 bg-surface/50 rounded-xl border border-border ganymade-step-text text-sm cursor-default" onClick={handleTextClick}>
                                                                <div className="text-caption font-semibold text-success uppercase tracking-wide mb-2 opacity-50">Aperçu Rendu</div>
                                                                <div dangerouslySetInnerHTML={{ __html: fixBrokenImages(sanitizeHtml(
                                                                  block.content.replace(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+))?\s*\]/g, '<span class="pos-interactive">$&</span>')
                                                                )) ?? "" }} />
                                                              </div>
                                                            )}
                                                            <div className="relative group/textarea">
                                                              <div className="absolute top-2 right-2 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                                                                <Eye className="w-4 h-4 text-muted-foreground" />
                                                              </div>
                                                              <textarea value={block.content} onChange={e => { const n = [...activeBlocks]; (n[bIdx] as any).content = e.target.value; setActiveBlocks(n); }} 
                                                                className="w-full bg-transparent border-none text-muted-foreground font-mono text-xs min-h-[60px] outline-none resize-none focus:text-foreground transition-colors" placeholder="Texte libre (HTML supporté)..." />
                                                            </div>

                                                            {/* Coordinates Detector & Editor for existing hardcoded positions */}
                                                            {(() => {
                                                              const matches = Array.from(block.content.matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+))?\s*\]/g));
                                                              if (matches.length === 0) return null;
                                                              return (
                                                                <div className="p-3 bg-background/40 border border-border rounded-xl space-y-2">
                                                                  <div className="text-caption font-semibold text-warning uppercase tracking-wide flex items-center gap-1.5">
                                                                    <Package size={12} className="text-warning" />
                                                                    Positions détectées dans le texte ({matches.length})
                                                                  </div>
                                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {matches.map((match, mIdx) => {
                                                                      const x = match[1];
                                                                      const y = match[2];
                                                                      const w = match[3] || "1";
                                                                      return (
                                                                        <div key={mIdx} className="p-2 bg-surface/40 border border-border rounded-xl flex items-center justify-between gap-3 hover:border-border transition-all">
                                                                          <div className="flex items-center gap-2">
                                                                            <span className="text-caption font-mono font-semibold text-info bg-background px-2 py-1 rounded-lg">
                                                                              [{x}, {y}]
                                                                            </span>
                                                                          </div>
                                                                          <div className="relative flex-1 max-w-[200px]">
                                                                            <select
                                                                              value={w}
                                                                              onChange={(e) => updateCoordinateWorld(bIdx, mIdx, e.target.value)}
                                                                              className="w-full bg-background hover:bg-background border border-border hover:border-info/30 focus:border-info rounded-lg pl-3 pr-8 py-1 text-caption font-bold text-foreground outline-none appearance-none transition-all cursor-pointer"
                                                                            >
                                                                              {DOFUS_WORLDS.map(world => (
                                                                                <option key={world.id} value={world.id} className="bg-background text-foreground py-1">
                                                                                  {world.name} ({world.id})
                                                                                </option>
                                                                              ))}
                                                                            </select>
                                                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                                                              <ChevronDown size={10} />
                                                                            </div>
                                                                          </div>
                                                                        </div>
                                                                      );
                                                                    })}
                                                                  </div>
                                                                </div>
                                                              );
                                                            })()}

                                                            {/* Coordinates Generator / Position Assistant */}
                                                            <div className="p-3 bg-background/60 border border-border rounded-xl flex flex-wrap items-center gap-3">
                                                              <div className="flex items-center gap-1.5">
                                                                <span className="text-caption font-semibold text-info uppercase tracking-wider">X:</span>
                                                                <input type="number" id={`px-${bIdx}`} placeholder="0" className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground text-center outline-none" />
                                                              </div>
                                                              <div className="flex items-center gap-1.5">
                                                                <span className="text-caption font-semibold text-info uppercase tracking-wider">Y:</span>
                                                                <input type="number" id={`py-${bIdx}`} placeholder="0" className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground text-center outline-none" />
                                                              </div>
                                                              <div className="flex items-center gap-1.5 flex-1 min-w-[200px] relative">
                                                                <span className="text-caption font-semibold text-info uppercase tracking-wider mr-1.5">Monde:</span>
                                                                <div className="relative flex-1">
                                                                  <select id={`pw-${bIdx}`} className="w-full bg-surface border border-border hover:border-info/30 focus:border-info rounded-lg pl-3 pr-8 py-1 text-xs font-bold text-foreground outline-none appearance-none transition-all cursor-pointer">
                                                                    {DOFUS_WORLDS.map(world => (
                                                                      <option key={world.id} value={world.id} className="bg-background text-foreground py-1">
                                                                        {world.name} ({world.id})
                                                                      </option>
                                                                    ))}
                                                                  </select>
                                                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                                                    <ChevronDown size={11} />
                                                                  </div>
                                                                </div>
                                                              </div>
                                                              <button
                                                                onClick={() => {
                                                                  const xInput = document.getElementById(`px-${bIdx}`) as HTMLInputElement;
                                                                  const yInput = document.getElementById(`py-${bIdx}`) as HTMLInputElement;
                                                                  const wSelect = document.getElementById(`pw-${bIdx}`) as HTMLSelectElement;
                                                                  if (xInput && yInput && wSelect) {
                                                                    const x = xInput.value || "0";
                                                                    const y = yInput.value || "0";
                                                                    const w = wSelect.value;
                                                                    const tag = ` [${x}, ${y}${w !== "1" ? `, ${w}` : ""}]`;
                                                                    const n = [...activeBlocks];
                                                                    (n[bIdx] as any).content = (n[bIdx] as any).content + tag;
                                                                    setActiveBlocks(n);
                                                                    toast.success("Position insérée !");
                                                                    xInput.value = "";
                                                                    yInput.value = "";
                                                                  }
                                                                }}
                                                                className="px-3 py-1 bg-info/10 hover:bg-info/20 border border-info/20 text-info text-caption font-semibold uppercase tracking-wider rounded-lg transition-all"
                                                              >
                                                                Insérer
                                                              </button>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))}

                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'TEXT', content: '' }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-muted-foreground border border-border">+ TEXTE</button>
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'TASK', label: '', checked: false }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-muted-foreground border border-border">+ TÂCHE</button>
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'QUEST', title: '', id: '', name: '' }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-muted-foreground border border-border">+ QUÊTE</button>
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'TAG', tagType: 'item', name: '', id: '' }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-info border border-border">+ OBJET</button>
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'TAG', tagType: 'dungeon', name: '', id: '' }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-accent border border-border">+ DONJON</button>
                                                      <button onClick={() => setActiveBlocks([...activeBlocks, { type: 'IMAGE', url: '', alt: '' }])} className="px-4 py-2 bg-surface hover:bg-elevated rounded-xl text-caption font-semibold text-accent border border-border">+ IMAGE</button>
                                                      
                                                      <div className="relative">
                                                        <button 
                                                          onClick={() => setShowJobPicker(!showJobPicker)}
                                                          className={`px-4 py-2 rounded-xl text-caption font-semibold border transition-all ${showJobPicker ? 'bg-warning text-warning-foreground border-warning' : 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'}`}
                                                        >
                                                          + MÉTIER
                                                        </button>
                                                        
                                                        {showJobPicker && (
                                                          <div className="absolute bottom-full left-0 mb-4 p-3 bg-surface border border-border rounded-xl grid grid-cols-4 gap-2 z-[110] w-72 shadow-sm animate-in zoom-in-95 fade-in duration-200">
                                                            <div className="col-span-4 px-2 pb-2 border-b border-border mb-1 flex justify-between items-center">
                                                              <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Sélecteur de Métier</span>
                                                              <button onClick={() => setShowJobPicker(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                                                            </div>
                                                            {[
                                                              { id: 1, name: 'Bûcheron' }, { id: 2, name: 'Mineur' }, { id: 26, name: 'Alchimiste' }, { id: 28, name: 'Paysan' },
                                                              { id: 24, name: 'Pêcheur' }, { id: 27, name: 'Chasseur' }, { id: 11, name: 'Forgeron' }, { id: 13, name: 'Sculpteur' },
                                                              { id: 15, name: 'Cordonnier' }, { id: 16, name: 'Bijoutier' }, { id: 20, name: 'Tailleur' }, { id: 60, name: 'Façonneur' }
                                                            ].map(job => (
                                                              <button key={job.id} 
                                                                onClick={() => {
                                                                  setActiveBlocks([...activeBlocks, { type: 'JOB', name: job.name, iconUrl: `https://static.ankama.com/dofus/www/game/items/200/${job.id}.png` || `https://api.dofusdb.fr/img/jobs/${job.id}.png` }]);
                                                                  setShowJobPicker(false);
                                                                }}
                                                                className="p-3 hover:bg-elevated rounded-xl transition-all flex flex-col items-center gap-1 group/jbtn" title={job.name}>
                                                                <img src={`https://static.ankama.com/dofus/www/game/items/200/${job.id}.png` || `https://api.dofusdb.fr/img/jobs/${job.id}.png`} className="w-10 h-10 object-contain group-hover/jbtn:scale-110 transition-transform" />
                                                                <span className="text-caption font-bold text-muted-foreground group-hover/jbtn:text-warning truncate w-full text-center">{job.name}</span>
                                                              </button>
                                                            ))}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <textarea 
                                                    value={s.web_text} 
                                                    onChange={(e) => {
                                                      const next = [...seqSteps];
                                                      next[idx].web_text = e.target.value;
                                                      setSeqSteps(next);
                                                    }}
                                                    className="w-full bg-background border-2 border-success/20 rounded-xl p-8 text-foreground font-mono text-sm min-h-[300px] focus:border-success/50 outline-none transition-all shadow-inner"
                                                    placeholder="HTML Ganymède..."
                                                  />
                                                )}

                                                <div className="flex gap-4 pt-4">
                                                  <button onClick={async () => {
                                                    setLoading(true);
                                                    const finalHtml = editorMode === 'VISUAL' ? blocksToHtml(activeBlocks) : s.web_text;
                                                    await updateSubGuideStep(editingSeq.subGuideRef!, s.stepNumber, { web_text: finalHtml });
                                                    toast.success("Étape enregistrée en base");
                                                    setEditingStepIndex(null);
                                                    setActiveBlocks([]);
                                                    setLoading(false);
                                                  }} className="flex-1 py-4 bg-success text-success-foreground rounded-xl font-semibold text-sm hover:bg-success transition-all flex items-center justify-center gap-2">
                                                    <Check className="w-5 h-5" /> APPLIQUER LES CHANGEMENTS
                                                  </button>
                                                  <button onClick={() => { setEditingStepIndex(null); setActiveBlocks([]); }} className="px-8 py-4 bg-elevated text-muted-foreground rounded-xl font-semibold text-sm">ANNULER</button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="relative group/content">
                                                <div className="p-8 bg-background/50 rounded-xl border border-border text-foreground text-lg leading-relaxed guide-content-preview ganymade-step-text cursor-default" 
                                                  onClick={handleTextClick}
                                                  dangerouslySetInnerHTML={{ __html: fixBrokenImages(sanitizeHtml((s.web_text || "")
                                                    .replace(/<input[^>]*type="checkbox"[^>]*>/g, '')
                                                    .replace(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g, '<span class="pos-interactive">$&</span>') 
                                                  )) || "" }} />
                                                <div className="absolute inset-0 bg-success/5 opacity-0 group-hover/content:opacity-100 transition-opacity rounded-xl pointer-events-none border border-success/20" />
                                              </div>
                                            )}
                                           </div>
                                         </div>
                                       ))
                                     })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </motion.div>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center bg-surface/40 border-2 border-dashed border-border rounded-xl text-center px-12 space-y-4">
                      <div className="w-20 h-20 rounded-full bg-elevated flex items-center justify-center text-foreground">
                        <Edit3 className="w-10 h-10" />
                      </div>
                      <div>
                        <h4 className="text-foreground font-semibold text-lg">Aucun Objectif Sélectionné</h4>
                        <p className="text-muted-foreground text-xs mt-1">Choisissez une mission dans l'arbre à gauche pour modifier ses paramètres ou ajouter des séquences tactiques.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── IMPORT TAB ─────────────────────────────────── */}
          {tab === "import" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8 max-w-5xl mx-auto">
              
              <div className="bg-surface/50 border border-border rounded-xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <Upload className="w-32 h-32" />
                </div>
                
                <h3 className="text-2xl font-semibold text-foreground mb-2 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-success text-success-foreground flex items-center justify-center text-lg font-semibold italic">1</span>
                  Import Guide Maître (GP0)
                </h3>
                <p className="text-muted-foreground text-sm mb-8 max-w-2xl">Le fichier GP0 définit la structure globale de votre roadmap. Il contient les noms des chapitres et les liens vers les sous-guides.</p>

                <div className={`border-2 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer bg-background/50
                  ${loading ? "border-success bg-success/5" : "border-border hover:border-success/30 hover:bg-surface/80"}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImport(f); }}>
                  {loading ? <Loader2 className="w-16 h-16 text-success animate-spin mx-auto mb-6" /> : <Upload className="w-16 h-16 text-foreground mx-auto mb-6" />}
                  <h4 className="text-foreground font-semibold text-xl mb-2">Déposez le JSON GP0</h4>
                  <p className="text-muted-foreground text-sm mb-8">Exportez-le depuis Ganymède (ID 2747)</p>
                  
                  <label className="cursor-pointer px-8 py-4 bg-success text-success-foreground rounded-xl font-semibold text-sm hover:bg-success shadow-sm shadow-success/20 transition-all active:scale-95 inline-flex items-center gap-3">
                    <Plus className="w-5 h-5" /> Parcourir les fichiers
                    <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-surface/50 border border-border rounded-xl p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-info text-info-foreground flex items-center justify-center text-sm font-semibold italic">2</span>
                    Batch Import Sous-Guides
                  </h3>
                  
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer bg-background/50
                    ${subLoading ? "border-info bg-info/5" : "border-border hover:border-info/30"}`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".json"));
                      if (files.length) handleSubImport(files);
                    }}>
                    <FileJson className={`w-12 h-12 mx-auto mb-4 ${subLoading ? "text-info animate-pulse" : "text-foreground"}`} />
                    <p className="text-muted-foreground text-sm font-bold mb-6">Glissez GP1.json, GP2.json... ici</p>
                    
                    <label className="cursor-pointer px-5 py-3 bg-info text-info-foreground rounded-xl font-semibold text-xs hover:bg-info transition-all inline-block">
                      Importer en masse
                      <input type="file" accept=".json" multiple className="hidden" onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) handleSubImport(files);
                        e.target.value = "";
                      }} />
                    </label>
                  </div>
                </div>

                <div className="bg-surface/50 border border-border rounded-xl p-8">
                  <h4 className="text-muted-foreground font-semibold text-caption uppercase tracking-[0.2em] mb-4">Bibliothèque Tactique ({importedSubs.length})</h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
                    {importedSubs.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center text-foreground italic text-xs">
                        <AlertTriangle className="w-8 h-8 mb-2 opacity-20" />
                        Aucun sous-guide en cache
                      </div>
                    ) : (
                      importedSubs.sort((a,b) => {
                        const ra = parseInt(a.guideRef.replace(/\D/g, '')) || 0;
                        const rb = parseInt(b.guideRef.replace(/\D/g, '')) || 0;
                        return ra - rb;
                      }).map(sub => (
                        <div key={sub.id} className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border group hover:border-border transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-info font-semibold text-xs">[{sub.guideRef}]</span>
                            <span className="text-foreground text-xs font-bold truncate">{sub.guideName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-caption font-semibold text-muted-foreground bg-surface px-2 py-1 rounded-lg border border-border">{sub.totalSteps} ét.</span>
                            <button 
                              onClick={async () => {
                                if (!confirm(`Supprimer le sous-guide ${sub.guideRef} ? Cette action le retirera de toutes les séquences l'utilisant.`)) return;
                                try {
                                  const res = await deleteSubGuide(sub.guideRef);
                                  if (res.success) {
                                    toast.success(res.message);
                                    await loadSubs();
                                  }
                                } catch (e: any) {
                                  toast.error(e.message || "Erreur lors de la suppression");
                                }
                              }}
                              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg text-destructive transition-all"
                              title="Supprimer ce sous-guide"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Outil de réparation GP9/GP9B ── */}
                <div className="bg-warning/20 border border-warning/20 rounded-xl p-5 flex items-start gap-4">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-warning font-semibold text-xs uppercase tracking-wide mb-1">Réparation refs Alignement</p>
                    <p className="text-muted-foreground text-xs mb-3">Normalise GP9 = Bontarien et GP9B = Brâkmarien quel que soit l&apos;ordre d&apos;import. À lancer une seule fois après avoir importé les deux guides.</p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await repairAlignmentRefs();
                          if (res.success) {
                            toast.success(`✅ Réparé : ${res.fixedSubGuides} sous-guides, ${res.fixedSequences} séquences`);
                            await loadSubs();
                          } else {
                            toast.error((res as any).error ?? 'Erreur');
                          }
                        } catch (e: any) {
                          toast.error(e.message || 'Erreur lors de la réparation');
                        }
                      }}
                      className="px-4 py-2 bg-warning/10 border border-warning/30 hover:bg-warning/20 text-warning text-xs font-semibold rounded-xl transition-all"
                    >
                      🔧 Réparer GP9 / GP9B
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PROGRESS TAB ────────────────────────────────── */}
          {tab === "progress" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
               <div className="bg-surface/50 border border-border rounded-xl p-8 text-center">
                  <Users className="w-12 h-12 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground">Suivi de Cohorte</h3>
                  <p className="text-muted-foreground text-sm mt-1">Analysez l'avancement en temps réel de tous vos membres sur cette roadmap.</p>
                  
                  <button onClick={() => { loadProgress(); toast.info("Actualisation des données..."); }} className="mt-6 px-6 py-3 bg-elevated hover:bg-elevated text-foreground rounded-xl text-xs font-semibold uppercase tracking-wide transition-all">
                     Rafraîchir les statistiques
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {progress.length > 0 ? (
                    (() => {
                      const byMember = new Map<string, { profile: any; done: any[] }>();
                      progress.forEach(p => {
                        if (!byMember.has(p.profile.id)) byMember.set(p.profile.id, { profile: p.profile, done: [] });
                        byMember.get(p.profile.id)!.done.push(p.milestone);
                      });
                      return Array.from(byMember.values()).sort((a, b) => b.done.length - a.done.length).map(({ profile, done }) => {
                        const percent = Math.round((done.length / Math.max(milestones.length, 1)) * 100);
                        return (
                          <div key={profile.id} className="bg-surface/50 border border-border rounded-xl p-5 hover:border-accent/30 transition-all">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-xl border border-border overflow-hidden bg-elevated flex items-center justify-center text-foreground font-semibold text-lg flex-shrink-0">
                                {profile.user?.image ? <img src={profile.user.image} alt="" className="w-full h-full object-cover" /> : (profile.user?.name?.[0] ?? "?")}
                              </div>
                              <div className="min-w-0">
                                <div className="text-foreground font-semibold text-sm truncate">{profile.pseudoDofus || profile.user?.name}</div>
                                <div className="text-accent text-caption font-semibold uppercase tracking-wide mt-0.5">{percent}% de la route</div>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                               <div className="flex justify-between text-caption font-semibold text-muted-foreground uppercase">
                                  <span>Progression</span>
                                  <span>{done.length}/{milestones.length}</span>
                               </div>
                               <div className="h-2 bg-background rounded-full overflow-hidden border border-border p-0.5">
                                  <div className="h-full bg-gradient-to-r from-accent to-accent rounded-full" style={{ width: `${percent}%` }} />
                               </div>
                            </div>
                            
                            {done.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-border">
                                <p className="text-muted-foreground text-caption font-semibold uppercase tracking-wide mb-1">Dernière étape atteinte</p>
                                <p className="text-muted-foreground text-caption font-bold truncate">
                                   {[...done].sort((a, b) => b.order - a.order)[0]?.title}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="col-span-full py-12 text-center text-foreground font-bold italic">
                       Aucun membre n'a encore commencé cette épopée.
                    </div>
                  )}
               </div>
            </motion.div>
          )}

          {/* ── SETTINGS TAB ───────────────────────────────── */}
          {tab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto space-y-6">
               <div className="bg-surface/50 border border-border rounded-xl p-8 space-y-6">
                  <h3 className="text-foreground font-semibold text-xl flex items-center gap-3">
                     <Settings2 className="w-6 h-6 text-success" /> Options d'affichage & Statut
                  </h3>
                  
                  <div className="space-y-4">
                     {/* Active / Inactive */}
                     <div className="flex items-center justify-between p-4 bg-background/40 border border-border rounded-xl">
                        <div>
                           <span className="block text-foreground font-semibold text-sm">Activer le Guide</span>
                           <span className="block text-caption text-muted-foreground uppercase font-bold mt-0.5">Rend le guide visible par tous les membres</span>
                        </div>
                        <button
                           onClick={async () => {
                              if (!guide) return;
                              setLoading(true);
                              const res = await updateGuideSettings(guide.id, { isActive: !guide.isActive });
                              if (res.success) {
                                 setGuide({ ...guide, isActive: (res.guide as any).isActive });
                                 toast.success(`Guide ${(res.guide as any).isActive ? 'activé' : 'désactivé'}`);
                              }
                              setLoading(false);
                           }}
                           className={`px-4 py-2 text-caption font-semibold uppercase tracking-wide rounded-xl transition-all ${
                              guide?.isActive 
                                 ? "bg-success text-success-foreground hover:bg-success" 
                                 : "bg-elevated text-muted-foreground hover:bg-elevated"
                           }`}
                        >
                           {guide?.isActive ? "Actif" : "Inactif"}
                        </button>
                     </div>

                     {/* Under Construction Toggle */}
                     <div className="flex items-center justify-between p-4 bg-background/40 border border-border rounded-xl">
                        <div>
                           <span className="block text-foreground font-semibold text-sm">Mode Construction 🚧</span>
                           <span className="block text-caption text-muted-foreground uppercase font-bold mt-0.5">Affiche "En construction" aux membres (idéal pour rédiger au propre)</span>
                        </div>
                        <button
                           onClick={async () => {
                              if (!guide) return;
                              setLoading(true);
                              const nextVal = !(guide as any).isUnderConstruction;
                              const res = await updateGuideSettings(guide.id, { isUnderConstruction: nextVal });
                              if (res.success) {
                                 setGuide({ ...guide, isUnderConstruction: (res.guide as any).isUnderConstruction } as any);
                                 toast.success(`Mode construction ${(res.guide as any).isUnderConstruction ? 'activé' : 'désactivé'}`);
                              }
                              setLoading(false);
                           }}
                           className={`px-4 py-2 text-caption font-semibold uppercase tracking-wide rounded-xl transition-all ${
                              (guide as any)?.isUnderConstruction 
                                 ? "bg-warning text-warning-foreground hover:bg-warning" 
                                 : "bg-elevated text-muted-foreground hover:bg-elevated"
                           }`}
                        >
                           {(guide as any)?.isUnderConstruction ? "Actif" : "Désactivif"}
                        </button>
                     </div>

                     {/* Display Mode (TREE vs TIMELINE) */}
                     <div className="flex items-center justify-between p-4 bg-background/40 border border-border rounded-xl">
                        <div>
                           <span className="block text-foreground font-semibold text-sm">Mode de Rendu</span>
                           <span className="block text-caption text-muted-foreground uppercase font-bold mt-0.5">Arbre d'objectifs (classique) ou Timeline verticale (collaboratif)</span>
                        </div>
                        <div className="flex bg-background rounded-xl overflow-hidden p-1 border border-border">
                           {(["TREE", "TIMELINE"] as const).map((mode) => (
                              <button
                                 key={mode}
                                 onClick={async () => {
                                    if (!guide) return;
                                    setLoading(true);
                                    const res = await updateGuideSettings(guide.id, { displayMode: mode });
                                    if (res.success) {
                                       setGuide({ ...guide, displayMode: (res.guide as any).displayMode } as any);
                                       toast.success(`Mode réglé sur ${mode}`);
                                    }
                                    setLoading(false);
                                 }}
                                 className={`px-3 py-1.5 text-caption font-semibold uppercase tracking-wide transition-all rounded-lg ${
                                    ((guide as any)?.displayMode || "TREE") === mode
                                       ? "bg-elevated text-foreground"
                                       : "text-muted-foreground hover:text-foreground"
                                 }`}
                              >
                                 {mode === "TREE" ? "Arbre" : "Timeline"}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-8">
                  <h3 className="text-destructive font-semibold text-xl mb-4 flex items-center gap-3">
                     <AlertTriangle className="w-6 h-6" /> Zone de Danger
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">Ces actions sont irréversibles et affectent tous les membres de la guilde.</p>
                  
                  <div className="space-y-4">
                     <button onClick={handleReset} disabled={loading}
                        className="w-full flex items-center justify-between p-5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 rounded-xl group transition-all">
                        <div className="text-left">
                           <span className="block text-destructive font-semibold">Réinitialiser la structure</span>
                           <span className="block text-caption text-destructive/60 uppercase font-bold">Supprime tous les milestones et chapitres</span>
                        </div>
                        <Trash2 className="w-6 h-6 text-destructive group- transition-transform" />
                      </button>
                  </div>
               </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
