import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * SEC-04: Server-side beta gate validation.
 * The password is verified server-side (not exposed via NEXT_PUBLIC_),
 * and the cookie is signed with HMAC to prevent forgery.
 */

const BETA_PASSWORD = process.env.BETA_PASSWORD;
const SECRET = process.env.AUTH_SECRET;

function signValue(value: string): string {
    if (!SECRET) throw new Error("AUTH_SECRET is required.");
    const hmac = crypto.createHmac("sha256", SECRET);
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
        if (!BETA_PASSWORD || !SECRET) {
            console.error("Missing BETA_PASSWORD or AUTH_SECRET env vars.");
            return NextResponse.json({ success: false, error: "Server Configuration Error" }, { status: 500 });
        }

        const { password } = await req.json();

        if (password !== BETA_PASSWORD) {
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
