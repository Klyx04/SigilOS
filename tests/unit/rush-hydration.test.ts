import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Hydratation Rush — Sentry 33 / 1M.
 *
 * Mesure du 26/11/2026 : les préférences localStorage étaient lues dans des
 * initialiseurs `useState`, donc la première rendu client différait du SSR pour les
 * habitués. Elles sont désormais lues dans un `useEffect` après le montage.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OPTIMIZED =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/OptimizedGuideClient.tsx";
const TIMELINE =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("hydratation Rush — préférences lues après montage", () => {
    it("le guide public ne lit plus localStorage dans ses initialiseurs", () => {
        const code = read(PUBLIC);
        expect(code).not.toContain("useState<GuestCharacter | null>(() => readGuestCharacter");
        expect(code).not.toContain('useState<"bontarien" | "brakmarien" | null>(() =>');
        expect(code).not.toContain("useState<LocalDungeonStates>(() =>");
        expect(code).toContain("const [hydrated, setHydrated] = useState(false)");
        expect(code).toContain("const storedCharacter = readGuestCharacter(guide.slug)");
        expect(code).toContain("setHydrated(true)");
    });

    it("le guide optimisé hydrate marque-pages, mode discret et particules", () => {
        const code = read(OPTIMIZED);
        expect(code).not.toContain("const [bookmarkId, setBookmarkId] = useState<string | null>(() =>");
        expect(code).not.toContain("const [incognito, setIncognito] = useState(() =>");
        expect(code).not.toContain("const [particlesEnabled, setParticlesEnabled] = useState(() =>");
        expect(code).toContain("const [hydrated, setHydrated] = useState(false)");
        expect(code).toContain("localStorage.getItem(`guide-incognito-${guildId}`)");
        expect(code).toContain("localStorage.getItem(`guide-particles-${guildId}`)");
        expect(code).toContain("setHydrated(true)");
    });

    it("le timeline Rush hydrate ses particules", () => {
        const code = read(TIMELINE);
        expect(code).not.toContain(
            "const [rushParticlesEnabled,setRushParticlesEnabled]=useState<boolean>(() =>"
        );
        expect(code).toContain("const [rushParticlesEnabled,setRushParticlesEnabled]=useState<boolean>(true)");
        expect(code).toContain("setRushParticlesEnabled(localStorage.getItem");
    });
});
