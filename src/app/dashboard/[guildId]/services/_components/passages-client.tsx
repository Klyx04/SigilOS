"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { type ServiceListingWithProfile, type ServiceRequestWithDetails } from "@/server/actions/service-actions";
import { CATEGORY_LABELS } from "@/server/actions/services-constants";
import { type LoanWithProfiles } from "@/server/actions/loan-actions";
import { type VaultEntryWithProfile, type VaultSummaryItem } from "@/server/actions/vault-actions";
import { type ServiceFeedbackWithProvider, type ProviderRanking } from "@/server/actions/service-feedback-actions";
import { FeedbacksView } from "./feedbacks-view";
import { FeedbackModal } from "./feedback-modal";
import { ServiceRequestsView } from "./service-requests-view";
import { ServiceCategory } from "@prisma/client";
import { Star, MessageSquareHeart, Sparkles, Clock } from "lucide-react";

type Tab = "services" | "demandes" | "feedbacks" | "prets" | "coffre";

interface PassagesClientProps {
    guildId: string;
    userId?: string;
    profileId?: string;
    isAdmin: boolean;
    canCreate: boolean;
    listings: ServiceListingWithProfile[];
    requests?: ServiceRequestWithDetails[];
    feedbacks?: ServiceFeedbackWithProvider[];
    rankings?: ProviderRanking[];
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
    // #71 — prévisu du salon dans la modale de prêt
    loansChannelName?: string | null;
}

