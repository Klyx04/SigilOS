'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CrystalTreeProps {
    height?: number;
}

export function CrystalTree({ height = 20 }: CrystalTreeProps) {
    const trunkRef = useRef<THREE.Group>(null);
    const branchesRef = useRef<THREE.Group>(null);

    // Animation subtile
    useFrame((state) => {
        if (trunkRef.current) {
            // Légère oscillation
            trunkRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
        }
        if (branchesRef.current) {
            // Branches qui "respirent"
            branchesRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02);
        }
    });

    // Générer des branches aléatoires
    const branches = Array.from({ length: 12 }, (_, i) => ({
        angle: (i / 12) * Math.PI * 2,
        height: 2 + Math.random() * (height - 4),
        length: 2 + Math.random() * 3,
        tilt: 0.3 + Math.random() * 0.5,
    }));

    return (
        <group>
            {/* Tronc principal */}
            <group ref={trunkRef}>
                <mesh position={[0, height / 2, 0]}>
                    <cylinderGeometry args={[0.15, 0.4, height, 8]} />
                    <meshStandardMaterial
                        color="#3b82f6"
                        emissive="#3b82f6"
                        emissiveIntensity={0.4}
                        transparent
                        opacity={0.7}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>

                {/* Effet de glow central */}
                <mesh position={[0, height / 2, 0]}>
                    <cylinderGeometry args={[0.25, 0.55, height, 8]} />
                    <meshBasicMaterial
                        color="#a855f7"
                        transparent
                        opacity={0.1}
                    />
                </mesh>
            </group>

            {/* Branches d'énergie */}
            <group ref={branchesRef}>
                {branches.map((branch, i) => (
                    <group
                        key={i}
                        position={[0, branch.height, 0]}
                        rotation={[branch.tilt, branch.angle, 0]}
                    >
                        <mesh>
                            <cylinderGeometry args={[0.02, 0.08, branch.length, 6]} />
                            <meshStandardMaterial
                                color="#a855f7"
                                emissive="#a855f7"
                                emissiveIntensity={0.6}
                                transparent
                                opacity={0.8}
                            />
                        </mesh>

                        {/* Petite sphère lumineuse au bout */}
                        <mesh position={[0, branch.length / 2, 0]}>
                            <sphereGeometry args={[0.08, 8, 8]} />
                            <meshBasicMaterial color="#ffffff" />
                        </mesh>
                    </group>
                ))}
            </group>

            {/* Particules flottantes autour */}
            {Array.from({ length: 30 }).map((_, i) => (
                <FloatingParticle
                    key={i}
                    initialPosition={[
                        (Math.random() - 0.5) * 6,
                        Math.random() * height,
                        (Math.random() - 0.5) * 6,
                    ]}
                    speed={0.5 + Math.random()}
                    size={0.02 + Math.random() * 0.03}
                />
            ))}

            {/* Base de l'arbre (racines lumineuses) */}
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 2, 6]} />
                <meshStandardMaterial
                    color="#3b82f6"
                    emissive="#3b82f6"
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// Particule flottante individuelle
function FloatingParticle({
    initialPosition,
    speed,
    size
}: {
    initialPosition: [number, number, number];
    speed: number;
    size: number;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const offset = Math.random() * Math.PI * 2;

    useFrame((state) => {
        if (!ref.current) return;

        const t = state.clock.elapsedTime * speed + offset;

        ref.current.position.x = initialPosition[0] + Math.sin(t * 0.5) * 0.3;
        ref.current.position.y = initialPosition[1] + Math.sin(t) * 0.5;
        ref.current.position.z = initialPosition[2] + Math.cos(t * 0.5) * 0.3;

        // Scintillement
        ref.current.scale.setScalar(size * (1 + Math.sin(t * 3) * 0.3));
    });

    return (
        <mesh ref={ref} position={initialPosition}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
        </mesh>
    );
}
