import { auth } from "@/auth"

export default async function DashboardPage() {
    const session = await auth()

    if (!session?.user) return <div>Access Denied</div>

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-3xl font-bold">SigilOS Verification Dashboard</h1>
            <div className="p-6 border rounded-lg shadow-md">
                <p className="text-lg">Welcome, <strong>{session.user.name}</strong>!</p>
                <p className="text-sm text-gray-500">ID: {session.user.id}</p>
                <p className="text-sm text-gray-500">Email: {session.user.email}</p>
                <img
                    src={session.user.image || ""}
                    alt="Avatar"
                    className="w-16 h-16 mt-4 rounded-full"
                />
            </div>
        </div>
    )
}
