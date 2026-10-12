import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "@/app/globals.css";
import { Toaster } from "sonner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "SigilOS — Guide Overlay",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${cinzel.variable} bg-zinc-950 text-zinc-100 antialiased overflow-hidden`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
