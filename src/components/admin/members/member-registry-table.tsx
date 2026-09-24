"use client";

/**
 * Registre Membres & Recrutement — le « tableur » du staff dans le module Membres.
 *
 * Une ligne = un membre. Saisie à la main : pseudo membre, pseudo Dofus, date
 * d'arrivée, tag Ankama, recruteur, essai (Oui / Non / Prolongé + date) et
 * commentaires. Calculés seuls : aujourd'hui, ancienneté. Peuplé seul :
 * l'ID Discord. Les mules combinent le déclaré (profils) et la saisie manuelle.
 */
import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Award, CheckCircle2, Clock, Copy, Download, Pencil, RefreshCw, Search, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    buildRegistryCsv,
    computeSeniorityDays,
    getTrialDecision,
    isValidAnkamaId,
    resolveJoinedAt,
    type TrialDecision,
} from "@/lib/member-registry";
import {
    getGuildLifecycleData,
    updateMemberAlts,
    updateMemberLifecycleStatus,
    updateMemberRecruiter,
    updateMemberRegistryIdentity,
    validateMemberTrial,
    type GuildLifecycleData,
    type LifecycleMemberSummary,
} from "@/server/actions/member-lifecycle-actions";

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
    const [formNotes, setFormNotes] = useState("");
    const [formRecruiter, setFormRecruiter] = useState("");
    const [formRecruiterSearch, setFormRecruiterSearch] = useState("");
    const [formTrialValid, setFormTrialValid] = useState<"oui" | "non">("non");
    const [formTrialEnd, setFormTrialEnd] = useState("");

    // Mules : une ligne par pseudo
    const [mulesFor, setMulesFor] = useState<LifecycleMemberSummary | null>(null);
    const [mulesText, setMulesText] = useState("");

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
                        lifecycleStatus: m.lifecycleStatus,
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
        setFormNotes(m.staffNotes || "");
        setFormRecruiter(m.recruitedById || "NONE");
        setFormRecruiterSearch("");
        setFormTrialValid(m.lifecycleStatus === "CONFIRMED" ? "oui" : "non");
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
                staffNotes: formNotes.trim() || null,
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
            if (formTrialValid === "oui" && editing.lifecycleStatus !== "CONFIRMED") {
                const resTrial = await validateMemberTrial(guildId, editing.id);
                if (!resTrial.success) {
                    toast.error(resTrial.error || "Essai non enregistré");
                    return;
                }
            } else if (formTrialValid === "non") {
                const trialEnd = fromDateInput(formTrialEnd);
                const trialEndChanged = (trialEnd || null) !== (editing.trialEndsAt || null);
                const statusChanged = editing.lifecycleStatus === "CONFIRMED";
                if (trialEndChanged || statusChanged) {
                    const resTrial = await updateMemberLifecycleStatus(guildId, editing.id, "TRIAL", { trialEndsAt: trialEnd });
                    if (!resTrial.success) {
                        toast.error(resTrial.error || "Essai non enregistré");
                        return;
                    }
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
        setMulesText(m.mules.map((a) => a.pseudo).join("\n"));
    };

    const saveMules = () => {
        if (!mulesFor) return;
        const wanted = mulesText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 60);
        // Conserve classe / niveau déjà connus pour les pseudos gardés.
        const known = new Map(mulesFor.mules.map((a) => [a.pseudo.toLowerCase(), a]));
        const merged = wanted.map((pseudo) => known.get(pseudo.toLowerCase()) || pseudo);
        startTransition(async () => {
            const res = await updateMemberAlts(guildId, mulesFor.id, merged);
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
                staffNotes: m.staffNotes,
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
                        <SelectValue placeholder="Essai" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Essai : tous</SelectItem>
                        <SelectItem value="oui">Essai : oui</SelectItem>
                        <SelectItem value="non">Essai : non</SelectItem>
                        <SelectItem value="prolonge">Essai : prolongé</SelectItem>
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pseudo serveur (auto)</TableHead>
                                <TableHead>Pseudo Dofus</TableHead>
                                <TableHead>Arrivée</TableHead>
                                <TableHead>Ancienneté</TableHead>
                                <TableHead>ID Discord</TableHead>
                                <TableHead>Tag Ankama</TableHead>
                                <TableHead>Recruté par</TableHead>
                                <TableHead>Essai</TableHead>
                                <TableHead>Mules</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map(({ member: m, joinedAt, seniority, trial }) => (
                                <TableRow key={m.id}>
                                    <TableCell className="font-semibold">
                                        {m.discordNickname || m.displayName}
                                        {m.pseudoDofus && m.pseudoDofus !== (m.discordNickname || m.displayName) && (
                                            <span className="block text-xs font-normal text-muted-foreground">{m.pseudoDofus}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{m.pseudoDofus || <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {new Date(joinedAt).toLocaleDateString("fr-FR")}
                                        {m.guildJoinedAt && (
                                            <span className="block text-[11px] text-muted-foreground">saisie manuelle</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">{seniority} j</TableCell>
                                    <TableCell>
                                        {m.discordId ? (
                                            <button
                                                onClick={() => copyDiscordId(m.discordId)}
                                                className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                                                title="Copier l'ID Discord"
                                            >
                                                {m.discordId.slice(0, 6)}…{m.discordId.slice(-4)}
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{m.ankamaId || <span className="font-sans text-muted-foreground">—</span>}</TableCell>
                                    <TableCell>{m.recruiterName || <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                trial === "oui" && "text-success border-success/40",
                                                trial === "non" && "text-warning border-warning/40",
                                                trial === "prolonge" && "text-info border-info/40"
                                            )}
                                        >
                                            {TRIAL_LABEL[trial]}
                                        </Badge>
                                        {m.trialEndsAt && trial !== "oui" && (
                                            <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                                                jusqu&apos;au {new Date(m.trialEndsAt).toLocaleDateString("fr-FR")}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {m.muleCount > 0 ? (
                                            <button onClick={() => openMules(m)} className="text-sm font-semibold hover:underline">
                                                {m.muleCount} mule{m.muleCount > 1 ? "s" : ""}
                                            </button>
                                        ) : (
                                            <button onClick={() => openMules(m)} className="text-xs text-muted-foreground hover:underline">
                                                + Ajouter
                                            </button>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {canManageMembers && (
                                            <>
                                                {trial !== "oui" && (
                                                    <Button variant="ghost" size="sm" onClick={() => validateTrial(m)} title="Valider l'essai">
                                                        <CheckCircle2 className="w-4 h-4 text-success" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(m)} title="Éditer la ligne">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
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
                                <Input
                                    value={formRecruiterSearch}
                                    onChange={(e) => setFormRecruiterSearch(e.target.value)}
                                    placeholder="Filtrer…"
                                    className="mb-1.5"
                                />
                                <Select value={formRecruiter} onValueChange={setFormRecruiter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Non défini" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Non défini</SelectItem>
                                        {data?.members
                                            .filter((c) =>
                                                `${c.pseudoDofus || ""} ${c.discordNickname || ""} ${c.displayName}`
                                                    .toLowerCase()
                                                    .includes(formRecruiterSearch.toLowerCase())
                                            )
                                            .slice(0, 60)
                                            .map((c) => (
                                                <SelectItem key={c.id} value={c.id} disabled={c.id === editing?.id}>
                                                    {c.discordNickname || c.pseudoDofus || c.displayName}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
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
                            <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} maxLength={2000} />
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
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mules — {mulesFor?.displayName}</DialogTitle>
                        <DialogDescription>Un pseudo par ligne. Le déclaré des profils se complète ici à la main.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={mulesText} onChange={(e) => setMulesText(e.target.value)} rows={6} className="font-mono text-sm" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMulesFor(null)}>
                            Annuler
                        </Button>
                        <Button onClick={saveMules} disabled={isPending}>
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
