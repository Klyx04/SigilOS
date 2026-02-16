import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr"),
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json", // Link to PWA manifest
  title: {
    default: "SigilOS - Le système d'exploitation pour guildes Dofus",
    template: "%s | SigilOS",
  },
  description: "Gérez vos missions, suivez votre progression (Ocre, Almanax) et coordonnez votre guilde Dofus avec SigilOS.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr",
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
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}>
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
                position="top-center"
                richColors
                closeButton
                theme="dark"
                toastOptions={{
                  className: "bg-[#1a0933]/90 border border-purple-500/20 text-white shadow-[0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-md rounded-2xl",
                  style: {
                    borderRadius: "1rem",
                    padding: "1rem",
                  }
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
