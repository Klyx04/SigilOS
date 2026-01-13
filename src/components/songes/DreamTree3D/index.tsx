'use client';

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { getPalierFromFloor, PALIERS } from '@/lib/songes/types';

interface DreamTree3DProps {
    floors?: { id: string; floorNumber: number; roomType: string; pointsReve: number }[];
    currentFloor?: number;
    pointsReve?: number;
    isLeader?: boolean;
    onFloorSelect?: (floorNumber: number) => void;
}

// Colors for each palier
const PALIER_COLORS: Record<string, string> = {
    "Les Pensées Oniriques": "#22c55e",      // Green
    "Les Balades Fantastiques": "#3b82f6",   // Blue
    "Les Espaces Imaginaires": "#a855f7",    // Purple
    "Les Concepts Brumeux": "#f97316",       // Orange
    "Les Abstractions Chimériques": "#ef4444", // Red
};

// Island component for each floor
function IslandNode({
    position,
    floorNumber,
    isCurrent,
    isCompleted,
    isClickable,
    palierName,
    onClick
}: {
    position: [number, number, number];
    floorNumber: number;
    isCurrent: boolean;
    isCompleted: boolean;
    isClickable: boolean;
    palierName: string;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const color = PALIER_COLORS[palierName] || "#a855f7";

    // Special styling for floor 26 (boss)
    const isBoss = floorNumber === 26;
    // Fontaine floors: 4, 10, 16, 22
    const isFontaine = [4, 10, 16, 22].includes(floorNumber);

    return (
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
            <group
                position={position}
                onClick={(e) => { e.stopPropagation(); if (isClickable) onClick(); }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {/* Base platform */}
                <mesh position={[0, 0, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.8, 1, 0.4, 6]} />
                    <meshStandardMaterial
                        color={isCurrent ? "#fbbf24" : isCompleted ? color : "#2a1a4a"}
                        emissive={isCurrent ? "#fbbf24" : hovered && isClickable ? color : "#000000"}
                        emissiveIntensity={isCurrent ? 0.8 : hovered ? 0.5 : 0}
                        roughness={0.5}
                        metalness={0.3}
                    />
                </mesh>

                {/* Glow ring for current */}
                {isCurrent && (
                    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.9, 1.2, 32]} />
                        <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
                    </mesh>
                )}

                {/* Fontaine crystal */}
                {isFontaine && isCompleted && (
                    <mesh position={[0, 0.6, 0]}>
                        <octahedronGeometry args={[0.3]} />
                        <meshStandardMaterial
                            color="#60a5fa"
                            emissive="#3b82f6"
                            emissiveIntensity={0.8}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                )}

                {/* Boss crown */}
                {isBoss && (
                    <mesh position={[0, 0.5, 0]}>
                        <coneGeometry args={[0.3, 0.5, 5]} />
                        <meshStandardMaterial
                            color="#fbbf24"
                            emissive="#f59e0b"
                            emissiveIntensity={0.6}
                        />
                    </mesh>
                )}

                {/* Floor number */}
                <Text
                    position={[0, 0.35, 0]}
                    fontSize={0.35}
                    color={isCurrent ? "#000" : "#fff"}
                    anchorX="center"
                    anchorY="middle"
                >
                    {floorNumber}
                </Text>

                {/* Cursor indicator */}
                {hovered && isClickable && (
                    <mesh position={[0, 0.8, 0]}>
                        <sphereGeometry args={[0.15]} />
                        <meshBasicMaterial color="#fbbf24" />
                    </mesh>
                )}
            </group>
        </Float>
    );
}

// Vortex effect in the center
function SpiralVortex() {
    return (
        <group position={[0, 8, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.3, 16, 100]} />
                <meshStandardMaterial
                    color="#1e1b4b"
                    emissive="#6366f1"
                    emissiveIntensity={0.4}
                    transparent
                    opacity={0.7}
                />
            </mesh>
            <pointLight position={[0, 0, 0]} color="#8b5cf6" intensity={8} distance={15} />
        </group>
    );
}

