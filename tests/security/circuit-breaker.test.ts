import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker } from "../../src/lib/circuit-breaker";

// Tests du circuit breaker (I-15) — logique pure, aucun I/O.
// On vérifie le comportement conforme au finding : incrément sur échec,
// reset sur succès, états closed/open/half-open, fail-fast quand ouvert.

describe("CircuitBreaker", () => {
    describe("état initial (closed)", () => {
        it("démarre fermé et laisse passer les appels", () => {
            const cb = new CircuitBreaker({ name: "test" });
            expect(cb.getState()).toBe("closed");
            expect(cb.allowCall()).toBe(true);
            expect(cb.getConsecutiveFailures()).toBe(0);
        });

        it("incrémente le compteur sur échec mais reste fermé sous le seuil", () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 5 });
            cb.onFailure();
            cb.onFailure();
            cb.onFailure();
            expect(cb.getConsecutiveFailures()).toBe(3);
            expect(cb.getState()).toBe("closed");
            expect(cb.allowCall()).toBe(true);
        });

        it("reset le compteur sur succès (règle I-15 : reset sur succès)", () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 5 });
            cb.onFailure();
            cb.onFailure();
            cb.onSuccess();
            expect(cb.getConsecutiveFailures()).toBe(0);
            expect(cb.getState()).toBe("closed");
        });
    });

    describe("ouverture du circuit (open)", () => {
        it("ouvre le circuit quand le seuil d'échecs consécutifs est atteint", () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 3, recoveryTimeoutMs: 60_000 });
            cb.onFailure();
            cb.onFailure();
            expect(cb.getState()).toBe("closed");
            cb.onFailure(); // 3e échec → seuil atteint
            expect(cb.getState()).toBe("open");
            expect(cb.getConsecutiveFailures()).toBe(3);
        });

        it("fail-fast : refuse les appels tant que le délai de récupération n'est pas écoulé", () => {
            vi.useFakeTimers();
            try {
                const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, recoveryTimeoutMs: 60_000 });
                cb.onFailure(); // ouvre
                expect(cb.allowCall()).toBe(false);
                // Avance l'horloge de 30s (moins que 60s) → toujours open
                vi.advanceTimersByTime(30_000);
                expect(cb.allowCall()).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});

    describe("récupération (half-open → closed)", () => {
        it("passe en half-open après le délai et autorise un essai", () => {
            vi.useFakeTimers();
            try {
                const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, recoveryTimeoutMs: 30_000 });
                cb.onFailure();
                cb.onFailure(); // open
                expect(cb.getState()).toBe("open");

                vi.advanceTimersByTime(30_000); // délai écoulé
                expect(cb.allowCall()).toBe(true); // half-open, 1 essai
                expect(cb.getState()).toBe("half-open");
            } finally {
                vi.useRealTimers();
            }
        });

        it("un succès en half-open referme le circuit (reprise confirmée)", () => {
            vi.useFakeTimers();
            try {
                const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, recoveryTimeoutMs: 30_000 });
                cb.onFailure();
                cb.onFailure(); // open
                vi.advanceTimersByTime(30_000);
                expect(cb.allowCall()).toBe(true); // half-open
                cb.onSuccess();
                expect(cb.getState()).toBe("closed");
                expect(cb.getConsecutiveFailures()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it("un échec en half-open rouvre immédiatement le circuit", () => {
            vi.useFakeTimers();
            try {
                const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, recoveryTimeoutMs: 30_000 });
                cb.onFailure();
                cb.onFailure(); // open
                vi.advanceTimersByTime(30_000);
                expect(cb.allowCall()).toBe(true); // half-open
                cb.onFailure(); // l'essai échoue → re-open (fenêtre prolongée)
                expect(cb.getState()).toBe("open");
                expect(cb.allowCall()).toBe(false); // fail-fast à nouveau
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("execute()", () => {
        it("appelle fn quand le circuit est fermé et compte le succès", async () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, recoveryTimeoutMs: 60_000 });
            const fn = vi.fn().mockResolvedValue("ok");
            const fallback = vi.fn().mockReturnValue("fallback");

            const result = await cb.execute(fn, fallback);
            expect(result).toBe("ok");
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fallback).not.toHaveBeenCalled();
            expect(cb.getState()).toBe("closed");
        });

        it("utilise le fallback (sans appeler fn) quand le circuit est ouvert", async () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, recoveryTimeoutMs: 60_000 });
            cb.onFailure(); // open
            const fn = vi.fn().mockResolvedValue("ok");
            const fallback = vi.fn().mockReturnValue("cached");

            const result = await cb.execute(fn, fallback);
            expect(result).toBe("cached");
            expect(fn).not.toHaveBeenCalled();
        });

        it("compte l'échec et re-throw si fn lève une exception", async () => {
            const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, recoveryTimeoutMs: 60_000 });
            const fn = vi.fn().mockRejectedValue(new Error("boom"));
            const fallback = vi.fn();

            await expect(cb.execute(fn, fallback)).rejects.toThrow("boom");
            expect(cb.getConsecutiveFailures()).toBe(1);
            expect(cb.getState()).toBe("closed"); // sous le seuil

            await expect(cb.execute(fn, fallback)).rejects.toThrow("boom");
            expect(cb.getState()).toBe("open"); // seuil atteint
        });
    });

