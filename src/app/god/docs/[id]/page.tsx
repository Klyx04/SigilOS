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
        <div className="flex flex-col font-sans selection:bg-purple-500/30">
            <main className="flex-1 w-full mx-auto px-4 pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-white font-heading">
                        {id === "new" ? "Nouvelle Page" : "Éditer la page"}
                    </h1>
                </div>

                <DocEditor initialData={doc as any} />
            </main>
        </div>
    );
}
