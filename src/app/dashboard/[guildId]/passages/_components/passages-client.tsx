"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Key, Handshake, Vault, Lock } from "lucide-react";
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
}

const TAB_CONFIG: { key: Tab; label: string; icon: typeof Key; color: string; activeClass: string }[] = [
    { key: "services", label: "Services", icon: Key, color: "cyan", activeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" },
    { key: "prets", label: "Prêts", icon: Handshake, color: "amber", activeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
    { key: "coffre", label: "Coffre", icon: Vault, color: "emerald", activeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
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
}: PassagesClientProps) {
    const [tab, setTab] = useState<Tab>("services");
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [showLoanForm, setShowLoanForm] = useState(false);
    const [showVaultForm, setShowVaultForm] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

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
            {/* Header */}
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <Key className="w-12 h-12 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-white">Services Guilde</h1>
                    <p className="text-zinc-400 text-sm">Marketplace, prêts et coffre de guilde.</p>
                </div>
                {/* Global search bar */}
                <div className="relative w-64 hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        placeholder="Recherche globale..."
                        className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
                    />
                </div>
            </div>

            {/* Mobile search */}
            <div className="relative md:hidden">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Recherche globale..."
                    className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
                />
            </div>

            {/* Tabs */}
            <div ref={tabsRef} className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
                {TAB_CONFIG.map((t) => {
                    const isActive = tab === t.key;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => handleTabChange(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${isActive ? t.activeClass : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"}`}
                        >
                            <Icon className="h-4 w-4" />
                            {t.label}
                            {t.key === "prets" && activeLoanCount > 0 && (
                                <Badge className="h-4 px-1.5 text-[9px] bg-amber-500/20 text-amber-400 border-0">
                                    {activeLoanCount}
                                </Badge>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB: Services */}
            <div className={tab === "services" ? "block" : "hidden"}>
                <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-white/10">
                                <SelectItem value="ALL">Toutes catégories</SelectItem>
                                {(Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex-1" />
                        {canCreate ? (
                            <Button onClick={() => setShowServiceForm(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-9">
                                <Plus className="h-4 w-4 mr-1" /> Publier
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white/[0.02] border border-white/5 rounded-lg px-3 h-9">
                                <Lock className="h-3 w-3" /> Permission requise
                            </div>
                        )}
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
                                <ServiceCard key={listing.id} listing={listing} guildId={guildId} currentProfileId={profileId} isAdmin={isAdmin} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* TAB: Prêts */}
            <div className={tab === "prets" ? "block" : "hidden"}>
                <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Pills filtre */}
                        {([
                            { key: "ACTIVE", label: "En cours", color: "border-cyan-500/50 bg-cyan-500/10 text-cyan-300", badge: activeLoanCount },
                            { key: "MINE", label: "Mes prêts", color: "border-violet-500/50 bg-violet-500/10 text-violet-300", badge: null },
                            { key: "ARCHIVED", label: "Archives", color: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400", badge: archivedLoanCount },
                        ] as const).map(({ key, label, color, badge }) => (
                            <button
                                key={key}
                                onClick={() => setLoanFilter(key)}
                                className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${loanFilter === key ? color : "border-white/8 bg-white/3 text-zinc-600 hover:text-zinc-400 hover:border-white/15"
                                    }`}
                            >
                                {label}
                                {badge !== null && badge > 0 && (
                                    <span className={`min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1 ${loanFilter === key
                                            ? key === "ARCHIVED" ? "bg-zinc-600 text-zinc-200" : "bg-cyan-500/30 text-cyan-200"
                                            : "bg-white/10 text-zinc-400"
                                        }`}>
                                        {badge}
                                    </span>
                                )}
                            </button>
                        ))}
                        <div className="flex-1" />
                        {canCreate ? (
                            <Button onClick={() => setShowLoanForm(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-9">
                                <Plus className="h-4 w-4 mr-1" /> Nouveau prêt
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white/[0.02] border border-white/5 rounded-lg px-3 h-9">
                                <Lock className="h-3 w-3" /> Permission requise
                            </div>
                        )}
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
            </div>

            {/* TAB: Coffre */}
            <div className={tab === "coffre" ? "block" : "hidden"}>
                <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-end gap-3">
                        {canCreate ? (
                            <Button onClick={() => setShowVaultForm(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9">
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
            </div>

            {/* Dialogs */}
            <ServiceForm open={showServiceForm} onOpenChange={setShowServiceForm} guildId={guildId} />
            <LoanForm
                open={showLoanForm}
                onOpenChange={setShowLoanForm}
                guildId={guildId}
                currentProfileId={profileId}
            />
            <VaultForm open={showVaultForm} onOpenChange={setShowVaultForm} guildId={guildId} />
        </div>
    );
}
