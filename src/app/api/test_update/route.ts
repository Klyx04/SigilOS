import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";

export async function POST(req: Request) {
    if (process.env.NODE_ENV === "production" || !(await isSuperAdmin())) {
        return NextResponse.json({ error: "Route closed." }, { status: 410 });
    }

    try {
        const { updateAltPseudos } = await import("@/server/actions/profile-actions");
        const json = await req.json();
        const res = await updateAltPseudos(json);
        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
