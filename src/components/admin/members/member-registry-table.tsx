"use client";

/**
 * Registre Membres & Recrutement — le « tableur » du staff dans le module Membres.
 *
 * Une ligne = un membre. Saisie à la main : pseudo membre, pseudo Dofus, date
 * d'arrivée, tag Ankama, recruteur, essai validé (Oui / Non / Prolongé + date).
 * Les commentaires sont un journal : plusieurs entrées horodatées et signées
 * (10 max), lues et ajoutées dans une modale dédiée. Calculés seuls :
 * aujourd'hui, ancienneté. Peuplé seul : l'ID Discord et l'avatar. Les mules
 * combinent le déclaré (profils) et la saisie manuelle.
 */
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Award, CheckCircle2, Clock, Copy, Download, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, Trophy } from "lucide-react";
import { MemberRegistryCommentsDialog } from "@/components/admin/members/member-registry-comments-dialog";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { ClassIcon } from "@/components/shared/class-icon";
import { AsyncCombobox, type ComboboxItem } from "@/components/ui/async-combobox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import {
    MAX_REGISTRY_COMMENTS,
    buildRegistryCsv,
    computeSeniorityDays,
    getTrialDecision,
    hasPseudoDiscordMismatch,
    isValidAnkamaId,
    parseAnkamaTag,
    resolveJoinedAt,
    type TrialDecision,
} from "@/lib/member-registry";
import {
    getGuildLifecycleData,
    setMemberTrialState,
    updateMemberAlts,
    updateMemberRecruiter,
    updateMemberRegistryIdentity,
    validateMemberTrial,
    type GuildLifecycleData,
    type LifecycleMemberSummary,
    type MemberAltInfo,
} from "@/server/actions/member-lifecycle-actions";
import { verifyDofusPseudo, isLadderManualFallbackEnabled } from "@/server/actions/profile-actions";

interface MemberRegistryTableProps {
    guildId: string;
    canManageMembers: boolean;
}

type TrialFilter = "ALL" | TrialDecision;

const TRIAL_LABEL: Record<TrialDecision, string> = { oui: "Oui", non: "Non", prolonge: "Prolongé" };

function toDateInput(iso: string | null): string {
    return iso ? iso.split("T")[0] : "";
}

