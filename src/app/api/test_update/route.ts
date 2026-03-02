import { NextResponse } from "next/server";
import { updateAltPseudos } from "@/server/actions/profile-actions";

export async function POST(req: Request) {
    try {
        const json = await req.json();
        const res = await updateAltPseudos(json);
        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
