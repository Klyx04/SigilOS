"use client";

import { useState } from "react";
import { Beaker, Download, Loader2, Play, RefreshCw, Terminal, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    testLadderFetch,
    triggerGlobalLadderSync,
    triggerGlobalMetamobSync,
} from "@/server/actions/super-admin-actions";

type LadderTestResult = Awaited<ReturnType<typeof testLadderFetch>>;

/**
 * Synchronisation & diagnostic — forçage manuel des files et test direct de l'API.
 * Aucune action métier n'est modifiée : la carte ne fait que les appeler.
 */
export function WorkerTester() {
    const [isMetamobLoading, setIsMetamobLoading] = useState(false);
    const [isLadderLoading, setIsLadderLoading] = useState(false);

    const [testPseudo, setTestPseudo] = useState("");
    const [testServerId, setTestServerId] = useState("295");
    const [isTestLoading, setIsTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<LadderTestResult | null>(null);

    const handleTestLadder = async () => {
        if (!testPseudo) {
            toast.error("Entrez un pseudo.");
            return;
        }
        setIsTestLoading(true);
        setTestResult(null);
        const result = await testLadderFetch(testPseudo, testServerId);
        setTestResult(result);
        if (!result.success) toast.error(result.error ?? "Erreur inconnue");
        else toast.success("Test terminé.");
        setIsTestLoading(false);
    };

    const handleMetamob = async () => {
        setIsMetamobLoading(true);
        const result = await triggerGlobalMetamobSync();
        if (result.success) toast.success(result.message);
        else toast.error(result.error ?? "Erreur inconnue");
        setIsMetamobLoading(false);
    };

    const handleLadder = async () => {
        setIsLadderLoading(true);
        const result = await triggerGlobalLadderSync();
        if (result.success) toast.success(result.message);
        else toast.error(result.error ?? "Erreur inconnue");
        setIsLadderLoading(false);
    };

    return (
        <section className="rounded-xl border border-border bg-surface">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <RefreshCw className="h-4 w-4 text-accent" aria-hidden />
                <div>
                    <h3 className="text-sm font-medium text-foreground">Synchronisation & diagnostic</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Forçage manuel des files et test direct de l&apos;API Ladder.
                    </p>
                </div>
            </header>
            <div className="p-4">
                <Tabs defaultValue="api" className="w-full">
                    <TabsList className="mb-4 grid w-full grid-cols-2 border border-border bg-background">
                        <TabsTrigger
                            value="api"
                            className="gap-1.5 text-xs data-[state=active]:bg-accent-soft data-[state=active]:text-accent"
                        >
                            <Beaker className="h-3.5 w-3.5" aria-hidden />
                            Diagnostic API
                        </TabsTrigger>
                        <TabsTrigger
                            value="queue"
                            className="gap-1.5 text-xs data-[state=active]:bg-accent-soft data-[state=active]:text-accent"
                        >
                            <Terminal className="h-3.5 w-3.5" aria-hidden />
                            Files de synchronisation
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="api" className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Test direct de l&apos;API Cloudflare (Ladder). Aucune base impactée, aucun job créé :
                            vérifie le jeton et le format Dofus.com en direct.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
                            <label className="space-y-1 text-xs text-muted-foreground">
                                Pseudo Dofus
                                <Input
                                    value={testPseudo}
                                    onChange={(event) => setTestPseudo(event.target.value)}
                                    placeholder="ex : Klyx"
                                    className="bg-background"
                                />
                            </label>
                            <label className="space-y-1 text-xs text-muted-foreground">
                                Serveur
                                <Input
                                    value={testServerId}
                                    onChange={(event) => setTestServerId(event.target.value)}
                                    placeholder="295"
                                    className="bg-background"
                                />
                            </label>
                            <Button
                                type="button"
                                onClick={handleTestLadder}
                                disabled={isTestLoading}
                                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                            >
                                {isTestLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                    <Play className="h-4 w-4" aria-hidden />
                                )}
                                Lancer le test
                            </Button>
                        </div>
                        {testResult && (
                            <div className="rounded-lg border border-border bg-background p-3 font-mono text-xs">
                                <p className={testResult.success ? "text-success" : "text-danger"}>
                                    {testResult.success
                                        ? "Fetch & données OK"
                                        : `Erreur (code ${testResult.statusSucces ?? "—"})`}
                                </p>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground">
                                    {JSON.stringify(testResult, null, 2)}
                                </pre>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="queue" className="space-y-4">
                        <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
                            <strong>Attention :</strong> injecter un job ici déclenche l&apos;opération sur
                            tout le système. À utiliser uniquement en cas de blocage d&apos;un worker ou pour
                            réinitialiser un cycle de test.
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleMetamob}
                                disabled={isMetamobLoading}
                                className="h-auto border-border bg-surface py-3 text-foreground hover:bg-elevated"
                            >
                                <span className="flex flex-col items-center gap-2">
                                    {isMetamobLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <Download className="h-4 w-4" aria-hidden />
                                    )}
                                    <span className="text-xs font-medium">Forcer la file Metamob</span>
                                </span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleLadder}
                                disabled={isLadderLoading}
                                className="h-auto border-border bg-surface py-3 text-foreground hover:bg-elevated"
                            >
                                <span className="flex flex-col items-center gap-2">
                                    {isLadderLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <Trophy className="h-4 w-4" aria-hidden />
                                    )}
                                    <span className="text-xs font-medium">Forcer la file Ladder</span>
                                </span>
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    );
}
