import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAppBaseUrl() {
  // 1. Env override (Best practice)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // 2. Auth URL fallback (often set in Vercel/VPS)
  if (process.env.NEXTAUTH_URL) {
    if (process.env.NEXTAUTH_URL.includes("beta.sigilos.fr")) return "https://beta.sigilos.fr";
    return process.env.NEXTAUTH_URL;
  }

  // 3. Default fallback (Prod)
  return "https://sigilos.fr";
}
