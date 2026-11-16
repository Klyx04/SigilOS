"use client";

import { SessionProvider } from "next-auth/react";
import { SentryUserSync } from "./sentry-user-sync";

export function AuthProvider({ children, session }: { children: React.ReactNode; session?: any }) {
    return (
        <SessionProvider session={session}>
            {/* Impact Sentry : id interne opaque, jamais l'identité Discord. */}
            <SentryUserSync userId={session?.user?.id ?? null} />
            {children}
        </SessionProvider>
    );
}
