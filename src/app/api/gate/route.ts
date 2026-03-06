import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * SEC-04: Server-side beta gate validation.
 * The password is verified server-side (not exposed via NEXT_PUBLIC_),
 * and the cookie is signed with HMAC to prevent forgery.
 */

function signValue(value: string): string {
    const secret = process.env.AUTH_SECRET || "fallback_for_build";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(value);
    return `${value}.${hmac.digest("hex")}`;
}

export function verifySignedValue(signed: string): boolean {
    const lastDot = signed.lastIndexOf(".");
    if (lastDot === -1) return false;
    const value = signed.substring(0, lastDot);
    const expected = signValue(value);
    return crypto.timingSafeEqual(
        Buffer.from(signed),
        Buffer.from(expected)
    );
}

export async function POST(req: NextRequest) {
    try {
        const betaPwd = process.env.BETA_PASSWORD;
        if (!betaPwd) {
            console.error("[SEC] BETA_PASSWORD env var is required.");
            return NextResponse.json(
                { success: false, error: "Configuration serveur invalide." },
                { status: 500 }
            );
        }

        const { password } = await req.json();

        if (password !== betaPwd) {
            return NextResponse.json(
                { success: false, error: "Code d'accès invalide." },
                { status: 401 }
            );
        }

        // Sign the cookie value with HMAC so it can't be forged
        const signedValue = signValue("beta_granted");

        const response = NextResponse.json({ success: true });
        response.cookies.set("beta_access", signedValue, {
            path: "/",
            maxAge: 604800, // 7 days
            sameSite: "lax",
            secure: true,
            httpOnly: true, // Bonus: can't be read by JS either
        });

        return response;
    } catch {
        return NextResponse.json(
            { success: false, error: "Requête invalide." },
            { status: 400 }
        );
    }
}