export function PassagesClient({
    guildId,
    userId,
    profileId,
    isAdmin,
    canCreate,
    listings,
    requests = [],
    feedbacks = [],
    rankings = [],
    loans,
    vaultEntries,
    vaultSummary,
    maintenance,
    servicesDiscordConfigured = false,
    loansDiscordConfigured = false,
    vaultDiscordConfigured = false,
    loansChannelName = null,
}: PassagesClientProps) {
    const [tab, setTab] = useState<Tab>("services");
    const searchParams = useSearchParams();
    const router = useRouter();

    const [showServiceForm, setShowServiceForm] = useState(false);
    const [showLoanForm, setShowLoanForm] = useState(false);
    const [showVaultForm, setShowVaultForm] = useState(false);
    const [feedbackTarget, setFeedbackTarget] = useState<{
        providerProfileId: string;
        providerName: string;
        serviceTitle: string;
        serviceCategory: ServiceCategory;
        serviceListingId?: string;
        serviceRequestId?: string;
    } | null>(null);
    const tabsRef = useRef<HTMLDivElement>(null);

    const clearFeedbackParam = () => {
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.has("feedback")) {
                url.searchParams.delete("feedback");
                window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
            }
        }
    };

    // Auto-select tab and open feedback modal if URL parameters are present (?feedback=token or ?tab=demandes)
    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam && ["services", "demandes", "feedbacks", "prets", "coffre"].includes(tabParam)) {
            setTab(tabParam as Tab);
        }

        const feedbackParam = searchParams.get("feedback");
        if (feedbackParam) {
            const found = requests.find(
                (r) => r.feedbackToken === feedbackParam || r.id === feedbackParam || feedbackParam.startsWith(r.id)
            );
            if (found && !found.hasFeedback) {
                setFeedbackTarget({
                    providerProfileId: found.providerProfileId,
                    providerName: found.providerProfile?.pseudoDofus || found.providerProfile?.discordNickname || "Prestataire",
                    serviceTitle: found.listing.title,
                    serviceCategory: found.listing.category,
                    serviceListingId: found.listingId,
                    serviceRequestId: found.id,
                });
            }
            // Nettoie l'URL pour ne pas rouvrir la modale à chaque rafraîchissement
            clearFeedbackParam();
        }
    }, [searchParams, requests]);

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
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-border rounded-2xl bg-surface/40 relative overflow-hidden group p-8 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute inset-0 bg-gradient-to-b from-warning/5 to-transparent opacity-50" />
            <div className="relative z-10 space-y-4 max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto ">
                    <Lock className="w-10 h-10 text-warning" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Espace en maintenance</h3>
                    <p className="text-warning/80 text-xs font-black uppercase tracking-[0.2em] mt-1">{label}</p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-border backdrop-blur-sm">
                    <p className="text-foreground text-sm leading-relaxed italic">
                        "{message || "Cet onglet est temporairement désactivé par un administrateur. Revenez plus tard !"}"
                    </p>
                </div>
                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">SigilOS Safety Protocol</p>
            </div>
        </div>
    );

    const handleTabChange = (t: Tab) => {
        setTab(t);
    };

    // Recherche unique — s'applique à l'onglet courant (marketplace, demandes, livre d'or, prêts, coffre).
    // Un seul état évite les doubles barres de recherche et les largeurs instables au switch d'onglet.
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
    const pendingRequestCount = requests.filter(r => r.status === "PENDING").length;
    const showMarketplaceCta = tab === "services" && canCreate && !isMarketplaceDisabled;
    const showLoansCta = tab === "prets" && canCreate && !isLoansDisabled;
    const showVaultCta = tab === "coffre" && canCreate && !isVaultDisabled;

    return (
        <div className="space-y-5">
            {/* Navigation unifiée & Actions — barre à dimensions fixes (anti-CLS au switch d'onglet) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
                {/* Tabs bar */}
                <div ref={tabsRef} data-tour="services-tabs" className="flex items-center gap-1 p-1 bg-surface/80 rounded-xl border border-border overflow-x-auto no-scrollbar min-h-[40px] sm:max-w-[60%]">
                    <button
                        onClick={() => handleTabChange("services")}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0",
                            tab === "services"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <Key className="w-3.5 h-3.5" />
                        Marketplace
                        <span className={cn(
                            "text-[11px] px-1.5 rounded-full font-bold min-w-[26px] h-4 inline-flex items-center justify-center tabular-nums",
                            tab === "services" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            {listings.length}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange("demandes")}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0",
                            tab === "demandes"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Demandes
                        <span
                            aria-hidden={pendingRequestCount === 0}
                            className={cn(
                                "h-4 min-w-[20px] px-1 rounded-full text-[10px] font-black inline-flex items-center justify-center tabular-nums",
                                pendingRequestCount > 0
                                    ? "bg-warning text-warning-foreground"
                                    : "invisible"
                            )}
                        >
                            {pendingRequestCount}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange("feedbacks")}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0",
                            tab === "feedbacks"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <Star className="w-3.5 h-3.5" />
                        Livre d'or
                        <span className={cn(
                            "text-[11px] px-1.5 rounded-full font-bold min-w-[26px] h-4 inline-flex items-center justify-center tabular-nums",
                            feedbacks.length > 0
                                ? (tab === "feedbacks" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")
                                : "invisible"
                        )}>
                            {feedbacks.length}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange("prets")}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0",
                            tab === "prets"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <Handshake className="w-3.5 h-3.5" />
                        Prêts
                        <span
                            aria-hidden={activeLoanCount === 0}
                            className={cn(
                                "h-4 min-w-[20px] px-1 rounded-full text-[10px] font-black inline-flex items-center justify-center tabular-nums",
                                activeLoanCount > 0
                                    ? "bg-warning text-warning-foreground"
                                    : "invisible"
                            )}
                        >
                            {activeLoanCount}
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabChange("coffre")}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0",
                            tab === "coffre"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <Vault className="w-3.5 h-3.5" />
                        Coffre
                    </button>
                </div>

                {/* Right controls: Search & Primary Action — largeurs fixes, hauteur stable */}
                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto min-h-[36px]">
                    <div className="relative flex-1 sm:flex-none sm:w-60 shrink-0">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            placeholder={
                                tab === "demandes" ? "Rechercher une demande..." :
                                tab === "feedbacks" ? "Rechercher un avis..." :
                                tab === "prets" ? "Rechercher un prêt..." :
                                tab === "coffre" ? "Rechercher un item..." :
                                "Rechercher..."
                            }
                            className="pl-9 h-9 w-full bg-surface/80 border-border text-xs rounded-xl focus:border-primary"
                        />
                    </div>

                    <div className="shrink-0 sm:min-w-[160px] flex items-center justify-end">
                        {showMarketplaceCta ? (
                            <Button
                                data-tour="services-create"
                                disabled={discordBlocked}
                                onClick={() => setShowServiceForm(true)}
                                size="sm"
                                className="h-9 px-3.5 text-xs font-bold rounded-xl shadow-xs whitespace-nowrap"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Publier une offre
                            </Button>
                        ) : showLoansCta ? (
                            <Button
                                disabled={discordBlocked}
                                onClick={() => setShowLoanForm(true)}
                                size="sm"
                                className="h-9 px-3.5 text-xs font-bold rounded-xl shadow-xs whitespace-nowrap"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouveau prêt
                            </Button>
                        ) : showVaultCta ? (
                            <Button
                                disabled={discordBlocked}
                                onClick={() => setShowVaultForm(true)}
                                size="sm"
                                className="h-9 px-3.5 text-xs font-bold rounded-xl shadow-xs whitespace-nowrap"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Enregistrer un item
                            </Button>
                        ) : (
                            <div className="h-9 hidden sm:block sm:w-[160px]" aria-hidden="true" />
                        )}
                    </div>
                </div>
            </div>

            {!isCurrentDiscordConfigured && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                        <p className="font-bold">Salon Discord non configuré</p>
                        <p className="text-muted-foreground text-[11px] mt-0.5">Le salon de notifications n'est pas renseigné dans l'administration (Paramètres {'>'} Services). Les créations d'offres et prêts sont désactivées.</p>
                    </div>
                </div>
            )}

            {/* TAB: Services */}
            <div className={tab === "services" ? "block" : "hidden"} data-tour="services-board">
                {isMarketplaceDisabled ? (
                    <MaintenanceView label="Services" message={maintenance?.serviceMarketplaceMessage} />
                ) : (
                    <div className="space-y-4 min-h-[420px]">
                        {maintenance && !maintenance.serviceMarketplaceEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs font-bold mb-3">
                                <AlertTriangle className="w-3.5 h-3.5" /> Mode maintenance actif (Visible uniquement par l'admin)
                            </div>
                        )}

                        {/* Filtre de catégorie — hauteur fixe min-h-[36px], même gabarit que les autres onglets */}
                        <div className="flex items-center justify-between gap-3 pt-1 min-h-[36px]">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold text-muted-foreground">Catégorie :</span>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-[190px] bg-surface/80 border-border h-9 text-xs rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                        <SelectItem value="ALL">Toutes les offres</SelectItem>
                                        {(Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <span className="text-xs text-muted-foreground">
                                {filteredListings.length} {filteredListings.length > 1 ? "offres disponibles" : "offre disponible"}
                            </span>
                        </div>

                        {filteredListings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-border rounded-xl bg-surface">
                                <Key className="h-8 w-8 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground text-sm font-bold">Aucun service publié</p>
                                <p className="text-muted-foreground text-xs mt-1">
                                    {globalSearch ? `Aucun résultat pour "${globalSearch}"` : "Sois le premier à proposer un service !"}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredListings.map((listing) => (
                                    <ServiceCard
                                        key={listing.id}
                                        listing={listing}
                                        guildId={guildId}
                                        currentProfileId={profileId}
                                        isAdmin={isAdmin}
                                        servicesDiscordConfigured={servicesDiscordConfigured}
                                        onFeedbackClick={() => {
                                            const providerName = listing.profile.pseudoDofus || listing.profile.discordNickname || listing.profile.user?.name || listing.title;
                                            setGlobalSearch(providerName);
                                            setTab("feedbacks");
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TAB: Demandes en cours */}
            <div className={tab === "demandes" ? "block min-h-[420px]" : "hidden"}>
                <ServiceRequestsView
                    guildId={guildId}
                    requests={requests}
                    currentUserId={userId}
                    currentProfileId={profileId}
                    isAdmin={isAdmin}
                    searchQuery={globalSearch}
                    onSearchQueryChange={setGlobalSearch}
                    onLeaveFeedback={(req) => setFeedbackTarget({
                        providerProfileId: req.providerProfileId,
                        providerName: req.providerProfile?.pseudoDofus || req.providerProfile?.discordNickname || "Prestataire",
                        serviceTitle: req.listing.title,
                        serviceCategory: req.listing.category,
                        serviceListingId: req.listingId,
                        serviceRequestId: req.id,
                    })}
                />
            </div>

            {/* TAB: Livre d'or & Feedbacks */}
            <div className={tab === "feedbacks" ? "block min-h-[420px]" : "hidden"}>
                <FeedbacksView
                    guildId={guildId}
                    feedbacks={feedbacks}
                    rankings={rankings}
                    isAdmin={isAdmin}
                    searchQuery={globalSearch}
                    onSearchQueryChange={setGlobalSearch}
                />
            </div>

            {/* TAB: Prêts */}
            <div className={tab === "prets" ? "block" : "hidden"}>
                {isLoansDisabled ? (
                    <MaintenanceView label="Prêts" message={maintenance?.serviceLoansMessage} />
                ) : (
                    <div className="space-y-4 min-h-[420px]">
                        {maintenance && !maintenance.serviceLoansEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs font-bold mb-3">
                                <AlertTriangle className="w-3.5 h-3.5" /> Mode maintenance actif (Visible uniquement par l'admin)
                            </div>
                        )}

                        {/* Filtre de statut — hauteur fixe min-h-[36px], même gabarit que les autres onglets */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 min-h-[36px]">
                            <span className="text-xs font-bold text-muted-foreground mr-1">Statut :</span>
                            {([
                                { key: "ACTIVE", label: "En cours", badge: activeLoanCount },
                                { key: "MINE", label: "Mes prêts", badge: null },
                                { key: "ARCHIVED", label: "Historique", badge: archivedLoanCount },
                            ] as const).map(({ key, label, badge }) => (
                                <button
                                    key={key}
                                    onClick={() => setLoanFilter(key)}
                                    className={cn(
                                        "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors",
                                        loanFilter === key
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface/80"
                                    )}
                                >
                                    {label}
                                    {badge !== null && badge > 0 && (
                                        <span className={cn(
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                                            loanFilter === key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            {badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {filteredLoans.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-border rounded-xl bg-surface">
                                <Handshake className="h-8 w-8 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground text-sm font-bold">Aucun prêt enregistré</p>
                                <p className="text-muted-foreground text-xs mt-1">
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

            {/* TAB: Coffre — création via le CTA unique du header (pas de double bouton, anti-CLS) */}
            <div className={tab === "coffre" ? "block" : "hidden"}>
                {isVaultDisabled ? (
                    <MaintenanceView label="Coffre" message={maintenance?.serviceVaultMessage} />
                ) : (
                    <div className="space-y-4 min-h-[420px]">
                        {maintenance && !maintenance.serviceVaultEnabled && isAdmin && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-black uppercase tracking-widest mb-4">
                                <AlertTriangle className="w-3 h-3" /> Sous maintenance (Visible uniquement par l'admin)
                            </div>
                        )}
                        {!canCreate && (
                            <div className="flex items-center justify-end gap-3 min-h-[36px]">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface border border-border rounded-lg px-3 h-9">
                                    <Lock className="h-3 w-3" /> Permission requise
                                </div>
                            </div>
                        )}
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
                channelName={loansChannelName}
            />
            <VaultForm
                open={showVaultForm}
                onOpenChange={setShowVaultForm}
                guildId={guildId}
                isDiscordConfigured={vaultDiscordConfigured}
            />
            {feedbackTarget && (
                <FeedbackModal
                    isOpen={!!feedbackTarget}
                    onClose={() => {
                        setFeedbackTarget(null);
                        clearFeedbackParam();
                    }}
                    onSuccess={() => {
                        setFeedbackTarget(null);
                        clearFeedbackParam();
                        router.refresh();
                    }}
                    guildId={guildId}
                    providerProfileId={feedbackTarget.providerProfileId}
                    providerName={feedbackTarget.providerName}
                    serviceTitle={feedbackTarget.serviceTitle}
                    serviceCategory={feedbackTarget.serviceCategory}
                    serviceListingId={feedbackTarget.serviceListingId}
                    serviceRequestId={feedbackTarget.serviceRequestId}
                />
            )}
        </div>
    );
}