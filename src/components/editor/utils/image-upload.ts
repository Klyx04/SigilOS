import { toast } from "sonner";

/**
 * Upload an image file to the server via /api/upload.
 * Returns the persistent public URL (e.g. /uploads/docs/uuid.webp).
 * Shows a toast on error and returns null.
 *
 * @param scope Destination sous `private_uploads/`. `docs` (défaut) reste privé
 *              (session requise) ; `guides`, `assets` et `landing` sont servis
 *              PUBLICQUEMENT — à utiliser pour tout visuel affiché sur une page
 *              publique (guide indexé, landing…).
 */
export async function uploadImageFile(
    file: File,
    scope: "docs" | "guides" | "assets" | "landing" = "docs"
): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("scope", scope);

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "Erreur lors de l'upload de l'image");
            return null;
        }

        const data = await res.json();
        return data.url as string;
    } catch {
        toast.error("Erreur réseau lors de l'upload");
        return null;
    }
}
