"use client";

/**
 * Listes filtrables de la fiche visiteur — succès, avis et métiers.
 *
 * Le serveur borne les listes (`PUBLIC_PROFILE_*_TAKE`) ; ce composant client ne fait que
 * filtrer/paginer **ce qu'il reçoit** : recherche accent-insensible, personnage, donjon/zone,
 * niveau minimum, puis « Voir plus ». Aucune requête, aucun secret.
 */

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Crosshair, Hammer, Search, Trophy } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { VisitorAchievement, VisitorBounty, VisitorJob } from "@/lib/public-directory";
import { MAIN_CHARACTER_SLOT } from "@/lib/succes-characters";
import type { Translations } from "@/lib/i18n/locales/fr";
import { cn } from "@/lib/utils";
import {
    VISITOR_PROFILE_FILTER_ALL,
    VISITOR_PROFILE_JOBS_PAGE_SIZE,
    VISITOR_PROFILE_LIST_PAGE_SIZE,
    filterVisitorAchievements,
    filterVisitorBounties,
    filterVisitorJobs,
    sortVisitorAchievements,
    sortVisitorBounties,
    visitorCharacterSlots,
    visitorDungeonNames,
    visitorVisibleSlice,
    visitorZoneNames,
    type VisitorProfileAchievementSort,
    type VisitorProfileBountySort,
} from "@/lib/visitor-profile-filters";

type Labels = Translations["visitorsPage"];

type VisitorProfileListsProps = {
    achievements: VisitorAchievement[];
    achievementsTotal: number;
    bounties: VisitorBounty[];
    bountiesTotal: number;
    jobs: VisitorJob[];
    labels: Labels;
};

function characterLabel(slot: string, labels: Labels): string {
    return slot === MAIN_CHARACTER_SLOT ? labels.profile.mainCharacter : slot;
}

function SearchBox({
    value,
    onChange,
    placeholder,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
}) {
    return (
        <div className="relative min-w-0 flex-1 sm:min-w-[12rem]">
            <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
            />
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={label}
                className="h-8 pl-8 text-xs"
            />
        </div>
    );
}

