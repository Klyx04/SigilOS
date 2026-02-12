"use server";

import { signIn, signOut } from "@/auth";

export async function loginWithDiscord() {
    await signIn("discord", { redirectTo: "/dashboard" });
}

export async function logoutAction() {
    await signOut({ redirectTo: "/" });
}
