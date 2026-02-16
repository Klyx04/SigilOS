import { auth } from "@/auth";
import { DocEditor } from "../_components/doc-editor";
import { db } from "@/lib/prisma";

export default async function AdminDocEditPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const { id } = await params;

    let doc = null;
    if (id !== "new") {
        doc = await db.docPage.findUnique({ where: { id } });
    }

    return (
        <div className="flex-1 flex flex-col h-full font-sans selection:bg-purple-500/30 overflow-hidden">
            <DocEditor initialData={doc as any} />
        </div>
    );
}
