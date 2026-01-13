'use client';

import dynamic from 'next/dynamic';

// Import dynamique pour éviter les erreurs SSR avec Three.js
const DreamTree3D = dynamic(
    () => import('@/components/songes/DreamTree3D').then(mod => mod.DreamTree3D),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[600px] rounded-xl bg-gradient-to-b from-[#0a0118] to-[#1a0933] flex items-center justify-center">
                <div className="text-purple-400 animate-pulse text-xl">
                    ✨ Chargement de l'Arbre des Songes...
                </div>
            </div>
        )
    }
);

export default function SongesTestPage() {
    return (
        <div className="min-h-screen bg-[#0a0118] p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">
                    🌙 Prototype Module Songes
                </h1>
                <p className="text-purple-300">
                    Test du rendu 3D de l'Arbre des Songes Infinis
                </p>
            </div>

            {/* 3D Tree */}
            <div className="max-w-6xl mx-auto">
                <DreamTree3D />
            </div>

            {/* Infos */}
            <div className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 text-white">
                    <h3 className="text-amber-400 font-bold mb-2">⚔️ Types de Salles</h3>
                    <ul className="text-sm text-purple-200 space-y-1">
                        <li>• <span className="text-green-400">Vert</span> = Combat facile (1-2⭐)</li>
                        <li>• <span className="text-yellow-400">Jaune</span> = Combat moyen (3⭐)</li>
                        <li>• <span className="text-orange-400">Orange</span> = Combat difficile (4⭐)</li>
                        <li>• <span className="text-red-400">Rouge</span> = Combat très difficile (5⭐)</li>
                        <li>• <span className="text-blue-400">Bleu</span> = Fontaine (shop)</li>
                        <li>• <span className="text-purple-400">Violet</span> = Faveur (bonus gratuit)</li>
                    </ul>
                </div>

                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 text-white">
                    <h3 className="text-amber-400 font-bold mb-2">🎮 Contrôles</h3>
                    <ul className="text-sm text-purple-200 space-y-1">
                        <li>• <strong>Clic gauche + glisser</strong> = Rotation</li>
                        <li>• <strong>Molette</strong> = Zoom</li>
                        <li>• <strong>Clic droit + glisser</strong> = Déplacement</li>
                        <li>• <strong>Clic sur un node</strong> = Détails</li>
                    </ul>
                </div>

                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 text-white">
                    <h3 className="text-amber-400 font-bold mb-2">📊 Données de Demo</h3>
                    <ul className="text-sm text-purple-200 space-y-1">
                        <li>• 9 étages de test</li>
                        <li>• Étage actuel : 5 (glow doré)</li>
                        <li>• Mix de combats, fontaines et boss</li>
                        <li>• Points de Rêve affichés sur chaque node</li>
                    </ul>
                </div>
            </div>

            {/* Footer */}
            <div className="max-w-6xl mx-auto mt-8 text-center text-purple-400/50 text-sm">
                Prototype SigilOS - Module Songes 3D
            </div>
        </div>
    );
}
