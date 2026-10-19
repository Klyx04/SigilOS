import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("supervision privée", () => {
    it("ne publie plus monitor.sigilos.fr ni Grafana", () => {
        const caddy = read("Caddyfile");
        expect(caddy).not.toMatch(/monitor\.sigilos\.fr|sigilos-grafana/);
    });

    it("ne lance plus Grafana dans le compose de production", () => {
        const compose = read("docker-compose.prod.yml");
        expect(compose).not.toMatch(/^\s{2}grafana:\s*$/m);
        expect(compose).not.toMatch(/GF_SECURITY_ADMIN_PASSWORD/);
    });

    it("épingle Prometheus et le garde interne", () => {
        const prod = read("docker-compose.prod.yml");
        const dev = read("docker-compose.yml");
        expect(prod).toMatch(/prom\/prometheus:v3\.15\.0/);
        expect(dev).toMatch(/prom\/prometheus:v3\.15\.0/);
        expect(prod).not.toMatch(/prom\/prometheus:latest/);
        expect(prod).toMatch(/PROMETHEUS_URL=http:\/\/prometheus:9090/);
    });

    it("garde le dashboard God anti-slop et branché", () => {
        const dashboard = read("src/app/god/components/system-health-dashboard.tsx");
        expect(dashboard).not.toMatch(/rounded-3xl|backdrop-blur|font-black/);
        expect(dashboard).toMatch(/getInternalSystemStatus/);
    });
});