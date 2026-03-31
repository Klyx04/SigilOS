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
      Array.from({ length: 40 }, (_, i) => {
        const size = Math.random() * 4 + 2; // 2px to 6px
        return {
          id: i,
          width: size,
          height: size,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animateX: Math.random() * 100 - 50,
          animateY: Math.random() * -200 - 100, // Float upwards
          duration: Math.random() * 10 + 15,
        };
      })
    );
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)]"
          style={{
            width: p.width,
            height: p.height,
            left: p.left,
            top: p.top,
          }}
          animate={{
            x: [0, p.animateX / 2, p.animateX],
            y: [0, p.animateY / 2, p.animateY],
            scale: [0.5, 1.2, 0.5],
            opacity: [0, 0.6, 0],
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
