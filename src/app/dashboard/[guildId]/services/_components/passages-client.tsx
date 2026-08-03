"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Key, Handshake, Vault, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ServiceCard } from "./service-card";
import { ServiceForm } from "./service-form";
import { LoanCard } from "./loan-card";
import { LoanForm } from "./loan-form";
import { VaultTable } from "./vault-table";
import { VaultForm } from "./vault-form";
import { type ServiceListingWithProfile } from "@/server/actions/service-actions";
import { CATEGORY_LABELS } from "@/server/actions/services-constants";
import { type LoanWithProfiles } from "@/server/actions/loan-actions";
import { type VaultEntryWithProfile, type VaultSummaryItem } from "@/server/actions/vault-actions";
import { ServiceCategory } from "@prisma/client";

type Tab = "services" | "prets" | "coffre";

interface PassagesClientProps {
    guildId: string;
    profileId?: string;
    isAdmin: boolean;
    canCreate: boolean;
    listings: ServiceListingWithProfile[];
    loans: LoanWithProfiles[];
    vaultEntries: VaultEntryWithProfile[];
    vaultSummary: VaultSummaryItem[];
    maintenance?: {
        serviceMarketplaceEnabled: boolean;
        serviceMarketplaceMessage: string | null;
        serviceLoansEnabled: boolean;
        serviceLoansMessage: string | null;
        serviceVaultEnabled: boolean;
        serviceVaultMessage: string | null;
    };
    servicesDiscordConfigured?: boolean;
    loansDiscordConfigured?: boolean;
    vaultDiscordConfigured?: boolean;
}

const TAB_CONFIG: { key: Tab; label: string; icon: typeof Key; color: string; activeClass: string; glow: string }[] = [
    { 
        key: "services", 
        label: "Marketplace", 
        icon: Key, 
        color: "cyan", 
        activeClass: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]",
        glow: "from-cyan-500/20 to-transparent"
    },
    { 
        key: "prets", 
        label: "Prêts & Emprunts", 
        icon: Handshake, 
        color: "amber", 
        activeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
        glow: "from-amber-500/20 to-transparent"
    },
    { 
        key: "coffre", 
        label: "Coffre de Guilde", 
        icon: Vault, 
        color: "emerald", 
        activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]",
        glow: "from-emerald-500/20 to-transparent"
    },
];

