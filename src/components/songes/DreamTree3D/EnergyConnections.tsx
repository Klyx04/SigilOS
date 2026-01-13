'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EnergyConnectionsProps {
    positions: [number, number, number][];
}

export function EnergyConnections({ positions }: EnergyConnectionsProps) {
    const linesRef = useRef<THREE.Group>(null);

    // Créer les points de la courbe entre chaque node
    const curves = useMemo(() => {
        const result: THREE.CatmullRomCurve3[] = [];

        for (let i = 0; i < positions.length - 1; i++) {
            const start = new THREE.Vector3(...positions[i]);
            const end = new THREE.Vector3(...positions[i + 1]);

            // Point de contrôle au milieu, légèrement vers le centre (arbre)
            const mid = new THREE.Vector3(
                (start.x + end.x) / 2 * 0.5,
                (start.y + end.y) / 2,
                (start.z + end.z) / 2 * 0.5
            );

            const curve = new THREE.CatmullRomCurve3([start, mid, end]);
            result.push(curve);
        }

        return result;
    }, [positions]);

    // Animation des connexions
    useFrame((state) => {
        if (!linesRef.current) return;

        linesRef.current.children.forEach((child, i) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
                // Pulse d'opacité
                child.material.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 2 + i * 0.5) * 0.2;
            }
        });
    });

    return (
        <group ref={linesRef}>
            {curves.map((curve, index) => (
                <mesh key={index}>
                    <tubeGeometry args={[curve, 20, 0.03, 8, false]} />
                    <meshBasicMaterial
                        color="#a855f7"
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            ))}

            {/* Particules qui voyagent le long des connexions */}
            {curves.map((curve, index) => (
                <TravelingParticle key={`particle-${index}`} curve={curve} speed={0.3} delay={index * 0.2} />
            ))}
        </group>
    );
}

// Particule qui voyage le long d'une courbe
function TravelingParticle({
    curve,
    speed,
    delay
}: {
    curve: THREE.CatmullRomCurve3;
    speed: number;
    delay: number;
}) {
    const ref = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ref.current) return;

        // Position sur la courbe (0 à 1)
        const t = ((state.clock.elapsedTime * speed + delay) % 1);
        const position = curve.getPoint(t);

        ref.current.position.copy(position);
    });

    return (
        <mesh ref={ref}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" />
        </mesh>
    );
}