function FilterSelect({
    value,
    onChange,
    label,
    allLabel,
    options,
    showAll = true,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    allLabel: string;
    options: Array<{ value: string; label: string; icon?: string | null }>;
    /** `false` pour un sélecteur de tri : la valeur courante est toujours une option. */
    showAll?: boolean;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger
                aria-label={label}
                className="h-8 w-full rounded-lg border-border bg-background/60 text-xs sm:w-[11rem]"
            >
                <SelectValue placeholder={allLabel} />
            </SelectTrigger>
            <SelectContent className="border-border bg-surface">
                {showAll ? (
                    <SelectItem value={VISITOR_PROFILE_FILTER_ALL}>{allLabel}</SelectItem>
                ) : null}
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.icon ? (
                            <GameIcon src={option.icon} className="size-4 shrink-0" />
                        ) : null}
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/**
 * Filtre donjon / zone **recherchable** — le `Select` natif déroulait toute la base
 * (constat user : « le drop down de dj »). Le panneau garde les mêmes options, mais avec
 * un champ de recherche : on tape « aka » et la liste se réduit, au lieu de scroller 200 lignes.
 */
function SearchableFilter({
    value,
    onChange,
    label,
    allLabel,
    options,
    searchPlaceholder,
    emptyLabel,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    allLabel: string;
    options: Array<{ value: string; label: string; icon?: string | null }>;
    searchPlaceholder: string;
    emptyLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((option) => option.value === value);
    const selected =
        value === VISITOR_PROFILE_FILTER_ALL ? allLabel : selectedOption?.label ?? allLabel;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={label}
                    className="h-8 w-full justify-between gap-1 rounded-lg border-border bg-background/60 px-2 text-xs font-normal sm:w-[11rem]"
                >
                    {selectedOption?.icon ? (
                        <GameIcon src={selectedOption.icon} className="size-4 shrink-0" />
                    ) : null}
                    <span className="truncate">{selected}</span>
                    <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
                    <CommandList className="max-h-64">
                        <CommandEmpty className="p-3 text-xs text-muted-foreground">
                            {emptyLabel}
                        </CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={allLabel}
                                onSelect={() => {
                                    onChange(VISITOR_PROFILE_FILTER_ALL);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "size-3.5",
                                        value === VISITOR_PROFILE_FILTER_ALL
                                            ? "opacity-100"
                                            : "opacity-0"
                                    )}
                                    aria-hidden="true"
                                />
                                {allLabel}
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "size-3.5",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                        aria-hidden="true"
                                    />
                                    {option.icon ? (
                                        <GameIcon src={option.icon} className="size-4 shrink-0" />
                                    ) : null}
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function VisitorProfileLists(props: VisitorProfileListsProps) {
    const [jobQuery, setJobQuery] = useState("");
    const [jobLevel, setJobLevel] = useState<string>(VISITOR_PROFILE_FILTER_ALL);
    const [jobVisible, setJobVisible] = useState(VISITOR_PROFILE_JOBS_PAGE_SIZE);

    const [achievementQuery, setAchievementQuery] = useState("");
    const [achievementCharacter, setAchievementCharacter] = useState<string>(
        VISITOR_PROFILE_FILTER_ALL
    );
    const [achievementDungeon, setAchievementDungeon] = useState<string>(
        VISITOR_PROFILE_FILTER_ALL
    );
    const [achievementVisible, setAchievementVisible] = useState(
        VISITOR_PROFILE_LIST_PAGE_SIZE
    );
    const [achievementSort, setAchievementSort] =
        useState<VisitorProfileAchievementSort>("dungeon");

    const [bountyQuery, setBountyQuery] = useState("");
    const [bountyCharacter, setBountyCharacter] = useState<string>(VISITOR_PROFILE_FILTER_ALL);
    const [bountyZone, setBountyZone] = useState<string>(VISITOR_PROFILE_FILTER_ALL);
    const [bountyVisible, setBountyVisible] = useState(VISITOR_PROFILE_LIST_PAGE_SIZE);
    const [bountySort, setBountySort] = useState<VisitorProfileBountySort>("zone");

    const achievementCharacters = useMemo(
        () => visitorCharacterSlots(props.achievements, MAIN_CHARACTER_SLOT),
        [props.achievements]
    );
    const achievementDungeons = useMemo(
        () => visitorDungeonNames(props.achievements),
        [props.achievements]
    );
    const achievementCharacterOptions = useMemo(
        () =>
            achievementCharacters.map((slot) => ({
                value: slot,
                label: characterLabel(slot, props.labels),
            })),
        [achievementCharacters, props.labels]
    );
    const achievementDungeonOptions = useMemo(() => {
        const icons = new Map<string, string | null>();
        for (const achievement of props.achievements) {
            if (!icons.has(achievement.dungeonName)) {
                icons.set(achievement.dungeonName, achievement.dungeonImageUrl);
            }
        }
        return achievementDungeons.map((dungeon) => {
            const icon = icons.get(dungeon);
            return {
                value: dungeon,
                label: dungeon,
                icon: icon?.startsWith("/") ? icon : null,
            };
        });
    }, [achievementDungeons, props.achievements]);

    const bountyCharacters = useMemo(
        () => visitorCharacterSlots(props.bounties, MAIN_CHARACTER_SLOT),
        [props.bounties]
    );
    const bountyZones = useMemo(() => visitorZoneNames(props.bounties), [props.bounties]);
    const bountyCharacterOptions = useMemo(
        () =>
            bountyCharacters.map((slot) => ({
                value: slot,
                label: characterLabel(slot, props.labels),
            })),
        [bountyCharacters, props.labels]
    );
    const bountyZoneOptions = useMemo(
        () => bountyZones.map((zone) => ({ value: zone, label: zone })),
        [bountyZones]
    );

    const jobLevelOptions = [200, 150, 100, 50].map((level) => ({
        value: String(level),
        label: props.labels.profile.filterLevelPlus.replace("{n}", String(level)),
    }));
    const achievementSortOptions = [
        { value: "dungeon", label: props.labels.profile.sortByDungeon },
        { value: "name", label: props.labels.profile.sortByName },
        { value: "points", label: props.labels.profile.sortByPoints },
    ];
    const bountySortOptions = [
        { value: "zone", label: props.labels.profile.sortByZone },
        { value: "name", label: props.labels.profile.sortByName },
        { value: "level", label: props.labels.profile.sortByLevel },
    ];

    const filteredJobs = useMemo(
        () =>
            filterVisitorJobs(
                props.jobs,
                jobQuery,
                jobLevel === VISITOR_PROFILE_FILTER_ALL ? null : Number(jobLevel)
            ),
        [props.jobs, jobQuery, jobLevel]
    );
    const filteredAchievements = useMemo(
        () =>
            filterVisitorAchievements(
                props.achievements,
                achievementQuery,
                achievementCharacter,
                achievementDungeon
            ),
        [props.achievements, achievementQuery, achievementCharacter, achievementDungeon]
    );
    const filteredBounties = useMemo(
        () =>
            filterVisitorBounties(
                props.bounties,
                bountyQuery,
                bountyCharacter,
                bountyZone
            ),
        [props.bounties, bountyQuery, bountyCharacter, bountyZone]
    );

    const sortedAchievements = useMemo(
        () => sortVisitorAchievements(filteredAchievements, achievementSort),
        [filteredAchievements, achievementSort]
    );
    const sortedBounties = useMemo(
        () => sortVisitorBounties(filteredBounties, bountySort),
        [filteredBounties, bountySort]
    );

    const shownAchievements = visitorVisibleSlice(sortedAchievements, achievementVisible);
    const shownBounties = visitorVisibleSlice(sortedBounties, bountyVisible);
    const shownJobs = visitorVisibleSlice(filteredJobs, jobVisible);

    const jobsFiltered = jobQuery.trim() !== "" || jobLevel !== VISITOR_PROFILE_FILTER_ALL;
    const achievementsFiltered =
        achievementQuery.trim() !== "" ||
        achievementCharacter !== VISITOR_PROFILE_FILTER_ALL ||
        achievementDungeon !== VISITOR_PROFILE_FILTER_ALL;
    const bountiesFiltered =
        bountyQuery.trim() !== "" ||
        bountyCharacter !== VISITOR_PROFILE_FILTER_ALL ||
        bountyZone !== VISITOR_PROFILE_FILTER_ALL;
    /**
     * La liste des succès n'est **pas** un mur par défaut : un donjon (ou une recherche)
     * doit être choisi. `all` seul affiche le nombre de donjons, jamais les 200 lignes.
     */
    const achievementListActive =
        achievementDungeon !== VISITOR_PROFILE_FILTER_ALL || achievementQuery.trim() !== "";

    const updateAchievementQuery = (value: string) => {
        setAchievementQuery(value);
        setAchievementVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateAchievementCharacter = (value: string) => {
        setAchievementCharacter(value);
        setAchievementVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateAchievementDungeon = (value: string) => {
        setAchievementDungeon(value);
        setAchievementVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateAchievementSort = (value: string) => {
        setAchievementSort(value as VisitorProfileAchievementSort);
        setAchievementVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const resetAchievements = () => {
        setAchievementQuery("");
        setAchievementCharacter(VISITOR_PROFILE_FILTER_ALL);
        setAchievementDungeon(VISITOR_PROFILE_FILTER_ALL);
        setAchievementVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };

    const updateBountyQuery = (value: string) => {
        setBountyQuery(value);
        setBountyVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateBountyCharacter = (value: string) => {
        setBountyCharacter(value);
        setBountyVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateBountyZone = (value: string) => {
        setBountyZone(value);
        setBountyVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const updateBountySort = (value: string) => {
        setBountySort(value as VisitorProfileBountySort);
        setBountyVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };
    const resetBounties = () => {
        setBountyQuery("");
        setBountyCharacter(VISITOR_PROFILE_FILTER_ALL);
        setBountyZone(VISITOR_PROFILE_FILTER_ALL);
        setBountyVisible(VISITOR_PROFILE_LIST_PAGE_SIZE);
    };

    const resetJobs = () => {
        setJobQuery("");
        setJobLevel(VISITOR_PROFILE_FILTER_ALL);
        setJobVisible(VISITOR_PROFILE_JOBS_PAGE_SIZE);
    };

    const updateJobQuery = (value: string) => {
        setJobQuery(value);
        setJobVisible(VISITOR_PROFILE_JOBS_PAGE_SIZE);
    };

    const updateJobLevel = (value: string) => {
        setJobLevel(value);
        setJobVisible(VISITOR_PROFILE_JOBS_PAGE_SIZE);
    };

    return (
        <>
            <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <Hammer className="size-3.5" aria-hidden="true" />
                        {props.labels.profile.jobs}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {filteredJobs.length} / {props.jobs.length}
                    </span>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <SearchBox
                        value={jobQuery}
                        onChange={updateJobQuery}
                        placeholder={props.labels.profile.filterSearchJobs}
                        label={props.labels.profile.jobs}
                    />
                    <FilterSelect
                        value={jobLevel}
                        onChange={updateJobLevel}
                        label={props.labels.profile.filterLevel}
                        allLabel={props.labels.profile.filterAllLevels}
                        options={jobLevelOptions}
                    />
                    {jobsFiltered ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetJobs}
                            className="h-8 px-2 text-xs text-muted-foreground"
                        >
                            {props.labels.profile.filterReset}
                        </Button>
                    ) : null}
                </div>
                {props.jobs.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.noJobs}
                    </p>
                ) : filteredJobs.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.filterNoResults}
                    </p>
                ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {shownJobs.map((job) => (
                            <li
                                key={job.id}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                            >
                                <GameIcon src={job.icon} className="size-4" />
                                <span className="max-w-[10rem] truncate">{job.name}</span>
                                <span className="reg-mono text-muted-foreground">{job.level}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {filteredJobs.length > jobVisible ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            setJobVisible((current) => current + VISITOR_PROFILE_JOBS_PAGE_SIZE)
                        }
                        className="mt-2 h-8 px-2 text-xs text-muted-foreground"
                    >
                        {props.labels.profile.filterShowMore.replace(
                            "{n}",
                            String(
                                Math.min(
                                    VISITOR_PROFILE_JOBS_PAGE_SIZE,
                                    filteredJobs.length - jobVisible
                                )
                            )
                        )}
                    </Button>
                ) : null}
            </section>

            <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <GameIcon
                            src="/assets/dofus/game-icons/trophy-1.png"
                            className="size-3.5"
                        />
                        {props.labels.profile.achievements}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {achievementListActive
                            ? filteredAchievements.length
                            : `${achievementDungeons.length} ${props.labels.profile.dungeonsCount}`}
                    </span>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <SearchBox
                        value={achievementQuery}
                        onChange={updateAchievementQuery}
                        placeholder={props.labels.profile.filterSearchAchievements}
                        label={props.labels.profile.achievements}
                    />
                    {achievementCharacters.length > 1 ? (
                        <FilterSelect
                            value={achievementCharacter}
                            onChange={updateAchievementCharacter}
                            label={props.labels.profile.filterCharacter}
                            allLabel={props.labels.profile.filterAllCharacters}
                            options={achievementCharacterOptions}
                        />
                    ) : null}
                    {achievementDungeons.length > 1 ? (
                        <SearchableFilter
                            value={achievementDungeon}
                            onChange={updateAchievementDungeon}
                            label={props.labels.profile.filterDungeon}
                            allLabel={props.labels.profile.filterAllDungeons}
                            options={achievementDungeonOptions}
                            searchPlaceholder={props.labels.profile.filterSearchDungeon}
                            emptyLabel={props.labels.profile.filterNoResults}
                        />
                    ) : null}
                    <FilterSelect
                        value={achievementSort}
                        onChange={updateAchievementSort}
                        label={props.labels.profile.filterSort}
                        allLabel={props.labels.profile.sortByDungeon}
                        options={achievementSortOptions}
                        showAll={false}
                    />
                    {achievementsFiltered ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetAchievements}
                            className="h-8 px-2 text-xs text-muted-foreground"
                        >
                            {props.labels.profile.filterReset}
                        </Button>
                    ) : null}
                </div>
                {props.achievements.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.noAchievements}
                    </p>
                ) : !achievementListActive ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        {props.labels.profile.chooseDungeon}
                    </p>
                ) : filteredAchievements.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.filterNoResults}
                    </p>
                ) : (
                    <div className="mt-3 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border bg-background/40 text-caption uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th scope="col" className="p-2 font-medium">
                                        {props.labels.profile.columnSuccess}
                                    </th>
                                    <th scope="col" className="hidden p-2 font-medium md:table-cell">
                                        {props.labels.profile.filterDungeon}
                                    </th>
                                    <th scope="col" className="hidden p-2 font-medium sm:table-cell">
                                        {props.labels.profile.columnPoints}
                                    </th>
                                    <th scope="col" className="p-2 text-right font-medium">
                                        {props.labels.profile.filterCharacter}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {shownAchievements.map((achievement) => (
                                    <tr
                                        key={`${achievement.id}:${achievement.characterSlot}`}
                                        className="transition-colors hover:bg-elevated/40"
                                    >
                                        <td className="p-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {achievement.iconUrl ? (
                                                    <GameIcon
                                                        src={achievement.iconUrl}
                                                        className="size-5 shrink-0"
                                                    />
                                                ) : (
                                                    <Trophy
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-medium text-foreground">
                                                        {achievement.name}
                                                    </p>
                                                    <p className="truncate text-caption text-muted-foreground md:hidden">
                                                        <span className="inline-flex min-w-0 items-center gap-1">
                                                            {achievement.dungeonImageUrl?.startsWith("/") ? (
                                                                <GameIcon
                                                                    src={achievement.dungeonImageUrl}
                                                                    className="size-3.5 shrink-0"
                                                                />
                                                            ) : null}
                                                            <span className="truncate">
                                                                {achievement.dungeonName}
                                                            </span>
                                                        </span>
                                                        <span className="sm:hidden">
                                                            {" "}
                                                            · {achievement.points}{" "}
                                                            {props.labels.profile.points}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden p-2 text-muted-foreground md:table-cell">
                                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                                {achievement.dungeonImageUrl?.startsWith("/") ? (
                                                    <GameIcon
                                                        src={achievement.dungeonImageUrl}
                                                        className="size-4 shrink-0"
                                                    />
                                                ) : null}
                                                <span className="truncate">
                                                    {achievement.dungeonName}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="hidden p-2 font-mono text-muted-foreground sm:table-cell">
                                            {achievement.points}
                                        </td>
                                        <td className="p-2 text-right">
                                            <CharacterBadge
                                                slot={achievement.characterSlot}
                                                labels={props.labels}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {achievementListActive && filteredAchievements.length > achievementVisible ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            setAchievementVisible(
                                (current) => current + VISITOR_PROFILE_LIST_PAGE_SIZE
                            )
                        }
                        className="mt-2 h-8 px-2 text-xs text-muted-foreground"
                    >
                        {props.labels.profile.filterShowMore.replace(
                            "{n}",
                            String(
                                Math.min(
                                    VISITOR_PROFILE_LIST_PAGE_SIZE,
                                    filteredAchievements.length - achievementVisible
                                )
                            )
                        )}
                    </Button>
                ) : null}
                {props.achievements.length < props.achievementsTotal ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {props.labels.profile.cappedAchievements.replace(
                            "{n}",
                            String(props.achievements.length)
                        )}
                    </p>
                ) : null}
            </section>

            <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <GameIcon src="/assets/avis/avitons.png" className="size-3.5" />
                        {props.labels.profile.bountiesSection}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {filteredBounties.length} / {props.bountiesTotal}
                    </span>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <SearchBox
                        value={bountyQuery}
                        onChange={updateBountyQuery}
                        placeholder={props.labels.profile.filterSearchBounties}
                        label={props.labels.profile.bountiesSection}
                    />
                    {bountyCharacters.length > 1 ? (
                        <FilterSelect
                            value={bountyCharacter}
                            onChange={updateBountyCharacter}
                            label={props.labels.profile.filterCharacter}
                            allLabel={props.labels.profile.filterAllCharacters}
                            options={bountyCharacterOptions}
                        />
                    ) : null}
                    {bountyZones.length > 1 ? (
                        <SearchableFilter
                            value={bountyZone}
                            onChange={updateBountyZone}
                            label={props.labels.profile.filterZone}
                            allLabel={props.labels.profile.filterAllZones}
                            options={bountyZoneOptions}
                            searchPlaceholder={props.labels.profile.filterSearchZone}
                            emptyLabel={props.labels.profile.filterNoResults}
                        />
                    ) : null}
                    <FilterSelect
                        value={bountySort}
                        onChange={updateBountySort}
                        label={props.labels.profile.filterSort}
                        allLabel={props.labels.profile.sortByZone}
                        options={bountySortOptions}
                        showAll={false}
                    />
                    {bountiesFiltered ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetBounties}
                            className="h-8 px-2 text-xs text-muted-foreground"
                        >
                            {props.labels.profile.filterReset}
                        </Button>
                    ) : null}
                </div>
                {props.bounties.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.noBounties}
                    </p>
                ) : filteredBounties.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.filterNoResults}
                    </p>
                ) : (
                    <div className="mt-3 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border bg-background/40 text-caption uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th scope="col" className="p-2 font-medium">
                                        {props.labels.profile.columnBounty}
                                    </th>
                                    <th scope="col" className="hidden p-2 font-medium md:table-cell">
                                        {props.labels.profile.filterZone}
                                    </th>
                                    <th scope="col" className="hidden p-2 font-medium sm:table-cell">
                                        {props.labels.profile.level}
                                    </th>
                                    <th scope="col" className="p-2 text-right font-medium">
                                        {props.labels.profile.filterCharacter}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {shownBounties.map((bounty) => (
                                    <tr
                                        key={`${bounty.id}:${bounty.characterSlot}`}
                                        className="transition-colors hover:bg-elevated/40"
                                    >
                                        <td className="p-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {bounty.imageUrl ? (
                                                    <GameIcon
                                                        src={bounty.imageUrl}
                                                        className="size-5 shrink-0"
                                                    />
                                                ) : (
                                                    <Crosshair
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-medium text-foreground">
                                                        {bounty.name}
                                                    </p>
                                                    <p className="truncate text-caption text-muted-foreground md:hidden">
                                                        {bounty.zoneName ?? "—"}
                                                        <span className="sm:hidden">
                                                            {" "}
                                                            · {props.labels.profile.level}{" "}
                                                            {bounty.level}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden p-2 text-muted-foreground md:table-cell">
                                            {bounty.zoneName ?? "—"}
                                        </td>
                                        <td className="hidden p-2 font-mono text-muted-foreground sm:table-cell">
                                            {bounty.level}
                                        </td>
                                        <td className="p-2 text-right">
                                            <CharacterBadge
                                                slot={bounty.characterSlot}
                                                labels={props.labels}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {filteredBounties.length > bountyVisible ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            setBountyVisible(
                                (current) => current + VISITOR_PROFILE_LIST_PAGE_SIZE
                            )
                        }
                        className="mt-2 h-8 px-2 text-xs text-muted-foreground"
                    >
                        {props.labels.profile.filterShowMore.replace(
                            "{n}",
                            String(
                                Math.min(
                                    VISITOR_PROFILE_LIST_PAGE_SIZE,
                                    filteredBounties.length - bountyVisible
                                )
                            )
                        )}
                    </Button>
                ) : null}
                {props.bounties.length < props.bountiesTotal ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {props.labels.profile.cappedBounties.replace(
                            "{n}",
                            String(props.bounties.length)
                        )}
                    </p>
                ) : null}
            </section>

        </>
    );
}

function CharacterBadge({ slot, labels }: { slot: string; labels: Labels }) {
    return (
        <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {characterLabel(slot, labels)}
        </span>
    );
}
