import { seedDofusData } from "@/server/actions/dofus-quest-actions";
import { NextResponse } from "next/server";

export async function GET() {
    const res = await seedDofusData("GOD");
    return NextResponse.json(res);
}
