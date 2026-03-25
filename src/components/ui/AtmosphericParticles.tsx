'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  width: number;
  height: number;
  left: string;
  top: string;
  animateX: number;
  animateY: number;
  duration: number;
}

export const AtmosphericParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate random values once on mount to avoid impure renders
    setParticles(
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        width: Math.random() * 200 + 100,
        height: Math.random() * 200 + 100,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animateX: Math.random() * 400 - 200,
        animateY: Math.random() * 400 - 200,
        duration: Math.random() * 20 + 10,
      }))
    );
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/5 blur-xl"
          style={{
            width: p.width,
            height: p.height,
            left: p.left,
            top: p.top,
          }}
          animate={{
            x: [0, p.animateX],
            y: [0, p.animateY],
            scale: [1, 1.2, 1],
            opacity: [0.03, 0.08, 0.03],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};
