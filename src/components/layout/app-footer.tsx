export function AppFooter() {
    return (
        <footer className="w-full border-t py-6 bg-background/50 text-muted-foreground text-sm">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-12 md:flex-row">
                <p className="text-center md:text-left">
                    Built for <span className="font-semibold text-foreground">Sigil</span> &bull;
                    <span className="italic ml-1 opacity-70">"Par-delà les étoiles, nous veillons."</span>
                </p>
                <div className="flex items-center gap-4">
                    <span>v0.1.0-Alpha</span>
                </div>
            </div>
        </footer>
    );
}
