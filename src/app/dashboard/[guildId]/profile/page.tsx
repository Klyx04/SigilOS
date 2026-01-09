
import { auth } from "@/auth";
import { getUserProfile } from "@/server/actions/profile-actions";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default async function ProfilePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Fetch existing profile or error
    const response = await getUserProfile(guildId);

    if (!response.success) {
        // If profile doesn't exist, we might want to auto-create it or show error.
        // But the middleware/onboarding logic should usually handle this.
        // Assuming getUserProfile fails only if Guild doesn't exist or serious error.
        return (
            <div className="p-8 text-center text-red-400">
                <h2 className="text-xl font-bold">Erreur de chargement</h2>
                <p>{response.error}</p>
            </div>
        );
    }

    const profile = response.data;

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 p-6 max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mon Profil</h1>
                    <p className="text-zinc-400">Gérez votre identité de guilde, votre classe et vos métiers.</p>
                </div>

                <ProfileEditor profile={profile} guildId={guildId} />
            </div>
        </div>
    );
}
