"use client";

/**
 * Listes filtrables de la fiche visiteur — succès, avis et métiers.
 *
 * Le serveur borne les listes (`PUBLIC_PROFILE_*_TAKE`) ; ce composant client ne fait que
 * filtrer/paginer **ce qu'il reçoit** : recherche accent-insensible, personnage, donjon/zone,
 * niveau minimum, puis « Voir plus ». Aucune requête, aucun secret.
 */

import { useMemo, useState } from "react";
import { Crosshair, Hammer, Search, Trophy } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    VISITOR_PROFILE_FILTER_ALL,
    VISITOR_PROFILE_JOBS_PAGE_SIZE,
    VISITOR_PROFILE_LIST_PAGE_SIZE,
    filterVisitorAchievements,
    filterVisitorBounties,
    filterVisitorJobs,
    visitorCharacterSlots,
    visitorDungeonNames,
    visitorVisibleSlice,
    visitorZoneNames,
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
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    allLabel: string;
    options: Array<{ value: string; label: string }>;
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
                <SelectItem value={VISITOR_PROFILE_FILTER_ALL}>{allLabel}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
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

    const [bountyQuery, setBountyQuery] = useState("");
    const [bountyCharacter, setBountyCharacter] = useState<string>(VISITOR_PROFILE_FILTER_ALL);
    const [bountyZone, setBountyZone] = useState<string>(VISITOR_PROFILE_FILTER_ALL);
    const [bountyVisible, setBountyVisible] = useState(VISITOR_PROFILE_LIST_PAGE_SIZE);

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
    const achievementDungeonOptions = useMemo(
        () => achievementDungeons.map((dungeon) => ({ value: dungeon, label: dungeon })),
        [achievementDungeons]
    );

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

    const shownAchievements = visitorVisibleSlice(filteredAchievements, achievementVisible);
    const shownBounties = visitorVisibleSlice(filteredBounties, bountyVisible);
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
                        <Trophy className="size-3.5" aria-hidden="true" />
                        {props.labels.profile.achievements}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {filteredAchievements.length} / {props.achievementsTotal}
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
                        <FilterSelect
                            value={achievementDungeon}
                            onChange={updateAchievementDungeon}
                            label={props.labels.profile.filterDungeon}
                            allLabel={props.labels.profile.filterAllDungeons}
                            options={achievementDungeonOptions}
                        />
                    ) : null}
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
                ) : filteredAchievements.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {props.labels.profile.filterNoResults}
                    </p>
                ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {shownAchievements.map((achievement) => (
                            <li
                                key={`${achievement.id}:${achievement.characterSlot}`}
                                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                            >
                                {achievement.iconUrl ? (
                                    <GameIcon
                                        src={achievement.iconUrl}
                                        className="size-6 shrink-0"
                                    />
                                ) : (
                                    <Trophy
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {achievement.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {achievement.dungeonName} · {achievement.points}{" "}
                                        {props.labels.profile.points}
                                    </p>
                                </div>
                                <CharacterBadge
                                    slot={achievement.characterSlot}
                                    labels={props.labels}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {filteredAchievements.length > achievementVisible ? (
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
                        <Crosshair className="size-3.5" aria-hidden="true" />
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
                        <FilterSelect
                            value={bountyZone}
                            onChange={updateBountyZone}
                            label={props.labels.profile.filterZone}
                            allLabel={props.labels.profile.filterAllZones}
                            options={bountyZoneOptions}
                        />
                    ) : null}
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
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {shownBounties.map((bounty) => (
                            <li
                                key={`${bounty.id}:${bounty.characterSlot}`}
                                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                            >
                                {bounty.imageUrl ? (
                                    <GameIcon src={bounty.imageUrl} className="size-6 shrink-0" />
                                ) : (
                                    <Crosshair
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {bounty.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {props.labels.profile.level} {bounty.level}
                                        {bounty.zoneName ? ` · ${bounty.zoneName}` : ""}
                                    </p>
                                </div>
                                <CharacterBadge
                                    slot={bounty.characterSlot}
                                    labels={props.labels}
                                />
                            </li>
                        ))}
                    </ul>
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