function fromDateInput(value: string): string | null {
    if (!value) return null;
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function MemberRegistryTable({ guildId, canManageMembers }: MemberRegistryTableProps) {
    const [data, setData] = useState<GuildLifecycleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const [trialFilter, setTrialFilter] = useState<TrialFilter>("ALL");
    const [recruiterFilter, setRecruiterFilter] = useState<string>("ALL");

    // Édition d'une ligne
    const [editing, setEditing] = useState<LifecycleMemberSummary | null>(null);
    const [formPseudoDofus, setFormPseudoDofus] = useState("");
    const [formAnkama, setFormAnkama] = useState("");
    const [formArrival, setFormArrival] = useState("");
    const [formRecruiter, setFormRecruiter] = useState("");
    const [formTrialValid, setFormTrialValid] = useState<"oui" | "non">("non");
    const [formTrialEnd, setFormTrialEnd] = useState("");

    // Mules : liste structurée avec contrôle ladder Ankama
    const [mulesFor, setMulesFor] = useState<LifecycleMemberSummary | null>(null);
    const [currentMules, setCurrentMules] = useState<MemberAltInfo[]>([]);
    const [newMulePseudo, setNewMulePseudo] = useState("");
    const [newMuleClass, setNewMuleClass] = useState("cra");
    const [newMuleLevel, setNewMuleLevel] = useState("200");
    const [isVerifyingLadder, setIsVerifyingLadder] = useState(false);
    const [ladderFallbackActive, setLadderFallbackActive] = useState(false);

    /** Commentaires : journal du membre, lu et complété dans sa modale dédiée. */
    const [commentsFor, setCommentsFor] = useState<LifecycleMemberSummary | null>(null);

    const todayIso = useMemo(() => new Date().toISOString(), []);
    const todayLabel = useMemo(() => new Date().toLocaleDateString("fr-FR"), []);

    const fetchData = async () => {
        const res = await getGuildLifecycleData(guildId);
        if (res.success && res.data) setData(res.data);
        else toast.error(res.error || "Erreur de chargement du registre");
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guildId]);

    useEffect(() => {
        let active = true;
        isLadderManualFallbackEnabled().then((enabled) => {
            if (active) setLadderFallbackActive(enabled);
        });
        return () => { active = false; };
    }, []);

    const refresh = () => {
        startTransition(async () => {
            const res = await getGuildLifecycleData(guildId);
            if (res.success && res.data) {
                setData(res.data);
                toast.success("Registre actualisé");
            } else toast.error(res.error || "Erreur de rafraîchissement");
        });
    };

    const rows = useMemo(() => {
        if (!data) return [];
        const q = search.toLowerCase();
        return data.members
            .map((m) => {
                const joinedAt = resolveJoinedAt({ guildJoinedAt: m.guildJoinedAt, createdAt: m.createdAt });
                return {
                    member: m,
                    joinedAt,
                    seniority: computeSeniorityDays(joinedAt),
                    trial: getTrialDecision({
                        trialValidated: m.trialValidated,
                        trialEndsAt: m.trialEndsAt,
                        joinedAtIso: joinedAt,
                        trialDurationDays: data.config.trialDurationDays,
                    }),
                };
            })
            .filter(({ member: m, trial }) => {
                const matchesSearch =
                    !q ||
                    m.displayName.toLowerCase().includes(q) ||
                    (m.pseudoDofus && m.pseudoDofus.toLowerCase().includes(q)) ||
                    (m.discordNickname && m.discordNickname.toLowerCase().includes(q)) ||
                    (m.ankamaId && m.ankamaId.toLowerCase().includes(q)) ||
                    m.discordId.includes(q);
                const matchesTrial = trialFilter === "ALL" || trial === trialFilter;
                const matchesRecruiter = recruiterFilter === "ALL" || m.recruitedById === recruiterFilter;
                return matchesSearch && matchesTrial && matchesRecruiter;
            })
            .sort((a, b) => b.seniority - a.seniority);
    }, [data, search, trialFilter, recruiterFilter]);

    const openEdit = (m: LifecycleMemberSummary) => {
        setEditing(m);
        setFormPseudoDofus(m.pseudoDofus || "");
        setFormAnkama(m.ankamaId || "");
        setFormArrival(toDateInput(m.guildJoinedAt));
        setFormRecruiter(m.recruitedById || "NONE");
        setFormTrialValid(m.trialValidated ? "oui" : "non");
        setFormTrialEnd(toDateInput(m.trialEndsAt));
    };

    const saveRow = () => {
        if (!editing) return;
        const ankama = formAnkama.trim();
        if (ankama && !isValidAnkamaId(ankama)) {
            toast.error("Tag Ankama invalide (format Nom#0000)");
            return;
        }
        if (formTrialValid === "non" && formTrialEnd && !fromDateInput(formTrialEnd)) {
            toast.error("Date de reconduction invalide");
            return;
        }
        startTransition(async () => {
            const res = await updateMemberRegistryIdentity(guildId, {
                profileId: editing.id,
                pseudoDofus: formPseudoDofus.trim() || null,
                ankamaId: ankama || null,
                guildJoinedAt: fromDateInput(formArrival),
            });
            if (!res.success) {
                toast.error(res.error || "Échec de l'enregistrement");
                return;
            }
            const recruiterId = formRecruiter === "NONE" ? null : formRecruiter;
            if (recruiterId !== editing.recruitedById) {
                const resRec = await updateMemberRecruiter(guildId, editing.id, recruiterId);
                if (!resRec.success) {
                    toast.error(resRec.error || "Recruteur non enregistré");
                    return;
                }
            }
            // Essai : Oui = validé, Non = en essai jusqu'à la date de reconduction (ou sans fin).
            const wantValidated = formTrialValid === "oui";
            const wantTrialEnd = wantValidated ? null : fromDateInput(formTrialEnd);
            const trialChanged =
                wantValidated !== editing.trialValidated ||
                (!wantValidated && (wantTrialEnd || null) !== (editing.trialEndsAt || null));
            if (trialChanged) {
                const resTrial = await setMemberTrialState(guildId, editing.id, {
                    validated: wantValidated,
                    trialEndsAt: wantTrialEnd,
                });
                if (!resTrial.success) {
                    toast.error(resTrial.error || "Essai non enregistré");
                    return;
                }
            }
            toast.success("Ligne du registre mise à jour");
            setEditing(null);
            refresh();
        });
    };

    const validateTrial = (m: LifecycleMemberSummary) => {
        startTransition(async () => {
            const res = await validateMemberTrial(guildId, m.id);
            if (res.success) {
                toast.success("Essai validé");
                refresh();
            } else toast.error(res.error || "Échec de la validation");
        });
    };

    const openMules = (m: LifecycleMemberSummary) => {
        setMulesFor(m);
        setCurrentMules([...m.mules]);
        setNewMulePseudo("");
        setNewMuleClass("cra");
        setNewMuleLevel("200");
    };

    const handleAddMule = async () => {
        const pseudo = newMulePseudo.trim();
        if (!pseudo || pseudo.length < 2) {
            toast.error("Veuillez saisir un pseudo valide (min. 2 caractères).");
            return;
        }

        if (currentMules.some((m) => m.pseudo.toLowerCase() === pseudo.toLowerCase())) {
            toast.error("Cette mule est déjà présente dans la liste.");
            return;
        }

        const levelNum = Math.min(200, Math.max(1, parseInt(newMuleLevel, 10) || 200));

        if (ladderFallbackActive) {
            // Mode God fallback : saisie manuelle autorisée sans ladder
            setCurrentMules((prev) => [...prev, { pseudo, classe: newMuleClass, level: levelNum }]);
            setNewMulePseudo("");
            toast.success(`Mule "${pseudo}" ajoutée (saisie manuelle).`);
            return;
        }

        // Vérification systématique sur le ladder officiel Ankama
        setIsVerifyingLadder(true);
        try {
            const res = await verifyDofusPseudo(pseudo, guildId);
            if (res.success && res.data?.found) {
                const detectedLevel = res.data.level ? Number(res.data.level) : levelNum;
                setCurrentMules((prev) => [
                    ...prev,
                    {
                        pseudo: res.data?.character_name || pseudo,
                        classe: newMuleClass,
                        level: detectedLevel,
                    },
                ]);
                setNewMulePseudo("");
                toast.success(`Mule "${pseudo}" validée sur le ladder Ankama !`);
            } else {
                toast.error(res.error || `Pseudo "${pseudo}" introuvable sur le ladder Ankama pour cette guilde.`);
            }
        } catch {
            toast.error("Erreur lors de la vérification sur le ladder Ankama.");
        } finally {
            setIsVerifyingLadder(false);
        }
    };

    const handleRemoveMule = (indexToRemove: number) => {
        setCurrentMules((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const saveMules = () => {
        if (!mulesFor) return;
        startTransition(async () => {
            const res = await updateMemberAlts(guildId, mulesFor.id, currentMules);
            if (res.success) {
                toast.success("Mules mises à jour");
                setMulesFor(null);
                refresh();
            } else toast.error(res.error || "Échec de l'enregistrement des mules");
        });
    };

    const exportCsv = () => {
        if (!data) return;
        const { filename, content } = buildRegistryCsv(
            rows.map(({ member: m, joinedAt, seniority, trial }) => ({
                displayName: m.displayName,
                pseudoDofus: m.pseudoDofus,
                discordNickname: m.discordNickname,
                joinedAt,
                seniorityDays: seniority,
                discordId: m.discordId,
                ankamaId: m.ankamaId,
                recruiterName: m.recruiterName,
                trialDecision: trial,
                trialEndsAt: m.trialEndsAt,
                muleCount: m.muleCount,
                mules: m.mules.map((a) => a.pseudo),
                comments: m.comments,
            })),
            guildId,
            todayIso
        );
        const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyDiscordId = async (id: string) => {
        try {
            await navigator.clipboard.writeText(id);
            toast.success("ID Discord copié");
        } catch {
            toast.error("Copie impossible");
        }
    };

    /**
     * « Recruté par » : liste locale (le registre a déjà tous les membres en
     * mémoire) servie au combobox partagé — recherche incluse, popover thémé,
     * pas de menu natif qui déborde de la modale.
     */
    const recruiterFetcher = useCallback(
        async (query: string): Promise<ComboboxItem[]> => {
            const q = query.trim().toLowerCase();
            const options: ComboboxItem[] = [
                { value: "NONE", label: "Non défini" },
                ...(data?.members ?? [])
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => {
                        const label = c.discordNickname || c.pseudoDofus || c.displayName;
                        const subLabel = c.pseudoDofus && c.pseudoDofus !== label ? c.pseudoDofus : undefined;
                        return { value: c.id, label, subLabel };
                    }),
            ];
            return options
                .filter((o) => !q || `${o.label} ${o.subLabel ?? ""}`.toLowerCase().includes(q))
                .slice(0, 60);
        },
        [data?.members, editing?.id]
    );

    if (loading) return <div className="min-h-[400px] animate-pulse bg-surface/10 rounded-3xl" />;

    return (
        <div className="space-y-6">
            {/* Meilleurs recruteurs */}
            {data && data.recruiterLeaderboard.length > 0 && (
                <Card className="bg-surface/40 border-border rounded-2xl">
                    <CardHeader className="py-4 px-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-warning" />
                            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Meilleurs recruteurs</CardTitle>
                        </div>
                        <CardDescription>Classement calculé sur les recrutements enregistrés.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-5 flex flex-wrap gap-2">
                        {data.recruiterLeaderboard.slice(0, 8).map((r, i) => (
                            <Badge key={r.recruiterId} variant="outline" className="gap-1.5 px-3 py-1.5">
                                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <Award className="w-3 h-3" />}</span>
                                {r.recruiterName}
                                <span className="text-muted-foreground">
                                    {r.totalRecruits} recrue{r.totalRecruits > 1 ? "s" : ""}
                                </span>
                            </Badge>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Filtres + actions */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher (pseudo, tag Ankama, ID Discord)…"
                        className="pl-9"
                    />
                </div>
                <Select value={trialFilter} onValueChange={(v) => setTrialFilter(v as TrialFilter)}>
                    <SelectTrigger className="w-full lg:w-44">
                        <SelectValue placeholder="Essai validé" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Essai validé : tous</SelectItem>
                        <SelectItem value="oui">Essai validé : oui</SelectItem>
                        <SelectItem value="non">Essai validé : non</SelectItem>
                        <SelectItem value="prolonge">Essai validé : prolongé</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                    <SelectTrigger className="w-full lg:w-52">
                        <SelectValue placeholder="Recruteur" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Recruteur : tous</SelectItem>
                        {data?.recruiterLeaderboard.map((r) => (
                            <SelectItem key={r.recruiterId} value={r.recruiterId}>
                                {r.recruiterName} ({r.totalRecruits})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={isPending} className="gap-2">
                        <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                        Actualiser
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Registre */}
            <Card className="bg-surface/40 border-border rounded-2xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                        Registre — {rows.length} membre{rows.length > 1 ? "s" : ""}
                    </CardTitle>
                    <CardDescription>
                        Aujourd&apos;hui : {todayLabel} · l&apos;ancienneté se calcule seule, l&apos;ID Discord se peuple seul.
                    </CardDescription>
                </CardHeader>

                {/* Vue Mobile (Cards) - évite tout scroll horizontal coupé */}
                <div className="block md:hidden divide-y divide-border">
                    {rows.map(({ member: m, joinedAt, seniority, trial }) => {
                        const ankamaParts = parseAnkamaTag(m.ankamaId);
                        const hasMismatch = hasPseudoDiscordMismatch(m.discordNickname || m.displayName, m.ankamaId);

                        return (
                            <div key={m.id} className="p-4 space-y-3 bg-surface/20">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Avatar className="h-9 w-9 shrink-0 border border-border">
                                            <DiscordAvatarImage
                                                src={m.avatar}
                                                alt={m.discordNickname || m.displayName}
                                                className="object-cover"
                                            />
                                            <AvatarFallback className="bg-elevated text-xs font-bold uppercase text-muted-foreground">
                                                {(m.discordNickname || m.displayName).slice(0, 1)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <span className="font-semibold text-sm block truncate">{m.discordNickname || m.displayName}</span>
                                            {m.pseudoDofus && (
                                                <span className="text-xs text-muted-foreground block truncate">
                                                    🎮 {m.pseudoDofus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {canManageMembers && (
                                            <>
                                                {trial !== "oui" && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => validateTrial(m)} title="Valider l'essai">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} title="Éditer la ligne">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                    <div>
                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Tag Ankama</span>
                                        {ankamaParts ? (
                                            <div className="inline-flex flex-col items-start gap-0.5 mt-0.5">
                                                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface border border-border inline-flex items-center shadow-xs">
                                                    <span className="text-foreground font-medium">{ankamaParts.name}</span>
                                                    <span className="text-muted-foreground/60 mx-0.5">#</span>
                                                    <span className="text-emerald-400 font-bold">{ankamaParts.discriminator}</span>
                                                </span>
                                                {hasMismatch && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded">
                                                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                                        ≠ Discord
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </div>

                                    <div>
                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Arrivée & Ancienneté</span>
                                        <span className="text-xs font-medium block">{new Date(joinedAt).toLocaleDateString("fr-FR")}</span>
                                        <span className="text-[11px] text-muted-foreground font-mono">{seniority} j</span>
                                    </div>

                                    <div>
                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Recruté par</span>
                                        <span className="text-xs truncate block">{m.recruiterName || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Essai</span>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] py-0 px-1.5 mt-0.5",
                                                trial === "oui" && "text-success border-success/40",
                                                trial === "non" && "text-warning border-warning/40",
                                                trial === "prolonge" && "text-info border-info/40"
                                            )}
                                        >
                                            {TRIAL_LABEL[trial]}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                                    <button onClick={() => openMules(m)} className="flex items-center gap-1.5 text-xs font-medium hover:underline text-muted-foreground hover:text-foreground">
                                        <div className="flex -space-x-1 overflow-hidden">
                                            {m.mules.slice(0, 3).map((mule, i) => (
                                                <div key={i} className="inline-block h-4 w-4 rounded-full bg-surface border border-border overflow-hidden">
                                                    <ClassIcon classId={mule.classe || "cra"} size={16} />
                                                </div>
                                            ))}
                                        </div>
                                        <span>{m.muleCount > 0 ? `${m.muleCount} mule${m.muleCount > 1 ? "s" : ""}` : "+ Mules"}</span>
                                    </button>

                                    <button onClick={() => setCommentsFor(m)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>{m.comments.length}/{MAX_REGISTRY_COMMENTS}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Vue Desktop / Tablette */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[200px]">Membre & Pseudo</TableHead>
                                <TableHead className="min-w-[150px]">Tag Ankama</TableHead>
                                <TableHead className="min-w-[110px]">Arrivée</TableHead>
                                <TableHead className="min-w-[110px]">Recruté par</TableHead>
                                <TableHead className="min-w-[90px]">Essai</TableHead>
                                <TableHead className="min-w-[90px]">Mules</TableHead>
                                <TableHead className="min-w-[70px]">Journal</TableHead>
                                <TableHead className="text-right min-w-[70px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map(({ member: m, joinedAt, seniority, trial }) => {
                                const ankamaParts = parseAnkamaTag(m.ankamaId);
                                const hasMismatch = hasPseudoDiscordMismatch(m.discordNickname || m.displayName, m.ankamaId);

                                return (
                                    <TableRow key={m.id} className="hover:bg-muted/20">
                                        {/* Membre & Pseudo */}
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <Avatar className="h-8 w-8 shrink-0 border border-border">
                                                    <DiscordAvatarImage
                                                        src={m.avatar}
                                                        alt={m.discordNickname || m.displayName}
                                                        className="object-cover"
                                                    />
                                                    <AvatarFallback className="bg-elevated text-[10px] font-bold uppercase text-muted-foreground">
                                                        {(m.discordNickname || m.displayName).slice(0, 1)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-sm block truncate" title={m.discordNickname || m.displayName}>
                                                            {m.discordNickname || m.displayName}
                                                        </span>
                                                        {m.discordId && (
                                                            <button
                                                                onClick={() => copyDiscordId(m.discordId)}
                                                                className="text-muted-foreground/50 hover:text-foreground transition-colors"
                                                                title={`Copier l'ID Discord (${m.discordId})`}
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {m.pseudoDofus && (
                                                        <span className="block text-xs font-normal text-muted-foreground truncate">
                                                            🎮 {m.pseudoDofus}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Tag Ankama */}
                                        <TableCell>
                                            {ankamaParts ? (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <div className="font-mono text-xs px-2 py-1 rounded-lg bg-surface/80 border border-border inline-flex items-center shadow-xs">
                                                        <span className="text-foreground font-semibold tracking-wide">{ankamaParts.name}</span>
                                                        <span className="text-muted-foreground/60 mx-0.5">#</span>
                                                        <span className="text-emerald-400 font-bold">{ankamaParts.discriminator}</span>
                                                    </div>
                                                    {hasMismatch && (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-md"
                                                            title={`Le pseudo Discord (${m.discordNickname || m.displayName}) diffère du compte Ankama (${ankamaParts.name})`}
                                                        >
                                                            <AlertTriangle className="w-3 h-3 shrink-0" />
                                                            ≠ Discord
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>

                                        {/* Arrivée & Ancienneté */}
                                        <TableCell>
                                            <div className="whitespace-nowrap">
                                                <span className="text-sm font-medium block">
                                                    {new Date(joinedAt).toLocaleDateString("fr-FR")}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {seniority} j
                                                </span>
                                                {m.guildJoinedAt && (
                                                    <span className="block text-[10px] text-muted-foreground/70">saisie manuelle</span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Recruté par */}
                                        <TableCell>
                                            <span className="text-sm truncate block max-w-[140px]" title={m.recruiterName || ""}>
                                                {m.recruiterName || <span className="text-muted-foreground text-xs">—</span>}
                                            </span>
                                        </TableCell>

                                        {/* Essai */}
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs whitespace-nowrap",
                                                    trial === "oui" && "text-success border-success/40",
                                                    trial === "non" && "text-warning border-warning/40",
                                                    trial === "prolonge" && "text-info border-info/40"
                                                )}
                                            >
                                                {TRIAL_LABEL[trial]}
                                            </Badge>
                                            {m.trialEndsAt && trial !== "oui" && (
                                                <span className="block text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                                                    jusqu&apos;au {new Date(m.trialEndsAt).toLocaleDateString("fr-FR")}
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Mules */}
                                        <TableCell>
                                            <button
                                                onClick={() => openMules(m)}
                                                className="group inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                                                title="Gérer les mules"
                                            >
                                                {m.mules.length > 0 ? (
                                                    <>
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {m.mules.slice(0, 3).map((mule, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="inline-block h-6 w-6 rounded-full ring-1 ring-border bg-surface overflow-hidden shadow-xs"
                                                                    title={`${mule.pseudo} (${mule.classe || "Cra"} niv. ${mule.level || 200})`}
                                                                >
                                                                    <ClassIcon classId={mule.classe || "cra"} size={24} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className="text-xs font-semibold group-hover:underline">
                                                            {m.muleCount}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground hover:underline">
                                                        + Ajouter
                                                    </span>
                                                )}
                                            </button>
                                        </TableCell>

                                        {/* Commentaires */}
                                        <TableCell>
                                            <button
                                                onClick={() => setCommentsFor(m)}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 text-xs font-semibold hover:underline",
                                                    m.comments.length > 0 ? "text-foreground" : "text-muted-foreground"
                                                )}
                                                title={`Lire le journal (${m.comments.length}/${MAX_REGISTRY_COMMENTS})`}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                                <span>{m.comments.length}/{MAX_REGISTRY_COMMENTS}</span>
                                            </button>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right whitespace-nowrap">
                                            {canManageMembers && (
                                                <div className="flex items-center justify-end gap-1">
                                                    {trial !== "oui" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                                            onClick={() => validateTrial(m)}
                                                            title="Valider l'essai"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => openEdit(m)}
                                                        title="Éditer la ligne"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                        <Clock className="w-5 h-5 mx-auto mb-2" />
                                        Aucun membre dans le registre avec ces filtres.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Édition d'une ligne */}
            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Éditer — {editing?.displayName}</DialogTitle>
                        <DialogDescription>
                            Saisie manuelle du staff. L&apos;ancienneté et l&apos;ID Discord restent automatiques.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="rounded-xl bg-surface/60 border border-border px-3 py-2 text-sm">
                            Pseudo serveur : <span className="font-semibold">{editing?.discordNickname || "—"}</span>
                            <span className="block text-xs text-muted-foreground">
                                Rempli et mis à jour seul depuis Discord (bouton Actualiser / connexion du membre).
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Pseudo Dofus (à la main)</Label>
                                <Input value={formPseudoDofus} onChange={(e) => setFormPseudoDofus(e.target.value)} maxLength={30} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Date d&apos;arrivée (à la main)</Label>
                                <Input type="date" value={formArrival} onChange={(e) => setFormArrival(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tag Ankama (Nom#0000, aussi renseignable via /valider-recrue)</Label>
                            <Input value={formAnkama} onChange={(e) => setFormAnkama(e.target.value)} maxLength={60} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Recruté par (recherche membre Discord)</Label>
                                <AsyncCombobox
                                    value={formRecruiter}
                                    onSelect={setFormRecruiter}
                                    fetcher={recruiterFetcher}
                                    placeholder="Non défini"
                                    searchPlaceholder="Rechercher un membre…"
                                    emptyText="Aucun membre trouvé."
                                    initialLabel={editing?.recruiterName ?? "Non défini"}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Posé seul si le recruteur utilise /valider-recrue sans préciser ce champ.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Essai validé</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={formTrialValid === "oui" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setFormTrialValid("oui")}
                                        className="flex-1"
                                    >
                                        Oui
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formTrialValid === "non" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setFormTrialValid("non")}
                                        className="flex-1"
                                    >
                                        Non
                                    </Button>
                                </div>
                                {formTrialValid === "non" && (
                                    <>
                                        <Label className="pt-1">Reconduction jusqu&apos;au (vide = sans fin)</Label>
                                        <Input type="date" value={formTrialEnd} onChange={(e) => setFormTrialEnd(e.target.value)} />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Commentaires</Label>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => editing && setCommentsFor(editing)}
                                className="w-full justify-start gap-2"
                                disabled={!editing}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {editing && editing.comments.length > 0
                                    ? `Lire le journal (${editing.comments.length}/${MAX_REGISTRY_COMMENTS})`
                                    : "Ajouter un commentaire"}
                            </Button>
                            <p className="text-[11px] text-muted-foreground">
                                Journal horodaté et signé, {MAX_REGISTRY_COMMENTS} entrées maximum.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>
                            Annuler
                        </Button>
                        <Button onClick={saveRow} disabled={isPending}>
                            Enregistrer la ligne
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mules */}
            <Dialog open={!!mulesFor} onOpenChange={(open) => !open && setMulesFor(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Mules — {mulesFor?.displayName}</span>
                            <Badge variant="outline" className="text-xs">
                                {currentMules.length} mule{currentMules.length > 1 ? "s" : ""}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Gérez les personnages secondaires du membre avec leur classe et niveau.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Alerte Fallback God si actif */}
                    {ladderFallbackActive && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                            <div>
                                <p className="font-semibold">Mode Fallback God actif</p>
                                <p className="text-amber-300/80">La vérification ladder Ankama est assouplie. La saisie manuelle sans contrôle officiel est autorisée.</p>
                            </div>
                        </div>
                    )}

                    {/* Liste des mules actuelles */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Mules enregistrées
                        </Label>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {currentMules.map((mule, idx) => {
                                const cls = getClass(mule.classe || "cra") || DOFUS_CLASSES[0];
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-surface/60 border border-border hover:border-border-strong transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-surface border border-border">
                                                <ClassIcon classId={mule.classe || "cra"} size={22} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-semibold text-sm block truncate">{mule.pseudo}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {cls?.name || "Classe"} · Niv. {mule.level || 200}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                            onClick={() => handleRemoveMule(idx)}
                                            title="Supprimer cette mule"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                            {currentMules.length === 0 && (
                                <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                                    Aucune mule déclarée pour ce membre.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ajout d'une mule */}
                    <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Ajouter une mule
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-5">
                                <Input
                                    placeholder="Pseudo Dofus"
                                    value={newMulePseudo}
                                    onChange={(e) => setNewMulePseudo(e.target.value)}
                                    maxLength={30}
                                    className="h-9 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddMule();
                                        }
                                    }}
                                />
                            </div>
                            <div className="sm:col-span-4">
                                <Select value={newMuleClass} onValueChange={setNewMuleClass}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Classe" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-56">
                                        {DOFUS_CLASSES.map((cls) => (
                                            <SelectItem key={cls.id} value={cls.id} className="text-xs">
                                                <div className="flex items-center gap-2">
                                                    <ClassIcon classId={cls.id} size={16} />
                                                    <span>{cls.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="sm:col-span-3">
                                <Input
                                    type="number"
                                    min={1}
                                    max={200}
                                    placeholder="Niv."
                                    value={newMuleLevel}
                                    onChange={(e) => setNewMuleLevel(e.target.value)}
                                    className="h-9 text-xs text-center"
                                />
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            disabled={isVerifyingLadder || !newMulePseudo.trim()}
                            onClick={handleAddMule}
                        >
                            {isVerifyingLadder ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Vérification sur le ladder Ankama…
                                </>
                            ) : ladderFallbackActive ? (
                                <>
                                    <Plus className="w-3.5 h-3.5" />
                                    Ajouter la mule (sans vérif)
                                </>
                            ) : (
                                <>
                                    <Search className="w-3.5 h-3.5" />
                                    Vérifier sur le ladder & Ajouter
                                </>
                            )}
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMulesFor(null)}>
                            Annuler
                        </Button>
                        <Button onClick={saveMules} disabled={isPending}>
                            Enregistrer les mules
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Commentaires du registre : journal du membre + ajout (10 max) */}
            {commentsFor && (
                <MemberRegistryCommentsDialog
                    guildId={guildId}
                    profileId={commentsFor.id}
                    memberName={commentsFor.displayName}
                    comments={data?.members.find((m) => m.id === commentsFor.id)?.comments ?? commentsFor.comments}
                    open
                    onOpenChange={(open) => !open && setCommentsFor(null)}
                    onAdded={refresh}
                    canManageMembers={canManageMembers}
                />
            )}
        </div>
    );
}
