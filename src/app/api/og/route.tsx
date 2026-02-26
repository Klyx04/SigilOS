import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// OG Image dimensions (standard for social sharing)
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const title = searchParams.get("title") || "SigilOS";
        const subtitle = searchParams.get("subtitle") || "Le système d'exploitation pour guildes Dofus";

        return new ImageResponse(
            (
                <div
                    style={{
                        width: OG_WIDTH,
                        height: OG_HEIGHT,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #0a0a0f 0%, #0f1118 40%, #0d0f14 100%)",
                        fontFamily: "system-ui, sans-serif",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Background glows */}
                    <div
                        style={{
                            position: "absolute",
                            top: -100,
                            left: -50,
                            width: 400,
                            height: 400,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(20,184,166,0.15), transparent 70%)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: -80,
                            right: -30,
                            width: 350,
                            height: 350,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(245,158,11,0.1), transparent 70%)",
                        }}
                    />

                    {/* Decorative line */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            background: "linear-gradient(90deg, transparent, #14b8a6, #f59e0b, transparent)",
                        }}
                    />

                    {/* Logo emoji */}
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🌀</div>

                    {/* Title */}
                    <div
                        style={{
                            fontSize: 56,
                            fontWeight: 900,
                            letterSpacing: "-0.03em",
                            color: "#e2e8f0",
                            textAlign: "center",
                            lineHeight: 1.1,
                            display: "flex",
                        }}
                    >
                        {title}
                    </div>

                    {/* Subtitle */}
                    <div
                        style={{
                            fontSize: 22,
                            color: "rgba(148,163,184,0.8)",
                            marginTop: 16,
                            textAlign: "center",
                            maxWidth: 700,
                            lineHeight: 1.4,
                            display: "flex",
                        }}
                    >
                        {subtitle}
                    </div>

                    {/* Bottom branding bar */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: 32,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "#14b8a6",
                            }}
                        />
                        <div
                            style={{
                                fontSize: 14,
                                color: "rgba(148,163,184,0.5)",
                                letterSpacing: "0.15em",
                                textTransform: "uppercase" as const,
                                fontWeight: 700,
                                display: "flex",
                            }}
                        >
                            sigilos.fr
                        </div>
                    </div>
                </div>
            ),
            {
                width: OG_WIDTH,
                height: OG_HEIGHT,
            }
        );
    } catch {
        return new Response("Failed to generate OG image", { status: 500 });
    }
}