export function DreamTree3D({
    floors = [],
    currentFloor = 0,
    pointsReve = 0,
    isLeader = false,
    onFloorSelect
}: DreamTree3DProps) {
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

    // Calculate spiral positions for all 26 floors
    const getSpiralPosition = (floorNumber: number): [number, number, number] => {
        const angle = (floorNumber - 1) * 0.45; // Spiral angle increment
        const radius = 3 + (floorNumber - 1) * 0.12; // Gradually increasing radius
        const height = (floorNumber - 1) * 0.55; // Height increment

        return [
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius,
        ];
    };

    const handleFloorClick = (floorNumber: number) => {
        if (isLeader) {
            setSelectedFloor(floorNumber);
        }
    };

    const handleConfirmFloor = () => {
        if (selectedFloor && onFloorSelect) {
            onFloorSelect(selectedFloor);
            setSelectedFloor(null);
        }
    };

    // Get palier info
    const currentPalier = currentFloor > 0 ? getPalierFromFloor(currentFloor) : null;

    return (
        <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-purple-500/30 bg-gradient-to-b from-[#0a0118] to-[#1a0933]">
            {/* Stats Panel Overlay */}
            <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 text-white">
                <div className="text-2xl font-bold text-amber-400">
                    ÉTAGE {currentFloor}/26
                </div>
                {currentPalier && (
                    <div className="text-sm" style={{ color: currentPalier.couleur }}>
                        {currentPalier.nom}
                    </div>
                )}
                <div className="text-sm text-purple-300 mt-1">
                    💎 {pointsReve} Points de Rêve
                </div>
            </div>

            {/* Selected Floor Confirmation */}
            {isLeader && selectedFloor && (
                <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-amber-500/50 text-white w-56">
                    <div className="text-amber-400 font-bold mb-2">
                        📍 Étage {selectedFloor}
                    </div>
                    <p className="text-sm text-purple-200 mb-3">
                        Définir comme étage actuel ?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedFloor(null)}
                            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded text-sm"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirmFloor}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 px-3 rounded text-sm font-medium"
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                🖱️ Glisser pour tourner • Molette pour zoomer
                {isLeader && ' • Cliquer sur un étage pour marquer la progression'}
            </div>

            {/* Palier Legend */}
            <div className="absolute bottom-16 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-purple-500/30">
                <div className="text-xs text-purple-300 mb-2 font-medium">Paliers</div>
                <div className="space-y-1">
                    {Object.entries(PALIER_COLORS).map(([name, color]) => (
                        <div key={name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-white/80">{name.replace("Les ", "")}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3D Canvas */}
            <Canvas
                camera={{ position: [12, 12, 12], fov: 50 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
            >
                <Suspense fallback={null}>
                    {/* Lighting */}
                    <ambientLight intensity={0.3} />
                    <pointLight position={[0, 20, 0]} color="#a855f7" intensity={5} />
                    <pointLight position={[10, 10, 10]} color="#3b82f6" intensity={3} />
                    <pointLight position={[-10, 5, -10]} color="#fbbf24" intensity={2} />

                    {/* Stars background */}
                    <Stars
                        radius={100}
                        depth={50}
                        count={4000}
                        factor={4}
                        saturation={0.5}
                        fade
                        speed={0.3}
                    />

                    {/* Central vortex */}
                    <SpiralVortex />

                    {/* All 26 island nodes */}
                    {Array.from({ length: 26 }, (_, i) => i + 1).map((floorNumber) => {
                        const palier = getPalierFromFloor(floorNumber);
                        const isCompleted = floors.some(f => f.floorNumber === floorNumber);
                        const isCurrent = floorNumber === currentFloor;

                        return (
                            <IslandNode
                                key={floorNumber}
                                position={getSpiralPosition(floorNumber)}
                                floorNumber={floorNumber}
                                isCurrent={isCurrent}
                                isCompleted={isCompleted}
                                isClickable={isLeader}
                                palierName={palier.nom}
                                onClick={() => handleFloorClick(floorNumber)}
                            />
                        );
                    })}

                    {/* Camera Controls */}
                    <OrbitControls
                        enableZoom={true}
                        enablePan={true}
                        minDistance={8}
                        maxDistance={35}
                        minPolarAngle={0.3}
                        maxPolarAngle={Math.PI / 2.2}
                        target={[0, 7, 0]}
                        autoRotate
                        autoRotateSpeed={0.3}
                    />

                    {/* Post-processing */}
                    <EffectComposer>
                        <Bloom
                            luminanceThreshold={0.3}
                            luminanceSmoothing={0.9}
                            intensity={0.8}
                        />
                        <Vignette offset={0.3} darkness={0.5} />
                    </EffectComposer>
                </Suspense>
            </Canvas>
        </div>
    );
}

export default DreamTree3D;
