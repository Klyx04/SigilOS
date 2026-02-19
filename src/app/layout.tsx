import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { getAppBaseUrl } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest", // Next.js generates this from manifest.ts
  title: {
    default: "SigilOS - Le système d'exploitation pour guildes Dofus",
    template: "%s | SigilOS",
  },
  description: "Gérez vos missions, suivez votre progression (Ocre, Almanax) et coordonnez votre guilde Dofus avec SigilOS.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: getAppBaseUrl(),
    siteName: "SigilOS",
    images: [
      {
        url: "/assets/ui/logo-v2.png", // Fallback, better to have a specific OG image
        width: 1200,
        height: 630,
        alt: "SigilOS Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SigilOS - Gestion de Guilde Dofus",
    description: "L'outil ultime pour les guildes Dofus.",
    images: ["/assets/ui/logo-v2.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/assets/ui/logo-v2.png",
    shortcut: "/assets/ui/logo-v2.png",
    apple: "/assets/ui/logo-v2.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#9333ea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster
                position="bottom-right"
                richColors
                expand={false}
                closeButton
                theme="dark"
                toastOptions={{
                  className: "group font-sans border-white/5 bg-[#0d0f11]/90 backdrop-blur-2xl text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 border border-zinc-500/10",
                  descriptionClassName: "text-zinc-400 font-medium text-[13px]",
                  style: {
                    borderLeft: '3px solid rgba(255,255,255,0.1)',
                  },
                  actionButtonStyle: {
                    background: "white",
                    color: "black",
                    fontWeight: "bold",
                    borderRadius: "0.5rem",
                  },
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
