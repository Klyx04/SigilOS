import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOFUS_CLASSES, DOFUS_JOBS, getClass, getJob } from "@/lib/dofus-assets";
import {
    PUBLIC_DIRECTORY_JOB_LEVELS,
    PUBLIC_DIRECTORY_SEARCH_MAX,
    buildVisitorDirectoryHref,
    type VisitorDirectoryFilters,
} from "@/lib/public-directory";
import type { Translations } from "@/lib/i18n/locales/fr";
import { FilterMenu } from "./filter-menu";

/** Tous les métiers, à plat, dans l'ordre des catégories du jeu. */
const ALL_JOBS = Object.values(DOFUS_JOBS).flatMap((category) => [...category]);

/**
 * Une option de menu — **l'état actif doit se voir** : fond `elevated` (le panneau est
 * en `surface`), texte renforcé, coche et `aria-current`. Retour user du 10/11 : le fond
 * `surface` se confondait avec le panneau, l'option choisie était invisible.
 */
const optionClass = (active: boolean) =>
    `flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
        active ? "bg-elevated font-semibold text-foreground" : "text-foreground hover:bg-surface"
    }`;

function OptionLink({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: ReactNode;
}) {
    return (
        <Link href={href} aria-current={active ? "true" : undefined} className={optionClass(active)}>
            {children}
            {active ? (
                <Check className="ml-auto size-4 shrink-0 text-accent" aria-hidden="true" />
            ) : null}
        </Link>
    );
}

/**
 * Filtres de l'annuaire : un formulaire GET pour la recherche, trois menus pour la classe, le
 * métier et — seulement quand un métier est actif — le niveau minimum (F17b). Pourquoi pas un
 * `<select>` : la règle de la maison interdit les contrôles natifs non thémés, et `SelectValue`
 * rejoue le contenu de l'item (piège mesuré le 06/11 : icône deux fois).
 *
 * Les **liens** sont rendus ici, côté serveur ; seul le comportement d'ouverture/fermeture vit
 * dans `FilterMenu` (client). Chaque lien recalcule l'URL complète
 * (`buildVisitorDirectoryHref`) : un filtre change sans perdre les autres, et le curseur de
 * pagination n'est **jamais** recopié.
 */
export function VisitorFilters({
    filters,
    labels,
}: {
    filters: VisitorDirectoryFilters;
    labels: Translations["visitorsPage"];
}) {
    const activeClass = filters.classe ? getClass(filters.classe) : undefined;
    const activeJob = filters.metier ? getJob(filters.metier) : undefined;
    const hasFilters = Boolean(filters.q || filters.classe || filters.metier || filters.niveau);

    return (
        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <form method="get" action="/visiteurs" className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {filters.classe && <input type="hidden" name="classe" value={filters.classe} />}
                {filters.metier && <input type="hidden" name="metier" value={filters.metier} />}
                {filters.niveau && (
                    <input type="hidden" name="niveau" value={filters.niveau} />
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="directory-q" className="text-xs text-muted-foreground">
                        {labels.searchLabel}
                    </Label>
                    <Input
                        id="directory-q"
                        name="q"
                        type="search"
                        defaultValue={filters.q ?? ""}
                        maxLength={PUBLIC_DIRECTORY_SEARCH_MAX}
                        placeholder={labels.searchPlaceholder}
                        autoComplete="off"
                        className="w-[min(18rem,calc(100vw-4rem))]"
                    />
                </div>
                <Button type="submit" variant="secondary" className="min-h-10">
                    {labels.apply}
                </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
                <FilterMenu icon={activeClass?.icon} label={activeClass?.name ?? labels.allClasses}>
                    <OptionLink
                        href={buildVisitorDirectoryHref({
                            q: filters.q,
                            metier: filters.metier,
                            niveau: filters.niveau,
                        })}
                        active={!filters.classe}
                    >
                        {labels.allClasses}
                    </OptionLink>
                    {DOFUS_CLASSES.map((classe) => (
                        <OptionLink
                            key={classe.id}
                            href={buildVisitorDirectoryHref({
                                q: filters.q,
                                classe: classe.id,
                                metier: filters.metier,
                                niveau: filters.niveau,
                            })}
                            active={filters.classe === classe.id}
                        >
                            <GameIcon src={classe.icon} className="size-5" />
                            {classe.name}
                        </OptionLink>
                    ))}
                </FilterMenu>

                <FilterMenu icon={activeJob?.icon} label={activeJob?.name ?? labels.allJobs}>
                    <OptionLink
                        href={buildVisitorDirectoryHref({ q: filters.q, classe: filters.classe })}
                        active={!filters.metier}
                    >
                        {labels.allJobs}
                    </OptionLink>
                    {ALL_JOBS.map((job) => (
                        <OptionLink
                            key={job.id}
                            href={buildVisitorDirectoryHref({
                                q: filters.q,
                                classe: filters.classe,
                                metier: job.id,
                                niveau: filters.niveau,
                            })}
                            active={filters.metier === job.id}
                        >
                            <GameIcon src={job.icon} className="size-5" />
                            {job.name}
                        </OptionLink>
                    ))}
                </FilterMenu>

                {/* F17b — le niveau n'apparaît qu'avec un métier : « à partir de quel niveau
                    ce crafter peut-il travailler ? ». Le menu hérite de l'exclusivité des deux
                    autres (`FilterMenu`). */}
                {filters.metier && (
                    <FilterMenu
                        label={
                            filters.niveau
                                ? `${labels.levelFilter} ${filters.niveau}+`
                                : labels.levelFilter
                        }
                    >
                        <OptionLink
                            href={buildVisitorDirectoryHref({
                                q: filters.q,
                                classe: filters.classe,
                                metier: filters.metier,
                            })}
                            active={!filters.niveau}
                        >
                            {labels.allLevels}
                        </OptionLink>
                        {PUBLIC_DIRECTORY_JOB_LEVELS.map((level) => (
                            <OptionLink
                                key={level}
                                href={buildVisitorDirectoryHref({
                                    q: filters.q,
                                    classe: filters.classe,
                                    metier: filters.metier,
                                    niveau: level,
                                })}
                                active={filters.niveau === level}
                            >
                                {labels.levelFilter} {level}+
                            </OptionLink>
                        ))}
                    </FilterMenu>
                )}

                {hasFilters && (
                    <Link href="/visiteurs" className="reg-link text-sm">
                        {labels.reset}
                    </Link>
                )}
            </div>
        </div>
    );
}