export function PassagesClient({
    guildId,
    profileId,
    isAdmin,
    canCreate,
    listings,
    loans,
    vaultEntries,
    vaultSummary,
    maintenance,
    servicesDiscordConfigured = false,
    loansDiscordConfigured = false,
    vaultDiscordConfigured = false,
}: PassagesClientProps) {
    const [tab, setTab] = useState<Tab>("services");

    const [showServiceForm, setShowServiceForm] = useState(false);
    const [showLoanForm, setShowLoanForm] = useState(false);
    const [showVaultForm, setShowVaultForm] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

    const isMarketplaceDisabled = maintenance && !maintenance.serviceMarketplaceEnabled && !isAdmin;
    const isLoansDisabled = maintenance && !maintenance.serviceLoansEnabled && !isAdmin;
    const isVaultDisabled = maintenance && !maintenance.serviceVaultEnabled && !isAdmin;

    // Discord not configured → non-admin members can't switch tabs or create.
    // Le blocage dépend du salon du module de l'onglet actif : services vs prêts/coffre.
    const isCurrentDiscordConfigured =
        tab === "services" ? servicesDiscordConfigured
        : tab === "coffre" ? vaultDiscordConfigured
        : loansDiscordConfigured;
    const discordBlocked = !isCurrentDiscordConfigured && !isAdmin;

    const MaintenanceView = ({ message, label }: { message?: string | null, label: string }) => (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-white/10 rounded-2xl bg-zinc-900/40 relative overflow-hidden group p-8 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-50" />
            <div className="relative z-10 space-y-4 max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                    <Lock className="w-10 h-10 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Espace en maintenance</h3>
                    <p className="text-amber-500/80 text-xs font-black uppercase tracking-[0.2em] mt-1">{label}</p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm">
                    <p className="text-zinc-300 text-sm leading-relaxed italic">
                        "{message || "Cet onglet est temporairement désactivé par un administrateur. Revenez plus tard !"}"
                    </p>
                </div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">SigilOS Safety Protocol</p>
            </div>
        </div>
    );

    const handleTabChange = (t: Tab) => {
        setTab(t);
        // Fix layout shift: dé-scroller jusqu'aux onglets sans sauter
        setTimeout(() => {
            tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
    };

    // Global search (applies to current tab content)
    const [globalSearch, setGlobalSearch] = useState("");

    // Service-specific filter
    const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

    // Loan filter — par défaut on cache les archives (RETURNED/CANCELLED)
    const [loanFilter, setLoanFilter] = useState<string>("ACTIVE");

    // Filtered data
    const filteredListings = listings.filter((l) => {
        const matchCat = categoryFilter === "ALL" || l.category === categoryFilter;
        const q = globalSearch.toLowerCase();
        const matchSearch = !q ||
            l.title.toLowerCase().includes(q) ||
            (l.description?.toLowerCase().includes(q) ?? false);
        return matchCat && matchSearch;
    });

    const filteredLoans = loans.filter((l) => {
        const q = globalSearch.toLowerCase();
        const matchType =
            loanFilter === "ACTIVE" ? (l.status === "ACTIVE" || l.status === "PARTIAL") :
                loanFilter === "ARCHIVED" ? (l.status === "RETURNED" || l.status === "CANCELLED") :
                    loanFilter === "MINE" ? (l.lender.id === profileId || l.borrower.id === profileId) :
                        true;
        const matchSearch = !q || l.description?.toLowerCase().includes(q);
        return matchType && matchSearch;
    });

    const filteredVault = vaultEntries.filter((e) => {
        const q = globalSearch.toLowerCase();
        return !q || e.itemName.toLowerCase().includes(q) || (e.description?.toLowerCase().includes(q) ?? false);
    });

    const activeLoanCount = loans.filter(l => l.status === "ACTIVE" || l.status === "PARTIAL").length;
    const archivedLoanCount = loans.filter(l => l.status === "RETURNED" || l.status === "CANCELLED").length;

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/40 p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
                    <div className="flex items-center gap-6">
                        <div className="relative h-20 w-20 shrink-0 group">
                            <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-xl group-hover:bg-cyan-500/30 transition-all duration-500" />
                            <div className="relative h-full w-full rounded-2xl border border-white/10 bg-zinc-900 flex items-center justify-center shadow-2xl group-hover:border-cyan-500/30 transition-all duration-500">
                                <Key className="w-10 h-10 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Services de Guilde</h1>
                            <p className="text-zinc-400 text-sm font-medium mt-1">Gérez vos échanges, vos prêts et le stock communautaire.</p>
                            <div className="flex items-center gap-4 mt-3">
                                <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                                    {listings.length} Offres actives
                                </Badge>
                                <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                                    {activeLoanCount} Prêts en cours
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-cyan-400 transition-colors" />
                        </div>
                        <Input
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            placeholder="RECHERCHER DANS TOUTE LA GUILDE..."
                            className="pl-10 bg-zinc-900/50 border-white/10 h-12 text-xs font-black uppercase tracking-[0.1em] placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-cyan-500/10 transition-all rounded-xl"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs & Filters Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                <div ref={tabsRef} className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-900/40 border border-white/10 w-fit backdrop-blur-md">
                    {TAB_CONFIG.map((t) => {
                        const isActive = tab === t.key;
                        const Icon = t.icon;
                        const isDisabled = discordBlocked ||
                            (t.key === "services" && isMarketplaceDisabled) ||
                            (t.key === "prets" && isLoansDisabled) ||
                            (t.key === "coffre" && isVaultDisabled);

                        return (
                            <button
                                key={t.key}
                                onClick={() => !isDisabled && handleTabChange(t.key)}
                                className={cn(
                                    "relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all duration-300 overflow-hidden",
                                    isActive ? t.activeClass : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]",
                                    isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                )}
                            >
                                {isActive && (
                                    <div className={cn("absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r", t.glow)} />
                                )}
                                {isDisabled ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Icon className="h-4 w-4" />}
                                {t.label}
                                {t.key === "prets" && activeLoanCount > 0 && (
                                    <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-black px-1 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                        {activeLoanCount}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3">
                    {tab === "services" && canCreate && !isMarketplaceDisabled && (
                        <Button
                            disabled={discordBlocked}
                            onClick={() => setShowServiceForm(true)}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-600 disabled:shadow-none"
                        >
                            <Plus className="h-4 w-4 mr-2" strokeWidth={3} /> Publier une offre
                        </Button>
                    )}
                    {tab === "prets" && canCreate && !isLoansDisabled && (
                        <Button
                            disabled={discordBlocked}
                            onClick={() => setShowLoanForm(true)}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600 disabled:shadow-none"
                        >
                            <Plus className="h-4 w-4 mr-2" strokeWidth={3} /> Nouveau prêt
                        </Button>
                    )}
                    {tab === "coffre" && canCreate && !isVaultDisabled && (
                        <Button
                            disabled={discordBlocked}
                            onClick={() => setShowVaultForm(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 disabled:shadow-none"
                        >
                            <Plus className="h-4 w-4 mr-2" strokeWidth={3} /> Enregistrer un item
                        </Button>
                    )}
                </div>
            </div>

            {!isCurrentDiscordConfigured && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold animate-in fade-in duration-300">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-black uppercase tracking-wider text-[11px]">Salon Discord non configuré</p>
                        <p className="text-zinc-400 font-medium mt-0.5">{[`Le salon pour les notifications n'est pas configuré dans l'administration de la guilde (Paramètres ${'>'} Prêts/Services). Les créations d'offres, de prêts et d'enregistrements sont désactivées.`]}</p>
                    </div>
                </div>
            )}

            {/* TAB: Services */}
            <div className={tab === "services" ? "block" : "hidden"}>
                {isMarketplaceDisabled ? (
                    <MaintenanceView label="Services" message={maintenance?.serviceMarketplaceMessage} />
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {maintenance && !maintenance.serviceMarketplaceEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                <AlertTriangle className="w-3 h-3" /> Sous maintenance (Visible uniquement par l'admin)
                            </div>
                        )}
                        <div className="flex items-center gap-4 flex-wrap bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Filtrer par</span>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-[200px] bg-zinc-950/50 border-white/10 h-10 rounded-xl focus:border-cyan-500/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-white/10">
                                        <SelectItem value="ALL">Toutes les offres</SelectItem>
                                        {(Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {filteredListings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                                <Key className="h-8 w-8 text-zinc-600 mb-3" />
                                <p className="text-zinc-500 text-sm font-bold">Aucun service publié</p>
                                <p className="text-zinc-600 text-xs mt-1">
                                    {globalSearch ? `Aucun résultat pour "${globalSearch}"` : "Sois le premier à proposer un service !"}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredListings.map((listing) => (
                                    <ServiceCard key={listing.id} listing={listing} guildId={guildId} currentProfileId={profileId} isAdmin={isAdmin} servicesDiscordConfigured={servicesDiscordConfigured} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TAB: Prêts */}
            <div className={tab === "prets" ? "block" : "hidden"}>
                {isLoansDisabled ? (
                    <MaintenanceView label="Prêts" message={maintenance?.serviceLoansMessage} />
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {maintenance && !maintenance.serviceLoansEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                <AlertTriangle className="w-3 h-3" /> Sous maintenance (Visible uniquement par l'admin)
                            </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Statut</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Pills filtre */}
                                {([
                                    { key: "ACTIVE", label: "En cours", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]", badge: activeLoanCount },
                                    { key: "MINE", label: "Mes prêts", color: "border-violet-500/40 bg-violet-500/10 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]", badge: null },
                                    { key: "ARCHIVED", label: "Historique", color: "border-white/10 bg-white/5 text-zinc-400 shadow-none", badge: archivedLoanCount },
                                ] as const).map(({ key, label, color, badge }) => (
                                    <button
                                        key={key}
                                        onClick={() => setLoanFilter(key)}
                                        className={cn(
                                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all duration-300",
                                            loanFilter === key ? color : "border-white/5 bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                        )}
                                    >
                                        {label}
                                        {badge !== null && badge > 0 && (
                                            <span className={cn(
                                                "min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1",
                                                loanFilter === key ? "bg-white/20 text-white" : "bg-white/10 text-zinc-500"
                                            )}>
                                                {badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {filteredLoans.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                                <Handshake className="h-8 w-8 text-zinc-600 mb-3" />
                                <p className="text-zinc-500 text-sm font-bold">Aucun prêt enregistré</p>
                                <p className="text-zinc-600 text-xs mt-1">
                                    {globalSearch ? `Aucun résultat pour "${globalSearch}"` : "Les prêts entre membres apparaîtront ici."}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredLoans.map((loan) => (
                                    <LoanCard key={loan.id} loan={loan} guildId={guildId} currentProfileId={profileId} isAdmin={isAdmin} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TAB: Coffre */}
            <div className={tab === "coffre" ? "block" : "hidden"}>
                {isVaultDisabled ? (
                    <MaintenanceView label="Coffre" message={maintenance?.serviceVaultMessage} />
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {maintenance && !maintenance.serviceVaultEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                <AlertTriangle className="w-3 h-3" /> Sous maintenance (Visible uniquement par l'admin)
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-3">
                            {canCreate ? (
                                <Button
                                    disabled={discordBlocked}
                                    onClick={() => setShowVaultForm(true)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 disabled:shadow-none"
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Enregistrer
                                </Button>
                            ) : (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white/[0.02] border border-white/5 rounded-lg px-3 h-9">
                                    <Lock className="h-3 w-3" /> Permission requise
                                </div>
                            )}
                        </div>
                        <VaultTable entries={filteredVault} summary={vaultSummary} guildId={guildId} currentProfileId={profileId} isAdmin={isAdmin} />
                    </div>
                )}
            </div>

            {/* Dialogs */}
            <ServiceForm open={showServiceForm} onOpenChange={setShowServiceForm} guildId={guildId} />
            <LoanForm
                open={showLoanForm}
                onOpenChange={setShowLoanForm}
                guildId={guildId}
                currentProfileId={profileId}
                isDiscordConfigured={loansDiscordConfigured}
            />
            <VaultForm
                open={showVaultForm}
                onOpenChange={setShowVaultForm}
                guildId={guildId}
                isDiscordConfigured={vaultDiscordConfigured}
            />
        </div>
    );
}