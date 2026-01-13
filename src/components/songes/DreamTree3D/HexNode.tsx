'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface Floor {
    id: string;
    floorNumber: number;
    roomType: 'combat' | 'fontaine' | 'faveur' | 'boss';
    difficulty?: number;
    bonus?: string;
    pointsReve: number;
}

interface HexNodeProps {
    position: [number, number, number];
    floor: Floor;
    isCurrent: boolean;
    isSelected: boolean;
    onClick: () => void;
}

export function HexNode({ position, floor, isCurrent, isSelected, onClick }: HexNodeProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.PointLight>(null);
    const [hovered, setHovered] = useState(false);

    // Couleurs selon le type de salle
    const getColor = () => {
        if (floor.roomType === 'combat') {
            if (!floor.difficulty) return '#4ade80';
            if (floor.difficulty <= 2) return '#4ade80'; // vert
            if (floor.difficulty <= 3) return '#facc15'; // jaune
            if (floor.difficulty <= 4) return '#f97316'; // orange
            return '#ef4444'; // rouge
        }
        if (floor.roomType === 'fontaine') return '#3b82f6'; // bleu
        if (floor.roomType === 'faveur') return '#a855f7'; // violet
        if (floor.roomType === 'boss') return '#dc2626'; // rouge foncé
        return '#8b5cf6';
    };

    const color = getColor();
    const borderColor = isCurrent ? '#fbbf24' : isSelected ? '#ffffff' : color;

    // Animation
    useFrame((state) => {
        if (!meshRef.current) return;

        // Rotation si actif ou survol
        if (isCurrent || hovered) {
            meshRef.current.rotation.y += 0.01;
        }

        // Lévitation subtile
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.05;

        // Pulse du glow
        if (glowRef.current && isCurrent) {
            glowRef.current.intensity = 3 + Math.sin(state.clock.elapsedTime * 3) * 1;
        }
    });

    // Icône selon le type
    const getIcon = () => {
        switch (floor.roomType) {
            case 'combat': return '⚔️';
            case 'fontaine': return '⛲';
            case 'faveur': return '🌟';
            case 'boss': return '👑';
            default: return '❓';
        }
    };

    return (
        <group position={position}>
            {/* Hexagone principal */}
            <mesh
                ref={meshRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerEnter={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerLeave={() => {
                    setHovered(false);
                    document.body.style.cursor = 'auto';
                }}
                scale={hovered ? 1.1 : 1}
            >
                {/* Géométrie hexagonale */}
                <cylinderGeometry args={[1, 1, 0.2, 6]} />
                <meshStandardMaterial
                    color={borderColor}
                    emissive={borderColor}
                    emissiveIntensity={isCurrent ? 0.8 : hovered ? 0.5 : 0.2}
                    metalness={0.9}
                    roughness={0.1}
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Centre de l'hexagone (surface) */}
            <mesh position={[0, 0.11, 0]}>
                <cylinderGeometry args={[0.7, 0.7, 0.05, 6]} />
                <meshStandardMaterial
                    color="#1a0933"
                    metalness={0.5}
                    roughness={0.3}
                />
            </mesh>

            {/* Étoiles de difficulté (pour combats) */}
            {floor.roomType === 'combat' && floor.difficulty && (
                <Text
                    position={[0, 0.25, 0]}
                    fontSize={0.15}
                    color="#fbbf24"
                    anchorX="center"
                    anchorY="middle"
                >
                    {'★'.repeat(floor.difficulty)}
                </Text>
            )}

            {/* Badge Points de Rêve */}
            <Text
                position={[0, -0.4, 0.8]}
                fontSize={0.2}
                color="#fbbf24"
                anchorX="center"
                anchorY="middle"
                outlineColor="#000000"
                outlineWidth={0.02}
            >
                {`+${floor.pointsReve} PR`}
            </Text>

            {/* Numéro d'étage */}
            <Text
                position={[0, 0.5, 0]}
                fontSize={0.25}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineColor="#000000"
                outlineWidth={0.02}
            >
                {floor.floorNumber.toString()}
            </Text>

            {/* Point light pour le glow (uniquement si current) */}
            {isCurrent && (
                <pointLight
                    ref={glowRef}
                    color="#fbbf24"
                    intensity={3}
                    distance={5}
                />
            )}

            {/* Halo de sélection */}
            {(isCurrent || isSelected) && (
                <mesh position={[0, -0.1, 0]}>
                    <ringGeometry args={[1.1, 1.3, 6]} />
                    <meshBasicMaterial
                        color={isCurrent ? '#fbbf24' : '#ffffff'}
                        transparent
                        opacity={0.5}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}
