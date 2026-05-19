"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Shield, Heart, Trophy, Pause, Play, RefreshCcw, LogOut, Loader2, Music, Volume2, Plus, BookOpen, Settings, Link2, Mic, MicOff } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useDiscordVoice } from '@/hooks/use-discord-voice';
import { DiscordVoiceOverlay } from '@/components/shared/DiscordVoiceOverlay';
import { updatePlayerScore, InvaderRoom } from '@/server/actions/sigil-invader-actions';
import { toast } from 'sonner';
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { cn } from "@/lib/utils";

// --- Types & Constants ---
interface Projectile {
    x: number;
    y: number;
    speed: number;
    vx?: number;
    vy?: number;
    damage: number;
    color: string;
    fromPlayer: boolean;
}

interface Enemy {
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    health: number;
    maxHealth: number;
    speed: number;
    amplitude: number;
    phase: number;
    lastShot: number;
    trajectory: 'linear' | 'sine' | 'zigzag' | 'dive' | 'spiral';
    targetX?: number; // For dive behavior
    dead?: boolean; // Marked for removal — avoids splice inside forEach
    baseX?: number; // Formation anchor X
    baseY?: number; // Formation anchor Y
}

interface Obstacle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    hp: number;
    maxHp: number;
    type: 'asteroid' | 'mine';
    rotation: number;
    spin: number;
    lastBlink?: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

const PLAYER_SPEED = 8;
const BASE_SHOOT_COOLDOWN = 250;
const ENEMY_BASE_SPEED = 1.3; // Softened starting speed
const MAX_WEAPON_TIME = 12000;
const MAX_SHIELD_TIME = 8000;
const MAX_COMBO = 50;

interface GameManifest {
    mobs: { id: number; name: string }[];
    bosses: { id: number; name: string }[];
}

interface WeaponState {
    level: number;
    activeTypes: ('basic' | 'kamas' | 'laser_xelor')[];
    projectileCount: number;
}

export default function SigilInvaderGame({ room, guildId, isSolo, isSpectator }: { room: InvaderRoom, guildId: string, isSolo?: boolean, isSpectator?: boolean }) {
    const { data: session } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [gameState, setGameState] = useState<'CLASS_SELECT' | 'LOADING' | 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'SHOP'>('LOADING');
    const [score, setScore] = useState(0);
    const [lives, _setLives] = useState(5); // Internal for UI
    const [hp, setHp] = useState(100);
    const [wave, setWave] = useState(1);
    const [difficulty, setDifficulty] = useState(1);
    const [weapon, setWeapon] = useState<WeaponState>({ level: 1, activeTypes: ['basic'], projectileCount: 1 });
    const [weaponTime, setWeaponTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [playerClass, setPlayerClass] = useState<'cra' | 'iop' | 'enutrof' | 'xelor'>('cra');
    const [announcement, setAnnouncement] = useState<{ text: string, type: 'wave' | 'boss' } | null>(null);

    const { voiceUsers } = useDiscordVoice(guildId, socket);
    const [showGuide, setShowGuide] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showVoiceOverlay, setShowVoiceOverlay] = useState(true);
    const [particlesEnabled, setParticlesEnabled] = useState(true);




    const [gameManifest, setGameManifest] = useState<GameManifest | null>(null);
    const [assetsLoaded, setAssetsLoaded] = useState(false);
    const [isMusicEnabled, setIsMusicEnabled] = useState(true);
    const [musicVolume, setMusicVolume] = useState(0.4);
    const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
    const [lastLoopError, setLastLoopError] = useState<string | null>(null);
    
    // Web Audio Manager
    const audioCtx = useRef<AudioContext | null>(null);
    const musicPool = useRef<HTMLAudioElement[]>([]);
    const currentTrackIndex = useRef(0);
    const isTransitioning = useRef(false);

    // --- Game Engine State ---
    const engineRef = useRef({
        player: { 
            x: 0, y: 0, width: 64, height: 64, lastShot: 0, 
            isShielded: false, shieldTime: 0, weapon: 'basic' as 'basic' | 'kamas' | 'laser_xelor', weaponTime: 0,
            rotation: 0, 
            recoil: 0, // Visual only recoil
            spin: 0, // Visual only rotation kick
            muzzleFlash: 0, // Bug fix: was at root level, must be on player
            health: 100, maxHealth: 100,
            isDead: false, // NEW: Spectator state
            armor: 0, maxArmor: 100, // NEW: Abraknyde Bonus
            perks: {
                slowProjectiles: false, // Xelor
                dodgeChance: 0,        // Ecaflip
                sacrierFury: false,     // Sacrier
                piercingShots: false,   // Cra
            },
            permanentUpgrades: { damage: 1, speed: 1, fireRate: 1 }
        },
        projectiles: [] as Projectile[],
        powerups: [] as { x: number, y: number, type: string, speed: number }[],
        enemies: [] as Enemy[],
        particles: [] as Particle[],
        clouds: [] as { x: number, y: number, speed: number, size: number, opacity: number }[],
        keys: {} as Record<string, boolean>,
        lastFrame: 0,
        wavePending: false, // Fix double wave spawn
        flashTime: 0, // NEW: Screen Flash Effect
        shakeTime: 0, // NEW: Camera Shake
        images: {} as Record<string, HTMLImageElement | HTMLCanvasElement>,
        animationId: 0,
        mouseX: 300,
        mouseY: 0,
        muzzleFlash: 0,
        bossHitFlash: 0, 
        damageToasts: [] as { id?: number, x: number, y: number, text: string, life: number, color: string }[],
        souls: {} as Record<string, { x: number, y: number, class: string, name: string, score: number, isDead?: boolean }>, // Ghost Multiplayer
        obstacles: [] as Obstacle[], // NEW: Debris and Asteroids
        // --- High-Frequency Optimized State ---
        score: 0,
        lives: 5,
        wave: 1,
        waveQuota: 0, // Total to kill this wave
        mobsKilled: 0, // Current kills
        weaponTime: 0,
        combo: 0,
        comboTime: 0,
        tick: 0,
        syncTime: 0,
        shopEndTime: 0, // Market sync timer
        combatLog: [] as { id: number, text: string, life: number, color: string }[],
        purchaseHistory: {} as Record<string, number>, // Scaling Shop Costs
        bot: null as { x: number, y: number, lastShot: number, rotation: number } | null
    });

    // Filter voice users to only show active participants (Safe to access engineRef now)
    const gameParticipantIds = useMemo(() => {
        const ids = new Set<string>();
        if (session?.user?.id) ids.add(session.user.id);
        (room?.players || []).forEach(p => ids.add(p.userId));
        Object.keys(engineRef.current.souls).forEach(uid => ids.add(uid));
        return Array.from(ids);
    }, [room?.players, session?.user?.id]);
    const voiceUserIds = voiceUsers.map(u => u.userId);


    // --- DJ CROSSFADE MUSIC ENGINE ---
    useEffect(() => {
        // Init sounds if not done
        if (musicPool.current.length === 0) {
            const s1 = new Audio('/sounds/son-ambiance-sigil-invaders.mp3');
            const s2 = new Audio('/sounds/son-ambiance-sigil-invaders2.mp3');
            [s1, s2].forEach(s => { s.loop = true; s.preload = 'auto'; });
            musicPool.current = [s1, s2];
        }

        const tracks = musicPool.current;
        const handleTimeUpdate = (e: Event) => {
            const track = e.target as HTMLAudioElement;
            // Start crossfade 8 seconds before end (DJ mode)
            if (!isTransitioning.current && track.duration && isFinite(track.duration) && track.currentTime > track.duration - 8) {
                isTransitioning.current = true;
                
                const nextTrackIdx = (tracks.indexOf(track) + 1) % tracks.length;
                const nextTrack = tracks[nextTrackIdx];

                // Prep next track
                nextTrack.volume = 0;
                nextTrack.currentTime = 0;
                nextTrack.play().then(() => {
                    // Crossfade duration 8s
                    const duration = 8000;
                    const interval = 100;
                    const steps = duration / interval;
                    let step = 0;

                    const crossfade = setInterval(() => {
                        step++;
                        const progress = step / steps;
                        const targetVol = musicVolume * volume;

                        track.volume = Math.max(0, targetVol * (1 - progress));
                        nextTrack.volume = Math.min(targetVol, targetVol * progress);

                        if (step >= steps) {
                            clearInterval(crossfade);
                            track.pause();
                            currentTrackIndex.current = nextTrackIdx;
                            isTransitioning.current = false;
                        }
                    }, interval);
                }).catch(e => {
                    console.warn("DJ: Next track blocked", e);
                    isTransitioning.current = false;
                });
            }
        };

        if ((gameState === 'PLAYING' || gameState === 'SHOP') && isMusicEnabled && !isMuted) {
            tracks.forEach(t => t.addEventListener('timeupdate', handleTimeUpdate));
            
            const activeTrack = tracks[currentTrackIndex.current];
            // Initial play if all paused
            if (activeTrack.paused && !isTransitioning.current) {
                activeTrack.volume = 0;
                activeTrack.play().then(() => {
                    const targetVol = musicVolume * volume;
                    let cur = 0;
                    const fadeIn = setInterval(() => {
                        cur += 0.05;
                        if (cur >= targetVol) {
                            activeTrack.volume = targetVol;
                            clearInterval(fadeIn);
                        } else {
                            activeTrack.volume = Math.min(cur, targetVol);
                        }
                    }, 50);
                }).catch(e => console.warn("DJ: Play blocked", e));
            } else if (!isTransitioning.current) {
                // Adjust volume if changed
                activeTrack.volume = musicVolume * volume;
            }
        } else {
            // Global Stop/Pause with fade out
            tracks.forEach(t => {
                t.removeEventListener('timeupdate', handleTimeUpdate);
                if (!t.paused) {
                    let cur = t.volume;
                    const fadeOut = setInterval(() => {
                        cur -= 0.05;
                        if (cur <= 0) {
                            t.volume = 0;
                            t.pause();
                            t.currentTime = 0;
                            clearInterval(fadeOut);
                        } else {
                            t.volume = Math.max(0, cur);
                        }
                    }, 50);
                }
            });
        }

        return () => {
            tracks.forEach(t => t.removeEventListener('timeupdate', handleTimeUpdate));
        };
    }, [gameState, isMusicEnabled, isMuted, musicVolume, volume]);

    // Sound logic
    const playSound = useCallback((type: 'shoot' | 'laser' | 'explosion' | 'powerup' | '1up' | 'kamas') => {
        if (isMuted) return;
        if (!audioCtx.current) {
            audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtx.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;
        const vol = isMuted ? 0 : volume;

        if (type === 'shoot') {
            // Variation based on Class
            const freq = playerClass === 'iop' ? 400 : (playerClass === 'enutrof' ? 1400 : (playerClass === 'xelor' ? 1800 : 800));
            const randomPitch = 1 + (Math.random() - 0.5) * 0.2;
            
            // Iop=Heavy(Saw), Cra=Snappy(Tri), Enu=Clink(Square), Xelor=Chime(Sine)
            osc.type = playerClass === 'iop' ? 'sawtooth' : (playerClass === 'cra' ? 'triangle' : (playerClass === 'enutrof' ? 'square' : 'sine'));
            osc.frequency.setValueAtTime(freq * randomPitch, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            
            gainNode.gain.setValueAtTime((playerClass === 'xelor' ? 0.05 : 0.08) * vol, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'laser') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300 + Math.random() * 100, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            gainNode.gain.setValueAtTime(0.04 * vol, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'explosion') {
            // Highly Varied Explosion Synthesis (Metal Slug Style)
            const r = Math.random();
            const isHeavy = r > 0.65;
            const isMetallic = r < 0.25;
            
            const dur = isHeavy ? 0.7 : 0.4;
            const bufferSize = ctx.sampleRate * dur;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;
                const env = Math.pow(1 - t, isHeavy ? 4 : 2);
                // Mix white noise with periodic "crunch"
                data[i] = (Math.random() * 2 - 1) * env * (isMetallic ? (Math.random() > 0.6 ? 1.5 : 0.2) : 1);
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = isMetallic ? 'bandpass' : 'lowpass';
            filter.frequency.setValueAtTime(isHeavy ? 120 : (isMetallic ? 1800 : 700 + Math.random() * 900), now);
            if (isMetallic) filter.Q.value = 4.0;
            
            const mainGain = ctx.createGain();
            mainGain.gain.setValueAtTime((isHeavy ? 0.45 : 0.2) * vol, now);
            mainGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            
            noise.connect(filter);
            filter.connect(mainGain);
            mainGain.connect(ctx.destination);
            
            // Sub-Bass "Thump" Layer
            const sub = ctx.createOscillator();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(isHeavy ? 55 : 90 + Math.random() * 40, now);
            sub.frequency.exponentialRampToValueAtTime(10, now + (dur * 0.4));
            const subGain = ctx.createGain();
            subGain.gain.setValueAtTime(0.6 * vol, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + (dur * 0.3));
            sub.connect(subGain);
            subGain.connect(ctx.destination);
            
            noise.start(now);
            sub.start(now);
            sub.stop(now + dur);
        } else if (type === 'powerup' || type === '1up') {
            osc.type = 'sine';
            const base = type === '1up' ? 600 : 400;
            osc.frequency.setValueAtTime(base, now);
            osc.frequency.exponentialRampToValueAtTime(base * 2, now + 0.1);
            osc.frequency.exponentialRampToValueAtTime(base * 3, now + 0.2);
            gainNode.gain.setValueAtTime(0.12 * vol, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'kamas') {
            // CHA-CHING (Coin sound)
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, now);
            osc.frequency.setValueAtTime(2000, now + 0.05);
            gainNode.gain.setValueAtTime(0.06 * vol, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }, [isMuted, volume, playerClass]);
    
    // Process transparency for DofusDB assets
    const processTransparency = useCallback((img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return img;
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // CHROMA-KEY: Detect background color from pixel (0,0)
            const targetR = data[0];
            const targetG = data[1];
            const targetB = data[2];

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                // Distance check from the corner "chroma" color
                const dist = Math.sqrt(Math.pow(targetR-r, 2) + Math.pow(targetG-g, 2) + Math.pow(targetB-b, 2));
                // Also handle white specifically just in case
                const whiteDist = Math.sqrt(Math.pow(255-r, 2) + Math.pow(255-g, 2) + Math.pow(255-b, 2));
                
                if (dist < 100 || whiteDist < 60) {
                    data[i+3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        } catch (e) {
            return img;
        }
    }, []);

    // --- Assets Loading ---
    useEffect(() => {
        const loadAssets = async () => {
            const manifestRes = await fetch('/game-data/invader/manifest.json');
            const manifest: GameManifest = await manifestRes.json();
            setGameManifest(manifest);

            const assets: Record<string, string> = {
                player: '/assets/dofus/classes/9.png', // Default Cra
                class_cra: '/assets/dofus/classes/9.png',
                class_iop: '/assets/dofus/classes/8.png',
                class_enutrof: '/assets/dofus/classes/3.png',
                class_xelor: '/assets/dofus/classes/5.png',
                boss_placeholder: '/game-data/invader/bosses/147.png'
            };

            // Loading monsters from manifest
            manifest.mobs.forEach(m => {
                assets[`mob_${m.id}`] = `/game-data/invader/mobs/${m.id}.webp`;
            });
            
            // Loading all bosses
            manifest.bosses.forEach(b => {
                assets[`boss_${b.id}`] = `/game-data/invader/bosses/${b.id}.webp`;
            });

            const assetEntries = Object.entries(assets);
            setLoadProgress({ current: 0, total: assetEntries.length });

            const loadedImages: Record<string, HTMLImageElement | HTMLCanvasElement | null> = {};
            let localLoadedCount = 0;
            
            const promises = Object.entries(assets).map(([key, src]) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous"; 
                    img.src = src;

                    const onAssetFinished = () => {
                        localLoadedCount++;
                        // Throttle state updates to avoid render thrashing
                        if (localLoadedCount % 5 === 0 || localLoadedCount === assetEntries.length) {
                            setLoadProgress({ current: localLoadedCount, total: assetEntries.length });
                        }
                        resolve(null);
                    };

                    img.onload = () => {
                        loadedImages[key] = processTransparency(img);
                        onAssetFinished();
                    };
                    img.onerror = () => {
                        console.warn(`SigilInvader: Asset ${src} missing, will fallback.`);
                        loadedImages[key] = null; // Mark as failed
                        onAssetFinished();
                    };
                });
            });

            await Promise.all(promises);
            
            // --- Atomic Fallback Assignment (Post-Load) ---
            // Now that we've tried everything, fill the gaps
            const fallbackMob = loadedImages['mob_36'] || null;
            const fallbackPlayer = loadedImages['class_cra'] || null;

            Object.keys(assets).forEach(key => {
                if (!loadedImages[key]) {
                    if (key.startsWith('mob_')) {
                        loadedImages[key] = fallbackMob || fallbackPlayer;
                    } else if (key.startsWith('boss_')) {
                        loadedImages[key] = loadedImages['boss_placeholder'] || fallbackMob || fallbackPlayer;
                    } else if (key.startsWith('class_') || key === 'player') {
                        loadedImages[key] = fallbackPlayer || loadedImages['mob_36'];
                    }
                }
            });

            // Clean up nulls just in case (to avoid crashes in draw loop)
            Object.keys(loadedImages).forEach(key => {
                if (loadedImages[key] === null) delete loadedImages[key];
            });

            engineRef.current.images = loadedImages as any;
            setAssetsLoaded(true);
            setGameState('CLASS_SELECT');
            console.log("SigilInvader: Assets Loaded", Object.keys(loadedImages));
            
            const canvas = canvasRef.current;
            if (canvas) {
                engineRef.current.clouds = Array.from({ length: 15 }).map(() => ({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    speed: 0.1 + Math.random() * 0.3,
                    size: 20 + Math.random() * 40,
                    opacity: 0.05 + Math.random() * 0.1
                }));
            }
            
            if (canvasRef.current) {
                engineRef.current.player.x = canvasRef.current.width / 2 - 32;
                engineRef.current.player.y = canvasRef.current.height - 150;
            }
            
            setGameState('CLASS_SELECT');
        };

        if (gameState === 'LOADING') {
            loadAssets();
            if (isSpectator) {
                setGameState('PLAYING'); // Jump straight to play for spectators
            }
        }
    }, [gameState, isSpectator]);

    // --- Gameplay Logic ---
    const spawnWave = useCallback((waveIndex: number) => {
        const engine = engineRef.current;
        engine.wavePending = true;
        engine.mobsKilled = 0;
        const enemies: Enemy[] = [];
        
        // Announcements
        if (waveIndex % 5 === 0) {
            setAnnouncement({ text: "⚠️ BOSS EN APPROCHE ⚠️", type: 'boss' });
            engine.waveQuota = 1;
        } else {
            setAnnouncement({ text: `VAGUE ${waveIndex}`, type: 'wave' });
            engine.waveQuota = 15 + (waveIndex * 10); // Will be updated by formation spawner
        }
        setTimeout(() => {
            setAnnouncement(null);
            engine.wavePending = false; // RELEASE spawn lock after announcement
        }, 3000);
        
        // --- HIGH-PRECISION SCALING ENGINE (Square Root Scaling) ---
        // We use sqrt for a curve that grows steadily but never explodes vertically.
        const waveScale = Math.sqrt(waveIndex); // 1->1, 4->2, 9->3, 16->4, 25->5
        const speedMult = 1.0 + (waveScale * 0.15); // Gradual speed increase
        const hpMult = 1.0 + (waveScale * 0.8);    // Controlled HP scaling

        // Player Count Scaling (Softened)
        const playerCount = Object.keys(engine.souls).length + 1;
        const playerHpMult = 1 + (playerCount - 1) * 0.35; // +35% HP per extra player
        const playerQuotaMult = 1 + (playerCount - 1) * 0.45; // +45% mobs per extra player

        // Wave start invulnerability
        engineRef.current.player.isShielded = true;
        engineRef.current.player.shieldTime = 3000;

        if (waveIndex % 5 === 0) {
            // Boss Pool expands dynamically: 4 new bosses unlocked per boss wave
            // Wave 5 → first 4 | Wave 10 → first 8 | Wave 25 → all 20 | etc.
            const bossWave = Math.floor(waveIndex / 5); // 1, 2, 3, ...
            const poolSize = Math.max(3, Math.min((gameManifest?.bosses.length || 1), bossWave * 4));
            const maxBossIndex = poolSize - 1;
            const bossData = gameManifest?.bosses[Math.floor(Math.random() * (maxBossIndex + 1))] || { id: 147, name: "Bouftou Royal" };
            enemies.push({
                x: (canvasRef.current?.width || 800) / 2 - 80,
                y: -200,
                width: 160,
                height: 160,
                type: `boss_${bossData.id}`,
                health: 500 * hpMult * 1.5 * playerHpMult,
                maxHealth: 500 * hpMult * 1.5 * playerHpMult,
                speed: 0.8 + (speedMult * 0.2), // Bosses shouldn't zoom instantly
                amplitude: 150 + Math.random() * 100,
                phase: 0,
                lastShot: 0,
                trajectory: 'linear'
            });
        } else {
            // FORMATION SPAWNING (Chicken Invaders Style)
            const mobList = gameManifest?.mobs || [{ id: 36, name: "Bouftou" }];
            const primaryMob = mobList[(waveIndex - 1) % mobList.length];
            const secondaryMob = mobList[waveIndex % mobList.length];
            const canvasW = canvasRef.current?.width || 1920;
            
            const formations: string[] = ['grid', 'v-shape', 'line', 'triangle', 'double-v'];
            const formation = formations[waveIndex % formations.length];
            
            const startY = -200;
            const centerX = canvasW / 2;
            
            // Unified trajectory for the formation
            let traj: 'linear' | 'sine' | 'zigzag' | 'dive' | 'spiral' = 'linear';
            if (waveIndex > 2) traj = Math.random() > 0.6 ? 'sine' : 'linear';
            if (waveIndex > 6) traj = (['linear', 'sine', 'zigzag'] as const)[Math.floor(Math.random() * 3)];
            
            const sharedPhase = Math.random() * Math.PI * 2;
            const sharedSpeed = (1.2 + (waveIndex * 0.1)) * speedMult;
            const baseHp = Math.floor((10 + waveIndex * 5) * hpMult * playerHpMult);

            let spawnedCount = 0;
            const addMob = (rx: number, ry: number) => {
                const isElite = Math.random() > 0.95; // Rare elites in formation
                const hp = isElite ? baseHp * 3 : baseHp;
                const chosenMob = Math.random() < 0.75 ? primaryMob : secondaryMob;
                
                enemies.push({
                    x: Math.random() * canvasW, 
                    y: -100 - Math.random() * 600, // Spawn high up and scatter
                    width: isElite ? 66 : 46, height: isElite ? 66 : 46,
                    type: `mob_${chosenMob.id}`,
                    health: hp, maxHealth: hp,
                    speed: sharedSpeed,
                    amplitude: 50, phase: (rx + Math.abs(ry)) * 0.05,
                    lastShot: Math.random() * 2000, 
                    trajectory: traj,
                    baseX: rx - 25,
                    baseY: 400 + (ry - startY) // Position bottom of formation lower (y=400) so tops don't hit negative 
                });
                spawnedCount++;
            };

            if (formation === 'grid') {
                const rows = Math.min(3 + Math.floor(waveIndex / 4), 5); // Cap at 5 rows
                const cols = Math.min(Math.floor((6 + Math.floor(waveIndex / 3)) * playerQuotaMult), 12); // Cap at 12 cols
                const spacingX = Math.min(100, canvasW / (cols + 1));
                const startX = centerX - ((cols - 1) * spacingX) / 2;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) addMob(startX + c * spacingX, startY - r * 80);
                }
            } else if (formation === 'v-shape' || formation === 'double-v') {
                const size = Math.min(10 + Math.floor(waveIndex / 2), 20);
                const spacingX = 60; // Squashed
                const spacingY = 30; // Squashed to prevent reaching off-screen
                addMob(centerX, startY);
                for (let i = 1; i <= size; i++) {
                    addMob(centerX - i * spacingX, startY - i * spacingY);
                    addMob(centerX + i * spacingX, startY - i * spacingY);
                }
                if (formation === 'double-v' && waveIndex > 3) {
                    addMob(centerX, startY - 200);
                    for (let i = 1; i <= Math.floor(size * 0.7); i++) {
                        addMob(centerX - i * spacingX, startY - i * spacingY - 200);
                        addMob(centerX + i * spacingX, startY - i * spacingY - 200);
                    }
                }
            } else if (formation === 'line') {
                const cols = Math.min(15 + waveIndex, 25);
                const spacingX = 80;
                const startX = centerX - ((cols - 1) * spacingX) / 2;
                for (let c = 0; c < cols; c++) {
                    addMob(startX + c * spacingX, startY);
                    if (waveIndex > 4) addMob(startX + c * spacingX, startY - 100);
                    if (waveIndex > 8) addMob(startX + c * spacingX, startY - 200);
                }
            } else if (formation === 'triangle') {
                const baseSize = Math.min(5 + Math.floor(waveIndex / 3), 10);
                const spacingX = 60;
                const spacingY = 40;
                for (let r = 0; r < baseSize; r++) {
                    const rowItems = r + 1;
                    const startX = centerX - ((rowItems - 1) * spacingX) / 2;
                    for (let c = 0; c < rowItems; c++) addMob(startX + c * spacingX, startY - r * spacingY);
                }
            }
            
            // Critical Fix: Sync wave quota to EXACTLY the formation size!
            // This prevents drip feed from ruining the formation immediately.
            engineRef.current.waveQuota = spawnedCount;
        }
        engineRef.current.enemies = enemies;
        engineRef.current.wavePending = false;
    }, [gameManifest, wave]);

    const spawnExplosion = (x: number, y: number, color: string = '#ffffff', count: number = 15) => {
        const engine = engineRef.current;
        // Optimization: Cap particles to maintain 60FPS
        if (engine.particles.length > 200) return;

        for (let i = 0; i < count; i++) {
            engine.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 14,
                vy: (Math.random() - 0.5) * 14,
                life: 1,
                maxLife: 0.4 + Math.random() * 0.6,
                color, size: 2 + Math.random() * 4
            });
        }
    };

    const handleEnemyDeath = (e: any, eIdx: number) => {
        playSound('explosion');
        const isBoss = e.type.toString().includes('boss');
        const basePoints = isBoss ? 15000 : 200;
        const finalPoints = (e as any).lastHitWasCrit ? basePoints * 2 : basePoints;
        
        // Push to Combat Feed
        engineRef.current.combatLog.unshift({
            id: Math.random(),
            text: isBoss ? "BOSS DÉTRUIT" : ((e as any).lastHitWasCrit ? `CRIT KILL! [ +${finalPoints} ]` : `CIBLE ABATTUE [ +${finalPoints} ]`),
            life: 1.0,
            color: isBoss ? '#ef4444' : ((e as any).lastHitWasCrit ? '#fbbf24' : '#60a5fa')
        });
        if (engineRef.current.combatLog.length > 8) engineRef.current.combatLog.pop();

        // Update both React state and Engine Ref
        engineRef.current.score += finalPoints;
        setScore(engineRef.current.score);

        if (!isBoss) {
            engineRef.current.mobsKilled++;
            // Combo System (Capped at 50)
            engineRef.current.combo = Math.min(MAX_COMBO, engineRef.current.combo + 1);
            engineRef.current.comboTime = Date.now();
        } else {
            engineRef.current.mobsKilled = engineRef.current.waveQuota; 
        }

        spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, '#ffff00', 30);
        
        // Damage Toasts (Cap at 15 for visibility/perf)
        if (engineRef.current.damageToasts.length < 15) {
            engineRef.current.damageToasts.push({
                x: e.x + e.width / 2, y: e.y, text: `+${finalPoints}`, life: 1, color: '#facc15'
            });
        }
        if (isBoss) {
            engineRef.current.damageToasts.push({
                x: e.x + e.width / 2, y: e.y - 40, text: 'BOSS DEFEATED!', life: 1.5, color: '#f87171'
            });
            engineRef.current.shakeTime = 800;
        }

        // Bug fix: always mark dead first — removal is done via filter at end of update()
        // Previously: splice() inside forEach caused skipped enemies and double-kills
        e.dead = true;

        // Powerup drop: 6% base (12% for Enutrof), always for boss
        const dropRoll = Math.random();
        const shouldDrop = isBoss ? true : dropRoll > (playerClass === 'enutrof' ? 0.88 : 0.94);
        if (shouldDrop) {
            // Weighted Selection Logic
            let types: string[] = ['kamas', 'kamas', 'kamas', 'kamas']; // VERY common (80%)
            const rand = Math.random();
            if (rand > 0.8) types = ['laser_xelor']; // Weapon (Uncommon)
            if (rand > 0.94) types = ['shield']; // Shield (RARE)
            if (rand > 0.97 && engineRef.current.lives < 5) types = ['cawotte']; // Heart (EPIC RARE)

            const finalType = types[Math.floor(Math.random() * types.length)];
            
            engineRef.current.powerups.push({
                x: e.x + e.width / 2, 
                y: e.y + e.height / 2, 
                type: finalType as any, 
                speed: 2.5
            });
        }
    };

    const resetGame = () => {
        const engine = engineRef.current;
        setScore(0); _setLives(5); setWave(0); setDifficulty(1);
        engine.player.x = 265; engine.player.y = 650; // Higher up and centered
        setGameState('CLASS_SELECT');
    };

    const startGameWithClass = (choice: 'cra' | 'iop' | 'enutrof' | 'xelor') => {
        setPlayerClass(choice);
        const engine = engineRef.current;
        
        // --- Unified Tactical Deployment: All classes start with CRA's Arrow System ---
        setWeapon({ level: 1, activeTypes: ['basic'], projectileCount: 1 });
        engine.player.weapon = 'basic';
        engine.weaponTime = 0;
        
        // Equilibrage strict communautaire : Les classes sont 100% cosmétiques, base stats fixes
        if (choice === 'xelor') {
            engine.player.permanentUpgrades.fireRate = 1.0;
        } else if (choice === 'enutrof') {
            engine.player.permanentUpgrades.fireRate = 1.0;
            engine.player.permanentUpgrades.damage = 1.0;
        } else if (choice === 'iop') {
            engine.player.permanentUpgrades.damage = 1.0;
            engine.player.permanentUpgrades.fireRate = 1.0;
        } else {
            // Cra
            engine.player.permanentUpgrades.fireRate = 1.0;
        }
        
        // Reset Aiming to perfect center-up
        engine.mouseX = canvasRef.current ? canvasRef.current.width / 2 : 300;
        engine.mouseY = -2000; // Deep vertical aim
        
        // Metal Slug Feel: Responsive scale
        engine.player.width = 70;
        engine.player.height = 70;

        if (audioCtx.current?.state === 'suspended') audioCtx.current.resume();
        
        // --- Critical Bug Fix: Update Player Graphic ---
        const choiceKey = `class_${choice}`;
        if (engine.images[choiceKey]) {
            engine.images.player = engine.images[choiceKey];
        }
        
        // --- Critical Bug Fix: Start at Wave 1 ---
        engine.player.rotation = 0;
        engine.score = 0;
        engine.lives = 5;
        engine.wave = 1; // Corrected from 0
        engine.player.x = (canvasRef.current?.width || 600) / 2 - 35;
        engine.player.y = (canvasRef.current?.height || 900) - 250; 
        
        _setLives(5);
        setScore(0);
        setWave(1);
        setGameState('PLAYING');
        spawnWave(1);
    };

    const update = (dt: number) => {
        if (gameState !== 'PLAYING') return;
        const isHost = session?.user?.id === room.hostId;
        const engine = engineRef.current;
        engine.tick = (engine.tick || 0) + 1;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const now = Date.now();
        
        // --- NaN Defense System: Protect against uninitialized or corrupted state ---
        if (!isFinite(engine.player.x) || !isFinite(engine.player.y)) {
            engine.player.x = canvas.width / 2 - 35;
            engine.player.y = canvas.height - 250;
        }
        if (!isFinite(engine.player.width)) engine.player.width = 70;
        if (!isFinite(engine.player.height)) engine.player.height = 70;
        if (!isFinite(engine.player.rotation)) engine.player.rotation = 0;
        if (!isFinite(engine.player.recoil)) engine.player.recoil = 0;
        if (!isFinite(engine.mouseX)) engine.mouseX = canvas.width / 2;
        if (!isFinite(engine.mouseY)) engine.mouseY = -2000;

        const shouldShoot = engine.keys['mousedown'] || engine.keys[' '] || engine.keys['Enter'];
        const isLaserActive = weapon?.activeTypes?.includes('laser_xelor') || false;
        const isKamasActive = weapon?.activeTypes?.includes('kamas') || false;
        const currentCooldown = isLaserActive ? 150 : (isKamasActive ? 200 : 250);

        let vx = 0;
        let vy = 0;
        const moveSpeed = PLAYER_SPEED * (engine.player?.permanentUpgrades?.speed || 1);

        if (!isSpectator) {
            if (engine.keys['w'] || engine.keys['ArrowUp'] || engine.keys['z']) vy -= moveSpeed;
        if (engine.keys['s'] || engine.keys['ArrowDown']) vy += moveSpeed;
        if (engine.keys['a'] || engine.keys['ArrowLeft'] || engine.keys['q']) vx -= moveSpeed;
        if (engine.keys['d'] || engine.keys['ArrowRight']) vx += moveSpeed;

        // Apply movement & clamping (keeping player in realistic bounds)
        engine.player.x += vx;
        engine.player.y += vy;
        }
        
        // Bounds checking (Strictly inside the 600 width decor)
        if (engine.player.x < 10) engine.player.x = 10;
        if (engine.player.x > canvas.width - engine.player.width - 10) engine.player.x = canvas.width - engine.player.width - 10;
        // Relaxed Height: up to 30% from the top
        if (engine.player.y < canvas.height * 0.3) engine.player.y = canvas.height * 0.3; 
        if (engine.player.y > canvas.height - engine.player.height - 20) engine.player.y = canvas.height - engine.player.height - 20;

        // --- Twin-Stick Aiming (Smoothed Look-At) ---
        const pCenterX = engine.player.x + engine.player.width/2;
        const pCenterY = engine.player.y + engine.player.height/2;
        
        const targetX = engine.mouseX;
        const targetY = engine.mouseY;
        const aimAngle = Math.atan2(targetY - pCenterY, targetX - pCenterX); // RAW aim angle
        const targetRotation = aimAngle + Math.PI / 2; // Graphic adjustment
        
        // Smooth rotation using lerp on angle delta (Increased responsiveness)
        const delta = targetRotation - engine.player.rotation;
        const normalizedDelta = Math.atan2(Math.sin(delta), Math.cos(delta));
        engine.player.rotation += normalizedDelta * 0.4; 

        const sacrierMult = engine.player.perks.sacrierFury ? 1 + (1 - engine.player.health/100) * 0.8 : 1;
        const finalDmgMult = (engine.player?.permanentUpgrades?.damage || 1) * sacrierMult;

        const canShoot = !isSpectator && !engine.player.isDead && now - (engine.player?.lastShot || 0) > (currentCooldown / (engine.player?.permanentUpgrades?.fireRate || 1));
        
        if (canShoot && shouldShoot) {
            engine.player.lastShot = now;
            engine.player.muzzleFlash = 4;
            engine.player.recoil = 10;
            engine.player.spin += 0.2;
            
            // PROJECTILE DIRECTION: Follow the ship's actual rotation to avoid "laggy" aiming
            const firingAngle = engine.player.rotation - Math.PI / 2;

            const comboBonus = engine.combo >= 40 ? 4 : (engine.combo >= 25 ? 2 : (engine.combo >= 10 ? 1 : 0));
            // Cap projectile count to avoid extreme browser lag
            const count = Math.min(12, (weapon?.projectileCount || 1) + comboBonus);
            const angleStep = Math.max(0.08, 0.15 - (count * 0.005));

            // --- MULTI-WEAPON STACKING SYSTEM ---
            (weapon?.activeTypes || []).forEach(wType => {
                if (wType === 'laser_xelor') {
                    playSound('laser');
                    engine.projectiles.push({
                        x: pCenterX, y: pCenterY,
                        speed: 0, vx: Math.cos(firingAngle) * 50, vy: Math.sin(firingAngle) * 50, 
                        damage: 15 * (engine.player?.permanentUpgrades?.damage || 1), // FIXED: No more difficulty multiplier on DMG
                        color: 'laser_purple', fromPlayer: true
                    });
                } else if (wType === 'kamas') {
                    playSound('kamas');
                    for(let i=0; i < count; i++) {
                        const shootAngle = firingAngle + (i - (count-1)/2) * angleStep;
                        engine.projectiles.push({
                            x: pCenterX, y: pCenterY,
                            speed: 15, vx: Math.cos(shootAngle) * 16, vy: Math.sin(shootAngle) * 16,
                            damage: 12 * (engine.player?.permanentUpgrades?.damage || 1), // FIXED: No more difficulty multiplier
                            color: '#facc15', fromPlayer: true
                        });
                    }
                } else if (wType === 'basic') {
                    playSound('shoot');
                    for(let i=0; i < count; i++) {
                        const shootAngle = firingAngle + (i - (count-1)/2) * angleStep;
                        engine.projectiles.push({
                            x: pCenterX, y: pCenterY,
                            speed: 15, vx: Math.cos(shootAngle) * 15, vy: Math.sin(shootAngle) * 15,
                            damage: 10 * finalDmgMult, // FIXED: No more difficulty multiplier
                            color: '#f97316', fromPlayer: true
                        });
                    }
                }
            });
        }

        // Recoil & Flash Decay
        if (engine.player.recoil > 0) engine.player.recoil -= dt * 0.05;
        if (engine.player.spin > 0) engine.player.spin -= dt * 0.001; // Decay spin
        if (engine.flashTime > 0) engine.flashTime -= dt;

        // Weapon timer
        const hasSpecialWeapon = (weapon?.activeTypes?.length || 0) > 1 || !(weapon?.activeTypes?.includes('basic') ?? true);
        if (engine.weaponTime > 0 && hasSpecialWeapon) {
            engine.weaponTime -= dt;
        }
        if (engine.weaponTime <= 0 && hasSpecialWeapon) {
            setWeapon({ level: 1, activeTypes: ['basic'], projectileCount: 1 });
            engine.player.weapon = 'basic';
            engine.weaponTime = 0;
        }

        // Shield logic
        if (engine.player.isShielded) {
            engine.player.shieldTime -= dt;
            if (engine.player.shieldTime <= 0) engine.player.isShielded = false;
        }

        // Screen Flash decay
        if (engine.flashTime > 0) engine.flashTime -= dt;

        // Combo Reset Check (Global, not only on shoot)
        if (now - engine.comboTime > 4500) { // Increased from 2.5s to 4.5s
            engine.combo = 0;
        }

        // Projectiles movement
        engine.projectiles = engine.projectiles.filter((p) => {
            // Failsafe: Remove NaN projectiles
            if (!isFinite(p.x) || !isFinite(p.y)) {
                return false;
            }

            if (p.vx !== undefined && p.vy !== undefined) {
                p.x += p.vx;
                p.y += p.vy;
            } else {
                p.y += p.speed;
            }
            if (p.y < -100 || p.y > canvas.height + 100 || p.x < -100 || p.x > canvas.width + 100) {
                return false;
            }
            return true;
        });

        // Wave progression: Check mobsKilled vs waveQuota
        if (engine.mobsKilled >= engine.waveQuota && !engine.wavePending && engine.wave > 0) {
            engine.wavePending = true;
            engine.enemies = []; // Clear remaining mobs if any
            
            // Wave Clear Announcement
            setAnnouncement({ text: "SECTEUR SÉCURISÉ", type: 'wave' });
            engine.score += 500;
            
            setTimeout(() => {
                const currentWave = engine.wave;
                const nextWave = currentWave + 1;
                
                if (currentWave % 5 === 0) {
                    setGameState('SHOP');
                    // We increment the engine wave so next time we enter PLAYING it starts from nextWave
                    engine.wave = nextWave;
                    setWave(nextWave);
                } else {
                    engine.wave = nextWave;
                    setWave(nextWave);
                    spawnWave(nextWave);
                }
                engine.wavePending = false;
            }, 2500);
        }

        // (Drip feed spawning removed to enforce strict Formation/Wave structure)

        for (let eIdx = engine.enemies.length - 1; eIdx >= 0; eIdx--) {
            const e = engine.enemies[eIdx];
            if (e.dead) continue; // Already killed this frame — will be filtered after loops
            const isBoss = e.type.toString().includes('boss');
            
            // --- Trajectory Engine ---
            if (isBoss) {
                // Boss AI: Tactical Floating & Horizontal Swaying
                if (e.y < 100) {
                    e.y += e.speed * 2;
                } else {
                    // Smooth tracking to orbital position (Fixed violent snapping/saccades)
                    const targetY = 100 + Math.sin(now / 800 + e.phase) * 40; 
                    const targetX = (canvas.width / 2 - e.width / 2) + Math.cos(now / 1200 + e.phase) * (canvas.width / 3);
                    e.y += (targetY - e.y) * 0.06;
                    e.x += (targetX - e.x) * 0.06;
                }
            } else if (e.trajectory === 'sine' || e.trajectory === 'zigzag' || e.trajectory === 'linear') {
                // Formatting Engine (Chicken Invaders Style)
                if (e.baseY !== undefined && !(e as any).inFormation && e.y < e.baseY) {
                    e.y += e.speed * 4; // Swoop in fast
                    e.x += (e.baseX! - e.x) * 0.08; // Converge to column
                    if (e.y >= e.baseY) (e as any).inFormation = true;
                } else {
                    // Hover in formation + Looming threat (slowly descend over time!)
                    if (e.baseY !== undefined && e.baseY < 600) {
                        e.baseY += 0.15 + (engine.wave * 0.02);
                    }

                    const sway = Math.sin(now / 1500 + (e.trajectory === 'sine' ? e.phase : 0)) * 120;
                    if (e.baseX !== undefined) e.x = e.baseX + sway + Math.sin(now / 400 + e.phase) * (e.trajectory === 'sine' ? 25 : 0); // Erratic wobble
                    if (e.baseY !== undefined) e.y = e.baseY + Math.sin(now / 800 + e.phase) * (e.trajectory === 'zigzag' ? 30 : 10);
                    
                    // Dive Bomb! (Elites or deep waves)
                    const diveChance = 0.999 - (engine.wave * 0.0002);
                    if (Math.random() > diveChance) {
                        e.trajectory = 'dive';
                        e.targetX = engine.player.x;
                    }
                }
            } else if (e.trajectory === 'dive') {
                // Predictive aggressive tracking
                if (e.targetX === undefined) e.targetX = engine.player.x + (Math.random() - 0.5) * 100;
                const dx = e.targetX - (e.x + e.width/2);
                e.y += e.speed * 1.8; // Hard fast dive
                e.x += dx * 0.04; // Smooth but ruthless tracking
            } else if (e.trajectory === 'spiral') {
                e.phase += 0.06; // Faster spinning
                const clampedRadius = Math.min(100 + e.y * 0.15, canvas.width / 2.5);
                e.x = (canvas.width / 2) + Math.cos(e.phase) * clampedRadius;
                e.y += e.speed * 0.8;
            }
            
            // Enemy shooting patterns
            const bossData = isBoss ? gameManifest?.bosses.find(b => b.id === parseInt(e.type.replace('boss_', ''))) : null;
            const bossTier = (bossData as any)?.tier ?? 2;
            let bossPattern = (bossData as any)?.pattern ?? 'SPIRAL_SLOW';
            
            // Dynamic Boss Phases (HP based)
            if (isBoss) {
                const hpRatio = e.health / Math.max(1, (e as any).maxHealth || 100);
                if (hpRatio < 0.25) bossPattern = 'HELLFIRE'; // Phase 3: Enraged
                else if (hpRatio < 0.6) bossPattern = 'CHARGE_BEAM'; // Phase 2: Aggressive
            }

            // Boss fire rate scales with tier: Tier 0 = 700ms, Tier 5 = 300ms
            const bossFireRate = Math.max(300, 700 - bossTier * 70);
            const fireRate = isBoss ? bossFireRate : Math.max(500, 2200 - (difficulty * 250));
            
            // Multi scaling: extra projectiles per additional player
            const playerCount = Object.keys(engine.souls).length + 1;
            const multiProjectileBonus = Math.max(0, playerCount - 1); // 0 in solo, +1 per extra player

            if (now - e.lastShot > fireRate) {
                if (Math.random() > 0.1) {
                if (isBoss) {
                    const bx = e.x + e.width / 2;
                    const by = e.y + e.height / 2;
                    const angleToPlayer = Math.atan2(
                        (engine.player.y + engine.player.height / 2) - by,
                        (engine.player.x + engine.player.width / 2) - bx
                    );
                    // Wave bonus: patterns get more intense over time
                    const waveBonus = Math.floor(wave / 5);

                    if (bossPattern === 'SPIRAL_SLOW') {
                        // Slow rotating spiral — tutorial tier, telegraphed
                        const shots = 6 + waveBonus + multiProjectileBonus;
                        for (let i = 0; i < shots; i++) {
                            const angle = (i / shots) * Math.PI * 2 + (now / 800);
                            engine.projectiles.push({ x: bx, y: by, speed: 3, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, damage: 1, color: '#f87171', fromPlayer: false });
                        }

                    } else if (bossPattern === 'JELLY_BOUNCE') {
                        // Bouncing blobs in all 4 diagonal directions — floaty and cute
                        const dirs = [[-1,-1],[1,-1],[-1,1],[1,1]];
                        const extra = multiProjectileBonus > 0 ? [[-1,0],[1,0]] : [];
                        [...dirs, ...extra].forEach(([dx, dy]) => {
                            engine.projectiles.push({ x: bx, y: by, speed: 4, vx: dx * (3 + waveBonus * 0.3), vy: dy * (3 + waveBonus * 0.3), damage: 1, color: '#a78bfa', fromPlayer: false });
                        });

                    } else if (bossPattern === 'TRACKING_BASIC') {
                        // Simple aimed shot — beginner tracking
                        const count = 1 + multiProjectileBonus;
                        for (let i = 0; i < count; i++) {
                            const spread = (i - (count - 1) / 2) * 0.3;
                            engine.projectiles.push({ x: bx, y: by, speed: 6, vx: Math.cos(angleToPlayer + spread) * 6, vy: Math.sin(angleToPlayer + spread) * 6, damage: 1, color: '#fb923c', fromPlayer: false });
                        }

                    } else if (bossPattern === 'FRONTAL_BEAM') {
                        // Dragon Cochon style: pre-telegraphed vertical beam
                        engine.shakeTime = 300;
                        const beamCount = 1 + multiProjectileBonus;
                        for (let i = 0; i < beamCount; i++) {
                            const offsetX = (i - (beamCount - 1) / 2) * 80;
                            engine.projectiles.push({ x: bx + offsetX, y: by, speed: 10 + waveBonus, vx: 0, vy: 10 + waveBonus, damage: 2, color: '#e11d48', fromPlayer: false });
                        }

                    } else if (bossPattern === 'TRACKING_SPREAD') {
                        // Minotoror style: wide aimed spread
                        const spread = 3 + Math.floor(wave / 8) + multiProjectileBonus;
                        for (let i = -Math.floor(spread / 2); i <= Math.floor(spread / 2); i++) {
                            const angle = angleToPlayer + (i * 0.22);
                            engine.projectiles.push({ x: bx, y: by, speed: 6, vx: Math.cos(angle) * 7, vy: Math.sin(angle) * 7, damage: 1, color: '#f43f5e', fromPlayer: false });
                        }

                    } else if (bossPattern === 'SPIRAL_STORM') {
                        // Hell Mina style: fast dense spiral
                        const shots = 12 + waveBonus * 2 + multiProjectileBonus * 3;
                        const speed = 4.5 + waveBonus * 0.3;
                        for (let i = 0; i < shots; i++) {
                            const angle = (i / shots) * Math.PI * 2 + (now / 350);
                            engine.projectiles.push({ x: bx, y: by, speed, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: 1, color: '#ec4899', fromPlayer: false });
                        }

                    } else if (bossPattern === 'CHAOS_RAIN') {
                        // Wa Wabbit style: falling rain from top of screen
                        const count = 6 + waveBonus + multiProjectileBonus * 2;
                        for (let i = 0; i < count; i++) {
                            const pSpeed = (6 + Math.random() * 3) * (engine.player.perks.slowProjectiles ? 0.7 : 1);
                        engine.projectiles.push({ x: Math.random() * canvas.width, y: -60, speed: pSpeed, vx: (Math.random() - 0.5) * 3, vy: pSpeed, damage: 1, color: '#be185d', fromPlayer: false });
                        }

                    } else if (bossPattern === 'PHASE_BURST') {
                        // Moon style: alternating burst phases (aimed then spiral)
                        const phase = Math.floor(now / 1500) % 2;
                        if (phase === 0) {
                            // Aimed burst
                            for (let i = -2; i <= 2; i++) {
                                engine.projectiles.push({ x: bx, y: by, speed: 8, vx: Math.cos(angleToPlayer + i * 0.25) * 8, vy: Math.sin(angleToPlayer + i * 0.25) * 8, damage: 1, color: '#7c3aed', fromPlayer: false });
                            }
                        } else {
                            // Radial burst
                            const shots = 8 + multiProjectileBonus * 2;
                            for (let i = 0; i < shots; i++) {
                                const angle = (i / shots) * Math.PI * 2;
                                engine.projectiles.push({ x: bx, y: by, speed: 6, vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6, damage: 1, color: '#8b5cf6', fromPlayer: false });
                            }
                        }

                    } else if (bossPattern === 'CHARGE_BEAM') {
                        // Bworker style: telegraphed super beam + side shots in multi
                        engine.shakeTime = 600;
                        engine.flashTime = 200;
                        engine.projectiles.push({ x: bx, y: by, speed: 16, vx: Math.cos(angleToPlayer) * 16, vy: Math.sin(angleToPlayer) * 16, damage: 3, color: '#dc2626', fromPlayer: false });
                        // Multi: extra side beams
                        for (let i = 0; i < multiProjectileBonus; i++) {
                            const sideAngle = angleToPlayer + (i % 2 === 0 ? 0.4 : -0.4) * Math.ceil(i / 2);
                            engine.projectiles.push({ x: bx, y: by, speed: 12, vx: Math.cos(sideAngle) * 12, vy: Math.sin(sideAngle) * 12, damage: 2, color: '#ef4444', fromPlayer: false });
                        }

                    } else if (bossPattern === 'DOUBLE_SPIRAL') {
                        // Tynril style: two counter-rotating spirals
                        const shots = 8 + waveBonus + multiProjectileBonus * 2;
                        const speed = 5 + waveBonus * 0.4;
                        for (let i = 0; i < shots; i++) {
                            const a1 = (i / shots) * Math.PI * 2 + (now / 300);
                            const a2 = (i / shots) * Math.PI * 2 - (now / 300);
                            engine.projectiles.push({ x: bx, y: by, speed, vx: Math.cos(a1) * speed, vy: Math.sin(a1) * speed, damage: 1, color: '#06b6d4', fromPlayer: false });
                            engine.projectiles.push({ x: bx, y: by, speed, vx: Math.cos(a2) * speed, vy: Math.sin(a2) * speed, damage: 1, color: '#0891b2', fromPlayer: false });
                        }

                    } else { // HELLFIRE — Brutal tier
                        // Père Fwetar / Tynril Perfide: all at once
                        engine.shakeTime = 800;
                        engine.flashTime = 300;
                        const shots = 16 + waveBonus * 2 + multiProjectileBonus * 4;
                        for (let i = 0; i < shots; i++) {
                            const angle = (i / shots) * Math.PI * 2 + (now / 200);
                            const speed = 5 + Math.random() * 4;
                            engine.projectiles.push({ x: bx, y: by, speed, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: 2, color: i % 2 === 0 ? '#f97316' : '#dc2626', fromPlayer: false });
                        }
                        // Extra aimed burst in multi
                        if (multiProjectileBonus > 0) {
                            for (let i = -multiProjectileBonus; i <= multiProjectileBonus; i++) {
                                engine.projectiles.push({ x: bx, y: by, speed: 14, vx: Math.cos(angleToPlayer + i * 0.2) * 14, vy: Math.sin(angleToPlayer + i * 0.2) * 14, damage: 3, color: '#fbbf24', fromPlayer: false });
                            }
                        }
                    }

                } else if (Math.random() > Math.max(0.70, 0.99 - (difficulty * 0.002))) {
                    // Standard mob shooting
                    const isAimed = Math.random() > 0.6 && difficulty > 3;
                    let vx = 0;
                    if (isAimed) {
                        const dx = engine.player.x + engine.player.width/2 - (e.x + e.width/2);
                        const dy = engine.player.y - e.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        vx = (dx / dist) * (7 + difficulty * 0.2);
                    }

                    const speed = 5 + (engine.wave * 0.3);
                    engine.projectiles.push({
                        x: e.x + e.width / 2, y: e.y + e.height, 
                        speed: speed,
                        vx: vx, vy: isAimed ? speed + 2 : speed,
                        damage: 1, color: isAimed ? '#ef4444' : '#f43f5e', fromPlayer: false
                    });
                    
                    if (difficulty > 5 && Math.random() > 0.8) {
                        engine.projectiles.push({ x: e.x + e.width / 2 - 15, y: e.y + e.height, speed: speed, vx: -3, vy: speed - 1, damage: 1, color: '#f59e0b', fromPlayer: false });
                        engine.projectiles.push({ x: e.x + e.width / 2 + 15, y: e.y + e.height, speed: speed, vx: 3, vy: speed - 1, damage: 1, color: '#f59e0b', fromPlayer: false });
                    }
                }
                } // Close the random 0.4 bracket!
                e.lastShot = now + (Math.random() * fireRate * 0.5);
            }

            // Hit collision with player: MICRO-HITBOX (14px radius, focused on soul core)
            const px = engine.player.x + engine.player.width / 2;
            const py = engine.player.y + engine.player.height / 2;
            const ex = e.x + e.width / 2;
            const ey = e.y + e.height / 2;
            const dist = Math.sqrt(Math.pow(px - ex, 2) + Math.pow(py - ey, 2));
            
            // --- FIX COLLISION THRESHOLD ---
            // Player is ~70x70, Mob is ~46x46. 
            // Previous 14px radius was way too small (ghosting).
            // New threshold: approx 70% of combined radii for a tight but fair feel.
            const collisionThreshold = (engine.player.width * 0.4) + (e.width * 0.4); 

            if (dist < collisionThreshold) {
                if (!engine.player.isShielded) {
                    const rawDmg = 50;
                    if (engine.player.armor > 0) {
                        engine.player.armor -= rawDmg;
                        if (engine.player.armor < 0) {
                            engine.player.health += engine.player.armor;
                            engine.player.armor = 0;
                        }
                    } else {
                        engine.player.health -= rawDmg;
                    }

                    spawnExplosion(px, py, '#ff0000', 15);
                    engine.flashTime = 400;
                    engine.shakeTime = 300;
                    toast.error("HIT ! COLLISION CRITIQUE", { style: { background: '#7f1d1d', color: 'white' } });

                    if (engine.player.health <= 0) {
                        engine.lives--;
                        engine.player.health = 100;
                        engine.player.isShielded = true;
                        engine.player.shieldTime = 3000;
                        spawnExplosion(px, py, '#ff0000', 40);
                        
                        if (engine.lives <= 0) {
                            if (isSolo) {
                                setGameState('GAMEOVER');
                            } else {
                                engine.player.isDead = true;
                                engine.combatLog.unshift({
                                    id: Math.random(),
                                    text: `L'ÂME DE ${session?.user?.name || 'Guerrier'} ERRANCE DANS LE VIDE !`,
                                    life: 2.5,
                                    color: '#6366f1'
                                });
                                toast.error("VOTRE ÂME A QUITTÉ VOTRE CORPS... MODE SPECTATEUR ACTIVÉ !");
                            }
                        }
                        toast.error("-1 VIE ! SYSTÈME ENDOMMAGÉ", { style: { background: '#991b1b', color: 'white' } });
                    }
                }
                if (e.type !== 'boss') {
                    engine.enemies.splice(eIdx, 1);
                    spawnExplosion(ex, ey, '#ffff00');
                } else {
                    engine.shakeTime = 500; // MASSIVE SHAKE ON BOSS KILL
                }
            }

            // Off screen logic
            if (e.y > canvas.height + 50) {
                if (isBoss) {
                    e.y = -200; // Boss Loops back
                } else {
                    e.y = -200; // Mobs Loop back until KILLED
                    (e as any).inFormation = false;
                    if (e.baseX !== undefined) {
                        e.trajectory = (['linear', 'sine', 'zigzag'] as const)[Math.floor(Math.random() * 3)];
                        e.x = Math.random() * canvas.width;
                    } else {
                        e.x = Math.random() * (canvas.width - e.width);
                    }
                }
            }
        }

        // Bullet collisions
        // Bullet collisions - Reversed loop to allow safe element splicing
        // --- BOT AI LOGIC (Host Only) ---
        if (isHost && room.withBot && gameState === 'PLAYING') {
            if (!engine.bot) {
                engine.bot = { 
                    x: engine.player.x + 100, 
                    y: engine.player.y, 
                    lastShot: 0,
                    rotation: 0
                };
            }
            const bot = engine.bot;
            
            // Follow player with a "companion" behavior: stay to the right or left with some springiness
            const targetX = engine.player.x + (Math.sin(now / 1500) * 100 + 120);
            const targetY = engine.player.y + Math.cos(now / 1000) * 30;
            
            bot.x += (targetX - bot.x) * 0.08;
            bot.y += (targetY - bot.y) * 0.08;

            // Advanced Target Acquisition
            const nearestEnemy = engine.enemies.length > 0 ? engine.enemies.reduce((prev, curr) => {
                const distPrev = Math.hypot(prev.x - bot.x, prev.y - bot.y);
                const distCurr = Math.hypot(curr.x - bot.x, curr.y - bot.y);
                return distCurr < distPrev ? curr : prev;
            }) : null;

            if (nearestEnemy) {
                const targetAngle = Math.atan2(nearestEnemy.y - (bot.y + 35), nearestEnemy.x - (bot.x + 35));
                bot.rotation += (targetAngle + Math.PI/2 - bot.rotation) * 0.1;
                
                if (now - bot.lastShot > 600) {
                    playSound('shoot');
                    engine.projectiles.push({
                        x: bot.x + 35, y: bot.y + 35,
                        speed: 15, 
                        vx: Math.cos(targetAngle) * 16, 
                        vy: Math.sin(targetAngle) * 16,
                        damage: 8 * difficulty,
                        color: '#6366f1', fromPlayer: true
                    });
                    bot.lastShot = now;
                }
            } else {
                bot.rotation += (0 - bot.rotation) * 0.05;
            }
        }

        for (let pIdx = engine.projectiles.length - 1; pIdx >= 0; pIdx--) {
            const p = engine.projectiles[pIdx];
            p.x += (p.vx || 0);
            p.y += (p.vy || (p.fromPlayer ? -p.speed : p.speed));

            // CAP PROJECTILES: Prevent memory leak and lag from infinite bullets
            if (engine.projectiles.length > 150) {
                engine.projectiles.splice(0, engine.projectiles.length - 150);
                break;
            }
            
            let removeProjectile = false;

            if (p.fromPlayer) {
                for (let eIdx = engine.enemies.length - 1; eIdx >= 0; eIdx--) {
                    const e = engine.enemies[eIdx];
                    if (
                        p.x < e.x + e.width &&
                        p.x + 8 > e.x &&
                        p.y < e.y + e.height &&
                        p.y + 16 > e.y
                    ) {
                        // Critical Hit Calculation (15% chance by default)
                        const isCrit = Math.random() < 0.15;
                        const finalDamage = isCrit ? p.damage * 2 : p.damage;
                        e.health -= finalDamage;
                        
                        if (isCrit) {
                            (e as any).lastHitWasCrit = true;
                            // Add a visual indicator for critical hit on the entity
                            engine.damageToasts.push({
                                id: Math.random(),
                                text: "CRITIQUE!",
                                x: e.x + e.width / 2, y: e.y - 10,
                                life: 1, color: '#fbbf24'
                            });
                        } else {
                            (e as any).lastHitWasCrit = false;
                        }

                        if (e.type.includes('boss')) {
                            engine.bossHitFlash = 5;
                            // Log boss hits specifically in the feed
                            if (Math.random() > 0.8) {
                                engine.combatLog.unshift({
                                    id: Math.random(),
                                    text: `BOSS DMG: -${Math.round(finalDamage)} HP`,
                                    life: 0.8,
                                    color: isCrit ? '#fbbf24' : '#f87171'
                                });
                            }
                        }
                        if (p.color !== 'laser_purple' && !engine.player.perks.piercingShots) {
                            removeProjectile = true;
                        }
                        if (e.health <= 0) {
                            handleEnemyDeath(e, eIdx);
                        }
                        if (removeProjectile) break; // Break out of enemies loop if projectile is absorbed
                    }
                }
            } else {
                const px = engine.player.x + engine.player.width / 2;
                const py = engine.player.y + engine.player.height / 2;
                const dist = Math.sqrt(Math.pow(px - (p.x), 2) + Math.pow(py - (p.y), 2));

                if (dist < 28) {
                    if (!engine.player.isShielded) {
                        if (engine.player.perks.dodgeChance > 0 && Math.random() < engine.player.perks.dodgeChance) {
                            engine.damageToasts.push({
                                id: Math.random(),
                                text: "ESQUIVE!",
                                x: px, y: py - 20,
                                life: 1, color: '#34d399'
                            });
                            removeProjectile = true;
                            continue; // Skip damage
                        }

                        const rawDmg = p.damage * 10;
                        if (engine.player.armor > 0) {
                            engine.player.armor -= rawDmg;
                            if (engine.player.armor < 0) {
                                engine.player.health += engine.player.armor;
                                engine.player.armor = 0;
                            }
                        } else {
                            engine.player.health -= rawDmg;
                        }

                        spawnExplosion(px, py, '#ff0000', 10);
                        
                        if (engine.player.health <= 0) {
                            engine.lives--;
                            engine.player.health = 100;
                            engine.player.isShielded = true;
                            engine.player.shieldTime = 3000;
                            
                            if (engine.lives <= 0) {
                                if (isSolo) {
                                    setGameState('GAMEOVER');
                                } else {
                                    engine.player.isDead = true;
                                    engine.combatLog.unshift({
                                        id: Math.random(),
                                        text: `L'ÂME DE ${session?.user?.name || 'Guerrier'} S'EST VOLATILISÉE !`,
                                        life: 2.5,
                                        color: '#6366f1'
                                    });
                                }
                            }
                            engine.flashTime = 400; // RED FLASH
                            spawnExplosion(px, py, '#ff0000', 30);
                            toast.error("-1 VIE ! T'ES TOUCHÉ", { style: { background: '#7f1d1d', color: 'white' } });
                        }
                    }
                    removeProjectile = true;
                }
            }

            if (removeProjectile) {
                engine.projectiles.splice(pIdx, 1);
            }
        }

        // --- OBSTACLES LOGIC (Host Only Spawning) ---
        if (gameState === 'PLAYING' && isHost && Math.random() < (0.004 + engine.wave * 0.001)) {
            const isMine = Math.random() < 0.3;
            const radius = 20 + Math.random() * 40;
            engine.obstacles.push({
                id: Math.random(),
                x: Math.random() * 1920,
                y: -100,
                vx: (Math.random() - 0.5) * 2,
                vy: (1 + Math.random() * 3),
                radius,
                hp: isMine ? 15 : (radius * 0.4), // Asteroids shattered easily as obstacles
                maxHp: isMine ? 15 : (radius * 0.4),
                type: isMine ? 'mine' : 'asteroid',
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.05
            });
        }

        const triggerMineExplosion = (mineX: number, mineY: number) => {
            spawnExplosion(mineX, mineY, '#ef4444', 60);
            playSound('explosion');
            engine.shakeTime = 30;
            engine.flashTime = 200;
            
            const blastRadius = 350; // Massive shockwave
            
            // Damage player if caught in collateral
            if (!engine.player.isDead && !engine.player.isShielded) {
                const dx = (engine.player.x + engine.player.width/2) - mineX;
                const dy = (engine.player.y + engine.player.height/2) - mineY;
                if (Math.sqrt(dx*dx + dy*dy) < blastRadius) {
                    engine.player.health -= 40; // Heavy collateral
                    toast.error("SOUFFLE EXPLOSIF ! -40 HP", { style: { background: '#7f1d1d', color: 'white' } });
                }
            }
            
            // Wipe out enemies in radius
            for (let eIdx = engine.enemies.length - 1; eIdx >= 0; eIdx--) {
                const e = engine.enemies[eIdx];
                const dx = (e.x + e.width/2) - mineX;
                const dy = (e.y + e.height/2) - mineY;
                if (Math.sqrt(dx*dx + dy*dy) < blastRadius) {
                    e.health -= 5000; // Massive damage to enemies
                    if (e.health <= 0) {
                        (e as any).lastHitWasCrit = true; // Make it look cool in the feed
                        handleEnemyDeath(e, eIdx);
                    }
                }
            }
        };

        for (let i = engine.obstacles.length - 1; i >= 0; i--) {
            const obs = engine.obstacles[i];
            obs.x += obs.vx;
            obs.y += obs.vy;
            obs.rotation += obs.spin;
            
            if (obs.type === 'mine') {
                // Homing Logic: Accelerate towards player if close
                const dxp = (engine.player.x + 32) - obs.x;
                const dyp = (engine.player.y + 32) - obs.y;
                const distP = Math.sqrt(dxp*dxp + dyp*dyp);
                
                if (distP < 300 && !engine.player.isDead) {
                    obs.vx += (dxp / distP) * 0.15;
                    obs.vy += (dyp / distP) * 0.15;
                    // Cap speed
                    const speed = Math.sqrt(obs.vx*obs.vx + obs.vy*obs.vy);
                    if (speed > 5) {
                        obs.vx = (obs.vx / speed) * 5;
                        obs.vy = (obs.vy / speed) * 5;
                    }
                } else {
                    obs.vx *= 0.95; 
                    obs.vy = Math.max(0.8, obs.vy); // Allow drifting down (Gravity), no full freeze
                }
            }

            // Player Collision
            if (!engine.player.isDead) {
                const dx = (engine.player.x + 32) - obs.x;
                const dy = (engine.player.y + 32) - obs.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < obs.radius + 20) {
                    if (obs.type === 'mine') {
                        triggerMineExplosion(obs.x, obs.y);
                    } else {
                        if (!engine.player.isShielded) {
                            engine.player.health -= 15;
                            engine.shakeTime = 15;
                            playSound('explosion');
                        }
                        spawnExplosion(obs.x, obs.y, '#71717a', 20);
                    }
                    engine.obstacles.splice(i, 1);
                    continue;
                }
            }

            // Projectile Collision
            for (let j = engine.projectiles.length - 1; j >= 0; j--) {
                const p = engine.projectiles[j];
                const dx = p.x - obs.x;
                const dy = p.y - obs.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < obs.radius) {
                    obs.hp -= p.damage;
                    engine.projectiles.splice(j, 1);
                    if (obs.hp <= 0) {
                        if (obs.type === 'mine') {
                            triggerMineExplosion(obs.x, obs.y);
                            engine.score += 50;
                        } else {
                            spawnExplosion(obs.x, obs.y, '#71717a', 15);
                            playSound('explosion');
                            engine.shakeTime = 8;
                            engine.score += 25;
                        }
                        engine.obstacles.splice(i, 1);
                        break;
                    }
                }
            }

            if (obs.y > 1180) engine.obstacles.splice(i, 1);
        }

        // Particles
        // Particles Capping
        if (engine.particles.length > 300) {
            engine.particles.splice(0, engine.particles.length - 300);
        }
        engine.particles = engine.particles.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            return p.life > 0;
        });

        // Powerups movement & pickup
        engine.powerups = engine.powerups.filter((pu) => {
            pu.y += pu.speed;
            if (
                pu.x < engine.player.x + engine.player.width &&
                pu.x + 20 > engine.player.x &&
                pu.y < engine.player.y + engine.player.height &&
                pu.y + 20 > engine.player.y
            ) {
                if (pu.type === 'shield') {
                    engine.player.isShielded = true;
                    engine.player.shieldTime = 8000;
                    playSound('powerup');
                    toast.success("BOUCLIER ACTIVÉ");
                } else if (pu.type === 'cawotte') {
                    engine.lives = Math.min(engine.lives + 1, 5);
                    playSound('1up');
                    toast.success("VIE SUPPLÉMENTAIRE");
                } else {
                    // Weapon Logic: STACKING system
                    setWeapon(prev => {
                        const hasAlready = prev.activeTypes.includes(pu.type as any);
                        const nextTypes = hasAlready ? prev.activeTypes : [...prev.activeTypes, pu.type as any];
                        const nextLevel = Math.min(prev.level + 1, 8);
                        const nextCount = nextTypes.includes('kamas' as any) ? nextLevel + 2 : nextLevel;
                        
                        const next = { 
                            activeTypes: nextTypes, 
                            level: nextLevel,
                            projectileCount: nextCount,
                            piercingShots: prev.activeTypes.includes('piercing' as any) // Keep perk state
                        };
                        
                        engine.player.weapon = nextTypes[nextTypes.length - 1]; // Visual focus on last
                        engine.player.weaponTime = 25000; // INCREASED DURATION: 25s for tactical satisfaction
                        engine.weaponTime = 25000;
                        
                        toast.success(`SYSTEM STACK: ${pu.type.toUpperCase()} ACTIVÉ`);
                        return next;
                    });
                    playSound('powerup');
                }
                return false;
            }
            if (pu.y > canvas.height) return false;
            return true;
        });

        // Cleanup: remove all enemies marked dead this frame (safe, no mid-loop splice)
        if (engine.enemies.some(e => e.dead)) {
            engine.enemies = engine.enemies.filter(e => !e.dead);
        }

        // --- Wave End Logic ---
        if (engine.enemies.length === 0 && !engine.wavePending) {
            engine.wavePending = true;
            if (engine.wave % 5 === 0) {
                // Ensure boss explosion plays before fading to shop
                setTimeout(() => {
                    engine.shopEndTime = Date.now() + 60000;
                    setGameState('SHOP');
                    engine.wavePending = false;
                }, 3500);
            } else {
                engine.wave++;
                spawnWave(engine.wave);
            }
        }

        // --- Shop Timer Enforcement ---
        // Also removed gameState check to avoid TS error, moved to top level loop control
    };

    const drawPlayerFallback = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(0, -height / 2); // Tip
        ctx.lineTo(-width / 2, height / 2); // Bottom left
        ctx.lineTo(width / 2, height / 2); // Bottom right
        ctx.closePath();
        ctx.fill();
        
        // Cockpit
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, -height / 6, 8, 0, Math.PI * 2);
        ctx.fill();
    };

    const draw = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const engine = engineRef.current;

        // --- HARD RESET CONTEXT ---
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
        ctx.imageSmoothingEnabled = false;

        const W = canvas.width || 1920;
        const H = canvas.height || 1080;
        
        // --- Dynamic Biome Generator ---
        const biomeIndex = Math.floor(wave / 10) % 3;
        const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
        
        if (biomeIndex === 0) { // Incarnam Sky
            skyGrd.addColorStop(0, '#1e3a8a');
            skyGrd.addColorStop(1, '#60a5fa');
        } else if (biomeIndex === 1) { // Evil Forest
            skyGrd.addColorStop(0, '#022c22');
            skyGrd.addColorStop(1, '#059669');
        } else { // The Void
            skyGrd.addColorStop(0, '#000000');
            skyGrd.addColorStop(1, '#581c87');
        }
        ctx.fillStyle = skyGrd;
        ctx.fillRect(0, 0, W, H);

        // Diagnostic Overlay disabled for production
        
        // Failsafe: Draw a bright marker to prove canvas is alive
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(W-20, 0, 20, 20);

        // Biome specific background effects
        if (biomeIndex === 2) {
            // "Void Sparks"
            ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
            for(let i=0; i<20; i++) {
                ctx.beginPath();
                const sx = (Math.sin(Date.now()/1000 + i) * 400) + 400;
                const sy = (Math.cos(Date.now()/2000 + i) * 300) + 300;
                ctx.arc(sx, sy, 2, 0, Math.PI*2);
                ctx.fill();
            }
        }
        
        // Draw fluffy passing clouds
        ctx.fillStyle = 'white';
        engine.clouds.forEach(cloud => {
            cloud.y += cloud.speed;
            if (cloud.y - cloud.size > canvas.height) {
                cloud.y = -cloud.size;
                cloud.x = Math.random() * canvas.width;
            }
            
            ctx.globalAlpha = cloud.opacity;
            ctx.beginPath();
            // Create a fluffy cloud drawing using overlapping arcs
            ctx.arc(cloud.x, cloud.y, cloud.size * 0.4, 0, Math.PI*2);
            ctx.arc(cloud.x + cloud.size * 0.3, cloud.y - cloud.size * 0.1, cloud.size * 0.3, 0, Math.PI*2);
            ctx.arc(cloud.x - cloud.size * 0.3, cloud.y - cloud.size * 0.1, cloud.size * 0.35, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
        
        ctx.save();
        try {
            // Camera Shake handling
            if (engine.shakeTime > 0) {
                const sx = (Math.random() - 0.5) * (engine.shakeTime / 20);
                const sy = (Math.random() - 0.5) * (engine.shakeTime / 20);
                ctx.translate(sx, sy);
                engine.shakeTime -= 16;
            }

            // Parallax Layer 2: Biome-specific silhouettes
            engine.clouds.forEach((cloud, i) => {
                if (i % 2 === 0) return;
                ctx.globalAlpha = cloud.opacity * 2;
                ctx.fillStyle = biomeIndex === 1 ? '#064e3b' : (biomeIndex === 2 ? '#450a0a' : 'rgba(255,255,255,0.2)');
                
                const px = (cloud.x + cloud.y * 0.2) % canvas.width;
                if (biomeIndex === 1) { // Trees for Astrub Forest
                    ctx.beginPath();
                    ctx.moveTo(px, cloud.y);
                    ctx.lineTo(px - 20, cloud.y + 60);
                    ctx.lineTo(px + 20, cloud.y + 60);
                    ctx.closePath();
                    ctx.fill();
                } else if (biomeIndex === 2) { // Spikes for Brakmar
                    ctx.beginPath();
                    ctx.moveTo(px, cloud.y + 60);
                    ctx.lineTo(px + 10, cloud.y);
                    ctx.lineTo(px + 20, cloud.y + 60);
                    ctx.fill();
                } else { // Generic fluffy clouds
                    ctx.beginPath();
                    ctx.arc(px, cloud.y, cloud.size * 0.2, 0, Math.PI*2);
                    ctx.fill();
                }
            });
            ctx.globalAlpha = 1.0;

            // Draw Enemies
            engine.enemies.forEach(e => {
                const imgKey = e.type;
                const img = engine.images[imgKey] || engine.images.boss_placeholder || engine.images.player;
                ctx.save();
                try {
                    // Smooth hover for all mobs
                    const hover = Math.sin(Date.now() / 250 + e.phase) * 6;
                    
                    if (img) {
                        try {
                            ctx.drawImage(img, e.x, e.y + hover, e.width, e.height);
                        } catch (err) {
                            // Secondary fallback inside try-catch
                            ctx.fillStyle = (e as any).isBoss ? '#f43f5e' : '#facc15';
                            ctx.beginPath();
                            ctx.arc(e.x + e.width / 2, e.y + e.height / 2 + hover, e.width / 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    } else {
                        // PRIMARY geometric fallback for 404 assets
                        ctx.fillStyle = imgKey.includes('boss') ? '#f43f5e' : '#facc15';
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = ctx.fillStyle;
                        ctx.beginPath();
                        ctx.arc(e.x + e.width / 2, e.y + e.height / 2 + hover, e.width / 3, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Small "glitch" effect so user knows it's a fallback
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    
                    // --- DRAW MOB HEALTH BAR (HUD of War) ---
                    if (!imgKey.includes('boss') && e.health < e.maxHealth) {
                        const barWidth = 34;
                        const barHeight = 4;
                        const bx = e.x + (e.width - barWidth) / 2;
                        const by = e.y - 12 + hover;

                        // Shadow
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(bx, by, barWidth, barHeight);
                        
                        // Fill
                        const healthPct = Math.max(0, e.health / e.maxHealth);
                        ctx.fillStyle = healthPct > 0.4 ? '#22c55e' : (healthPct > 0.2 ? '#eab308' : '#ef4444');
                        ctx.fillRect(bx, by, barWidth * healthPct, barHeight);
                        
                        // Border
                        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(bx, by, barWidth, barHeight);
                    }

                    // Health bar for Bosses (already has top bar, but let's keep the mini-one too for focus)
                    if (imgKey.includes('boss')) {
                        const barWidth = e.width * 0.8;
                        const bx = e.x + e.width / 2 - barWidth / 2;
                        const by = e.y - 15 + hover;
                        
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(bx, by, barWidth, 6);
                        const hpGrd = ctx.createLinearGradient(bx, 0, bx + barWidth, 0);
                        hpGrd.addColorStop(0, '#f87171');
                        hpGrd.addColorStop(1, '#ef4444');
                        ctx.fillStyle = hpGrd;
                        ctx.fillRect(bx, by, barWidth * (e.health / e.maxHealth), 6);
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(bx, by, barWidth, 6);
                    }
                } finally {
                    ctx.restore();
                }
            });

            // Reticle (Tactical Class-Specific Overlay)
            if (gameState === 'PLAYING') {
                const tx = engine.mouseX;
                const ty = engine.mouseY;
                
                ctx.save();
                ctx.translate(tx, ty);
                
                // Outer HUD Ring - MORE VISIBLE
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Dynamic spinning dashed outer ring
                ctx.beginPath();
                ctx.setLineDash([10, 10]);
                ctx.arc(0, 0, 36, Date.now()/500, Math.PI*2 + Date.now()/500);
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.setLineDash([]); // Reset dash

                // Class-specific Feedback with Shadow
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#000000';
                
                if (playerClass === 'cra') {
                    // Sniper Crosshair
                    ctx.beginPath();
                    ctx.moveTo(-35, 0); ctx.lineTo(35, 0);
                    ctx.moveTo(0, -35); ctx.lineTo(0, 35);
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#f97316';
                    ctx.stroke();
                } else if (playerClass === 'iop') {
                    ctx.fillText('⚔️', 0, 0);
                } else if (playerClass === 'enutrof') {
                    ctx.fillText('💰', 0, 0);
                } else if (playerClass === 'xelor') {
                    ctx.fillText('⏳', 0, 0);
                }
                
                // Core Aim Dot (Glowing Red/White)
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ef4444';
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 0;
                ctx.fill();
                
                ctx.restore();
            }
                
                // --- DRAW MUZZLE FLASH ---
                if (engine.player.muzzleFlash > 0) {
                    const px = engine.player.x + engine.player.width/2;
                    const py = engine.player.y + engine.player.height/2;
                    const flashSize = 30 + Math.random() * 20;
                    ctx.save();
                    ctx.translate(px + Math.cos(engine.player.rotation - Math.PI/2) * 30, py + Math.sin(engine.player.rotation - Math.PI/2) * 30);
                    const grdFlash = ctx.createRadialGradient(0, 0, 5, 0, 0, flashSize);
                    grdFlash.addColorStop(0, 'white');
                    grdFlash.addColorStop(0.3, playerClass === 'cra' ? '#f97316' : '#60a5fa');
                    grdFlash.addColorStop(1, 'transparent');
                    ctx.fillStyle = grdFlash;
                    ctx.beginPath();
                    ctx.arc(0, 0, flashSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    engine.player.muzzleFlash--;
                }
        } finally {
            ctx.restore();
        }

        // Draw Player: Silhouette Detourée or Fallback Shape
        const px = engine.player.x + engine.player.width/2;
        const py = engine.player.y + engine.player.height/2 + engine.player.recoil;
        const breath = Math.sin(Date.now() / 400) * (3 + engine.player.recoil / 2);

        if (!isSpectator && !engine.player.isDead) {
            ctx.save();
            try {
                // Draw Dynamic Glow Backdrop
                const grd = ctx.createRadialGradient(px, py + breath, 5, px, py + breath, 60);
                const auraColor = engine.player.isShielded ? 'rgba(56, 189, 248, 0.5)' : 'rgba(129, 140, 248, 0.3)';
                grd.addColorStop(0, auraColor);
                grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grd;
                ctx.fillRect(px - 100, py + breath - 100, 200, 200);

                // Apply Animations Transform to Silhouette
                ctx.translate(px, py + breath);
                const totalRotation = engine.player.rotation + engine.player.spin;
                ctx.rotate(totalRotation);
                ctx.scale(1 + breath/150, 1 + breath/150);
                
                // Draw Silhouette with High-Fidelity Glow
                ctx.shadowBlur = engine.player.isShielded ? 25 : 15;
                ctx.shadowColor = engine.player.isShielded ? '#38bdf8' : 'rgba(255,255,255,0.4)';
                ctx.setLineDash([]);
                if (engine.images.player && engine.images.player.width > 1) {
                    try {
                        ctx.drawImage(engine.images.player, -engine.player.width/2, -engine.player.height/2, engine.player.width, engine.player.height);
                    } catch (e) {
                        drawPlayerFallback(ctx, engine.player.width, engine.player.height);
                    }
                } else {
                    drawPlayerFallback(ctx, engine.player.width, engine.player.height);
                }
                ctx.shadowBlur = 0;

                // DRAW MICRO-HITBOX (CORE)
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.shadowBlur = 20; ctx.shadowColor = '#60a5fa';
                ctx.fill();
                ctx.shadowBlur = 0;

            } finally {
                ctx.restore();
            }
            
            // --- HUGE HEALTH BAR BELOW AVATAR (Not affected by rotation) ---
            if (!isSpectator) {
                const barWidth = 80;
                const barHeight = 8;
                const hpPct = Math.max(0, engine.player.health / 100);
                const barX = px - barWidth/2;
                const barY = py + engine.player.height/2 + 15;
                
                // Dark Background with border
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 2;
                ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
                ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
                
                // Color Fill
                ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.25 ? '#eab308' : '#ef4444');
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.fillStyle;
                ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);
                ctx.shadowBlur = 0;
                
                // Big Lives Indicator
                ctx.fillStyle = '#ef4444';
                for(let l = 0; l < engine.lives; l++) {
                    ctx.beginPath();
                    // Draw big hearts or distinct bright red circles
                    ctx.arc(barX + l * 14 + 6, barY + 18, 5, 0, Math.PI * 2);
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#ef4444';
                    ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
        }
        
        // Draw Obstacles (Asteroids & Mines)
        engine.obstacles.forEach(obs => {
            ctx.save();
            ctx.translate(obs.x, obs.y);
            ctx.rotate(obs.rotation);

            if (obs.type === 'asteroid') {
                // --- PREMIUM PROCEDURAL ASTEROID ---
                // 1. Base Gradient for Spherical Depth
                const grad = ctx.createRadialGradient(-obs.radius/3, -obs.radius/3, obs.radius/10, 0, 0, obs.radius);
                grad.addColorStop(0, '#475569'); // Lighter slate
                grad.addColorStop(0.6, '#1e293b'); // Dark slate
                grad.addColorStop(1, '#0f172a'); // Very dark slate (edge shadow)
                
                ctx.beginPath();
                // Custom jagged shape
                const sides = 10;
                for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * Math.PI * 2;
                    // Use a seeded-ish pseudo-random based on ID for stable jaggedness
                    const seed = (Math.sin(obs.id * (i + 1)) * 0.5 + 0.5);
                    const r = obs.radius * (0.85 + seed * 0.3);
                    const tx = Math.cos(angle) * r;
                    const ty = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(tx, ty);
                    else ctx.lineTo(tx, ty);
                }
                ctx.closePath();
                
                // Shadow / Glow
                ctx.shadowBlur = 20;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.fillStyle = grad;
                ctx.fill();
                
                // 2. Highlights (Rim Lighting)
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 3. Detailed Craters
                const craterCount = 3;
                for(let j=0; j<craterCount; j++) {
                    ctx.save();
                    const cSeed = Math.sin(obs.id + j) * 0.5 + 0.5;
                    const cDist = obs.radius * 0.4 * cSeed;
                    const cAngle = (j / craterCount) * Math.PI * 2;
                    ctx.translate(Math.cos(cAngle) * cDist, Math.sin(cAngle) * cDist);
                    
                    const cSize = obs.radius * (0.15 + cSeed * 0.2);
                    
                    // Crater Deepness
                    ctx.beginPath();
                    ctx.arc(0, 0, cSize, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
                    ctx.fill();
                    
                    // Crater Rim
                    ctx.beginPath();
                    ctx.arc(0, 0, cSize, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.stroke();
                    ctx.restore();
                }

            } else {
                // --- HIGH-TECH ROBOTIC MINE ---
                const now = Date.now();
                const blinkSpeed = 150;
                const blink = Math.sin(now / blinkSpeed) > 0;
                const pulse = (Math.sin(now / 100) + 1) / 2;
                
                // 1. Rotating Spikes (Mechanical)
                ctx.save();
                ctx.rotate(now / 1000); // Constant slow spin
                ctx.fillStyle = '#3f3f46';
                for (let i = 0; i < 8; i++) {
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(obs.radius * 0.8, -4);
                    ctx.lineTo(obs.radius * 1.2, 0);
                    ctx.lineTo(obs.radius * 0.8, 4);
                    ctx.fill();
                }
                ctx.restore();

                // 2. Mine Body
                const bodyGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, obs.radius);
                bodyGrad.addColorStop(0, '#27272a');
                bodyGrad.addColorStop(1, '#09090b');
                
                ctx.beginPath();
                ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = blink ? '#ef4444' : '#450a0a';
                ctx.lineWidth = 3;
                
                if (blink) {
                    ctx.shadowBlur = 25;
                    ctx.shadowColor = '#ef4444';
                }
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 3. Core Hazard Light
                ctx.beginPath();
                ctx.arc(0, 0, obs.radius * 0.4, 0, Math.PI * 2);
                const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, obs.radius * 0.4);
                coreGrad.addColorStop(0, blink ? '#fca5a5' : '#7f1d1d');
                coreGrad.addColorStop(1, blink ? '#ef4444' : '#450a0a');
                ctx.fillStyle = coreGrad;
                ctx.fill();

                // 4. Tech Detailing (Circles/Lines)
                ctx.beginPath();
                ctx.arc(0, 0, obs.radius * 0.7, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Homing Indicator (Small "target" reticle if close)
                const dx = engine.player.x + 35 - obs.x;
                const dy = engine.player.y + 35 - obs.y;
                if (Math.sqrt(dx*dx + dy*dy) < 400 && blink) {
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                    ctx.beginPath();
                    ctx.moveTo(-obs.radius, 0); ctx.lineTo(obs.radius, 0);
                    ctx.moveTo(0, -obs.radius); ctx.lineTo(0, obs.radius);
                    ctx.stroke();
                }
            }
            ctx.restore();
        });

        // Self Trail (Expert Detail)
        if (!isSpectator && Date.now() % 3 === 0) {
             engine.particles.push({
                x: px, y: py,
                vx: (Math.random() - 0.5) * 2,
                vy: 2 + Math.random() * 2,
                life: 1, maxLife: 0.3,
                color: 'rgba(99, 102, 241, 0.4)', size: 10
            });
        }
 
        // Movement Particles (Class Feedback)
        const isMoving = !isSpectator && (engine.keys['a'] || engine.keys['ArrowLeft'] || engine.keys['q'] || engine.keys['d'] || engine.keys['ArrowRight'] || engine.keys['w'] || engine.keys['s'] || engine.keys['z']);
        if (isMoving && Math.random() > 0.6) {
            const pColor = playerClass === 'cra' ? '#bae6fd' : (playerClass === 'iop' ? '#4ade80' : '#fde047');
            engine.particles.push({
                x: px + (Math.random() - 0.5) * 40,
                y: py + 30,
                vx: (Math.random() - 0.5) * 3,
                vy: 3 + Math.random() * 4,
                life: 1,
                maxLife: 0.4,
                color: pColor,
                size: 1 + Math.random() * 4
            });
        }

        // --- Draw HUD (Boss Health Bar) ---
        const activeBoss = engine.enemies.find(e => e.type.startsWith('boss_'));
        if (activeBoss) {
            const barW = 400;
            const barH = 12;
            const bx = (canvas.width - barW) / 2;
            const by = 80;
            
            // Draw Main Container
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 8);
            
            // HP Glow
            const pct = Math.max(0, activeBoss.health / activeBoss.maxHealth);
            const hpGrd = ctx.createLinearGradient(bx, 0, bx + barW, 0);
            
            if (engine.bossHitFlash > 0) {
                hpGrd.addColorStop(0, '#ffffff'); // Flash White on hit
                hpGrd.addColorStop(1, '#ef4444');
                engine.bossHitFlash--;
            } else {
                hpGrd.addColorStop(0, '#ef4444');
                hpGrd.addColorStop(1, '#991b1b');
            }
            
            ctx.fillStyle = hpGrd;
            ctx.fillRect(bx, by, barW * pct, barH);
            
            // Tick markers
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(bx + barW * 0.5, by, 2, barH);
            ctx.fillRect(bx + barW * 0.25, by, 1, barH);
            ctx.fillRect(bx + barW * 0.75, by, 1, barH);

            // Boss Name Label (Pro Alignment Fix)
            const bossIdRaw = activeBoss.type.split('_')[1];
            const bossInfo = gameManifest?.bosses?.find(b => b.id.toString() === bossIdRaw);
            const bossName = bossInfo?.name?.toUpperCase() || `ENTITÉ INCONNUE [ID:${bossIdRaw}]`;

            ctx.fillStyle = 'white';
            ctx.font = '900 16px "Inter", sans-serif'; // Bolder font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${bossName} — MENACE SUPRÊME`, canvas.width / 2, by - 20);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
            
            // Phase Text
            if (pct < 0.5) {
                ctx.fillStyle = '#f87171';
                ctx.font = 'black 10px italic "Inter", sans-serif';
                ctx.fillText("CRITICAL OVERLOAD: PHASE 2", bx, by + barH + 15);
            }
        }
        
        // --- DRAW COMBO GAUGE ---
        if (engine.combo > 0) {
            ctx.save();
            const comboDecay = Math.max(0, 2500 - (Date.now() - engine.comboTime)) / 2500;
            const barW = 150;
            const barH = 6;
            const bx = 30;
            const by = canvas.height - 30;
            
            // Text
            ctx.fillStyle = engine.combo > 25 ? '#f59e0b' : (engine.combo > 10 ? '#38bdf8' : 'white');
            ctx.font = 'black 16px italic "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`COMBO x${engine.combo}`, bx, by - 10);

            // Container
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx, by, barW, barH);
            
            // Fill
            const comboGrd = ctx.createLinearGradient(bx, 0, bx + barW, 0);
            comboGrd.addColorStop(0, '#38bdf8');
            comboGrd.addColorStop(1, '#818cf8');
            ctx.fillStyle = comboGrd;
            ctx.fillRect(bx, by, barW * comboDecay, barH);
            ctx.restore();
        }

        // Projectiles
        engine.projectiles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            
            if (p.fromPlayer) {
                const angle = Math.atan2(p.vy !== undefined ? p.vy : -1, p.vx !== undefined ? p.vx : 0);
                ctx.rotate(angle + Math.PI/2);
                
                    if (p.color === 'laser_purple') {
                        // Xelor: Rayon Obscur (Dark Ray)
                        ctx.save();
                        // Laser is already translated and rotated to point towards aim
                        // We just need to counter the +90deg graphic rotation to point forward
                        ctx.rotate(-Math.PI/2);
                        
                        const beamGrd = ctx.createLinearGradient(0, -10, 0, 10);
                        beamGrd.addColorStop(0, '#581c87');
                        beamGrd.addColorStop(0.5, '#a855f7');
                        beamGrd.addColorStop(1, '#581c87');
                        
                        ctx.fillStyle = beamGrd;
                        ctx.shadowBlur = 30; ctx.shadowColor = '#a855f7';
                        ctx.fillRect(0, -8, 1200, 16);
                        
                        // Core glow
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, -2, 1200, 4);
                        
                        // Void Surge particles (Simulated)
                        for(let i=0; i<10; i++) {
                            const sx = Math.random() * 800;
                            ctx.fillStyle = '#d8b4fe';
                            ctx.fillRect(sx, -4 + Math.random()*8, 15, 1);
                        }
                        ctx.shadowBlur = 0; // Immediate reset
                        ctx.restore();
                    } else if (p.color === '#facc15') {
                        // --- SPECIAL: GOLD KAMAS (COINS) ---
                        ctx.shadowBlur = 15; ctx.shadowColor = '#facc15';
                        ctx.fillStyle = '#facc15';
                        ctx.beginPath();
                        ctx.arc(0, 0, 8, 0, Math.PI * 2);
                        ctx.fill();
                        // Rim
                        ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2;
                        ctx.stroke();
                        // K Symbol (Kama)
                        ctx.fillStyle = '#713f12';
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('K', 0, 0);
                    } else if (playerClass === 'iop') {
                        // --- IOP: SWORD (EXCALIBUR STYLE) ---
                        ctx.shadowBlur = 15; ctx.shadowColor = '#4ade80';
                        
                        // Handle
                        ctx.fillStyle = '#4b5563';
                        ctx.fillRect(-2, 12, 4, 8);
                        // Crossguard
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(-8, 10, 16, 3);
                        // Blade
                        ctx.fillStyle = '#f8fafc';
                        ctx.beginPath();
                        ctx.moveTo(-5, 10);
                        ctx.lineTo(0, -25);
                        ctx.lineTo(5, 10);
                        ctx.fill();
                        // Blade Center Line
                        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -20); ctx.stroke();
                    } else if (playerClass === 'enutrof') {
                        // --- ENUTROF: SHOVEL (PELLE DU PROSPECTEUR) ---
                        ctx.shadowBlur = 15; ctx.shadowColor = '#facc15';
                        
                        // Wooden Handle
                        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -10); ctx.stroke();
                        // Shovel Head
                        ctx.fillStyle = '#94a3b8';
                        ctx.beginPath();
                        ctx.arc(0, -15, 10, 0, Math.PI, true);
                        ctx.lineTo(0, -5);
                        ctx.closePath();
                        ctx.fill();
                        // Shine
                        ctx.fillStyle = 'rgba(255,255,255,0.4)';
                        ctx.fillRect(-2, -22, 4, 4);
                    } else if (playerClass === 'xelor') {
                        // --- XELOR: HOURGLASS (SABLIER DU TEMPS) ---
                        ctx.shadowBlur = 10; ctx.shadowColor = '#818cf8';
                        
                        // Frames (Top/Bottom)
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillRect(-10, -14, 20, 3);
                        ctx.fillRect(-10, 11, 20, 3);
                        
                        // Glass Body
                        ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
                        ctx.beginPath();
                        ctx.moveTo(-8, -11);
                        ctx.lineTo(8, -11);
                        ctx.lineTo(-8, 11);
                        ctx.lineTo(8, 11);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Sand
                        ctx.fillStyle = '#fbbf24';
                        // Top sand
                        ctx.beginPath();
                        ctx.moveTo(-6, -11); ctx.lineTo(6, -11); ctx.lineTo(0, 0); ctx.fill();
                        // Bottom sand
                        ctx.beginPath();
                        ctx.moveTo(-7, 11); ctx.lineTo(7, 11); ctx.lineTo(0, 4); ctx.fill();
                        
                        ctx.shadowBlur = 0;
                    } else {
                        // --- CRA: MAGIC ARROW (STANDARD) ---
                        ctx.shadowBlur = 15; ctx.shadowColor = '#f97316';
                        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(0, 20); ctx.lineTo(0, -25); // Main shaft
                        ctx.moveTo(-8, -10); ctx.lineTo(0, -25); ctx.lineTo(8, -10); // Spear head
                        ctx.stroke();
                        
                        // Fletching (Tail)
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(-6, 12); ctx.lineTo(0, 22); ctx.lineTo(6, 12);
                        ctx.stroke();
                    }
            } else {
                // Enemy standard projectile
                ctx.fillStyle = '#f43f5e'; ctx.shadowBlur = 10; ctx.shadowColor = '#f43f5e';
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });

        // Particles
        engine.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // Draw Powerups
        engine.powerups.forEach(pu => {
            let color = '#fff';
            let char = 'P';
            if (pu.type === 'shield') { color = '#10b981'; char = '🛡️'; }
            if (pu.type === 'kamas') { color = '#facc15'; char = 'K'; }
            if (pu.type === 'laser_xelor') { color = '#c084fc'; char = 'X'; }
            if (pu.type === 'cawotte') { color = '#f97316'; char = '🥕'; }

            ctx.fillStyle = color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            ctx.beginPath();
            ctx.arc(pu.x, pu.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = 'black';
            ctx.font = pu.type === 'cawotte' || pu.type === 'shield' ? '14px Arial' : 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(char, pu.x, pu.y + 5);
        });

        // --- COMBAT TIMELINE FEED (HUD) ---
        engine.combatLog.forEach((log, i) => {
            log.life -= 0.008; // Slightly slower decay
            if (log.life <= 0) return;
            
            ctx.save();
            ctx.globalAlpha = log.life;
            // Slide in animation
            const slideX = log.life > 0.9 ? (1 - log.life) * -100 : 30;
            ctx.translate(slideX, 220 + i * 25);
            
            // Glitchy Marker
            ctx.fillStyle = log.color;
            ctx.fillRect(0, 0, 3, 16);
            if (Math.random() > 0.9) {
                ctx.fillRect(-10 + Math.random()*20, 0, 5, 2); // Random glitch brick
            }
            
            // Text shadow for readability
            ctx.shadowBlur = 4; ctx.shadowColor = 'black';
            
            // Background box for readability
            ctx.font = 'bold italic 14px "Inter", sans-serif';
            const hw = ctx.measureText(log.text).width;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(8, -1, hw + 8, 18);

            // Text
            ctx.shadowBlur = 4; ctx.shadowColor = 'black';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'white';
            ctx.fillText(log.text, 12, 12);
            
            ctx.restore();
        });
        engine.combatLog = engine.combatLog.filter(l => l.life > 0);

        // --- DRAW GHOST SOULS (MULTIPLAYER SPECTATOR) ---
        Object.values(engine.souls).forEach(soul => {
            if (soul.isDead) return; // Hide dead allies for a cleaner look
            ctx.save();
            ctx.globalAlpha = 0.65; // High visibility ghostly
            
            // Draw Specific Class Silhouette for the soul
            const classKey = `class_${soul.class}`;
            const soulImg = engine.images[classKey];
            
            if (soulImg) {
                ctx.translate(soul.x, soul.y);
                const pulse = 1 + Math.sin(Date.now() / 400) * 0.08;
                ctx.scale(0.8 * pulse, 0.8 * pulse);
                ctx.shadowBlur = 20; ctx.shadowColor = '#6366f1';
                // Add spectral effect
                ctx.filter = 'grayscale(80%) brightness(150%) contrast(120%)';
                try {
                    ctx.drawImage(soulImg, -35, -35, 70, 70);
                } catch (e) {
                    ctx.fillStyle = '#38bdf8';
                    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
                }
            } else {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(soul.x, soul.y, 15, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Name & Class Badge (Fixed position above)
            ctx.save();
            ctx.translate(soul.x, soul.y);
            ctx.globalAlpha = 1.0;
            ctx.font = 'black 10px italic "Inter", sans-serif';
            ctx.textAlign = 'center';
            const className = soul.class === 'cra' ? 'CRÂ' : (soul.class === 'iop' ? 'IOP' : (soul.class === 'enutrof' ? 'ENU' : 'XEL'));
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(`${soul.name.toUpperCase()} [${className}]`, 0, -45);
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`${soul.score?.toLocaleString() || 0} pts`, 0, 45);
            ctx.restore();

            // Spawn soul particles
            if (Math.random() > 0.8) {
                engine.particles.push({
                    x: soul.x, y: soul.y,
                    vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2,
                    life: 1, maxLife: 0.5,
                    color: '#38bdf8', size: 2 + Math.random() * 4
                });
            }
        });

        // --- DRAW ROBOT BOT (MULTIPLAYER SYNC) ---
        if (room.withBot) {
            const bot = engine.bot;
            if (bot) {
                ctx.save();
                ctx.translate(bot.x + 35, bot.y + 35);
                ctx.rotate(bot.rotation);
                
                // Draw a sleek robotic drone
                ctx.shadowBlur = 15; ctx.shadowColor = '#6366f1';
                ctx.fillStyle = '#1e1b4b';
                ctx.beginPath();
                ctx.moveTo(0, -25); ctx.lineTo(-20, 15); ctx.lineTo(20, 15); ctx.closePath(); ctx.fill();
                
                // Glowing Core
                ctx.fillStyle = '#6366f1';
                ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI*2); ctx.fill();
                
                // Robot Eyes
                ctx.fillStyle = '#818cf8';
                ctx.fillRect(-10, 0, 4, 3); ctx.fillRect(6, 0, 4, 3);
                
                ctx.restore();
                
                // Tag
                ctx.save();
                ctx.translate(bot.x + 35, bot.y + 35);
                ctx.font = 'black 8px italic "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(99,102,241,0.6)';
                ctx.fillText("BOT ASSISTANT", 0, 35);
                ctx.restore();
            }
        }

        // --- DRAW DAMAGE TOASTS ---
        engine.damageToasts = engine.damageToasts.filter((t) => {
            ctx.save();
            ctx.globalAlpha = t.life;
            ctx.fillStyle = t.color;
            ctx.font = t.text.includes('!') ? 'bold 16px Arial' : 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
            
            t.y -= 1; // Float up
            t.life -= 0.02;
            return t.life > 0;
        });

        // Damage Flash UI
        if (engine.flashTime > 0) {
            ctx.fillStyle = `rgba(220, 38, 38, ${engine.flashTime / 400})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    // --- Throttled UI Sync Loop (10 FPS) ---
    // This removes the React re-render lag bottleneck by decoupling engine from UI
    useEffect(() => {
        if (gameState !== 'PLAYING') return;
        
        const syncInterval = setInterval(() => {
            const engine = engineRef.current;
            setScore(engine.score);
            _setLives(engine.lives);
            setHp(engine.player.health);
            setWave(engine.wave);
            setWeaponTime(engine.weaponTime);
        }, 100);

        return () => clearInterval(syncInterval);
    }, [gameState]);

    // --- Robust Main Game Loop ---
    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        let frameId: number;
        let lastTime = performance.now();

        const loop = (time: number) => {
            const dt = Math.min(time - lastTime, 100);
            lastTime = time;

            try {
                update(dt);
                draw();
                frameId = requestAnimationFrame(loop);
            } catch (err: any) {
                console.error("LOOOP CRASH:", err);
                setLastLoopError(err.message || String(err));
                frameId = requestAnimationFrame(loop);
            }
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [gameState]);

    // --- Shop Auto-Close Timer ---
    useEffect(() => {
        if (gameState !== 'SHOP') return;
        
        const interval = setInterval(() => {
            if (Date.now() > (engineRef.current.shopEndTime || 0)) {
                setGameState('PLAYING');
                engineRef.current.wave++;
                spawnWave(engineRef.current.wave);
            }
        }, 1000);
        
        return () => clearInterval(interval);
    }, [gameState, spawnWave]);

    // --- WebSocket Connection ---
    useEffect(() => {
        const s = io(buildWsUrl(), {
            path: "/socket.io/",
            transports: ["websocket", "polling"],
            query: { guildId }
        });
        setSocket(s);

        s.on("connect", () => {
            console.log("[Invader] Connected to WebSocket");
            s.emit("invader:room:join", room.roomId);
        });

        s.on("invader:pos:update", (data: any) => {
            if (data.userId === session?.user?.id) return;
            
            // Log joining if it's the first time we see this soul
            if (!engineRef.current.souls[data.userId]) {
                const name = data.name || "Un disciple";
                engineRef.current.combatLog.unshift({
                    id: Math.random(),
                    text: `✨ ${name.toUpperCase()} REJOINT LE SECTEUR`,
                    color: '#6366f1',
                    life: 3.0
                });
            }
            
            engineRef.current.souls[data.userId] = data;
        });

        s.on("invader:bot:update", (data: any) => {
            const isHost = session?.user?.id === room.hostId;
            if (isHost) return; 
            engineRef.current.bot = data;
        });

        s.on("invader:obstacles:update", (data: any) => {
            const isHost = session?.user?.id === room.hostId;
            if (isHost) return;
            
            const serverObs = data.obstacles || [];
            engineRef.current.obstacles = serverObs.map((so: any) => {
                const existing = engineRef.current.obstacles.find(o => o.id === so.id);
                if (existing) {
                    existing.x = so.x, existing.y = so.y, existing.rotation = so.rotation;
                    return existing;
                }
                return { ...so, vx: 0, vy: 0, spin: 0, hp: 10, maxHp: 10 };
            });
        });

        return () => { s.disconnect(); };
    }, [room.roomId, guildId, session?.user?.id]);

    // --- Ghost Multiplayer Sync loop ---
    useEffect(() => {
        if (!room.roomId || !socket || gameState !== 'PLAYING') return;
        
        const syncInterval = setInterval(() => {
            const engine = engineRef.current;
            const now = Date.now();
            
            // Sync loop (approx 10 FPS for network efficiency)
            if (now - engine.syncTime > 100) {
                engine.syncTime = now;
                
                // --- HOST MIGRATION LOGIC ---
                // Original logic was tied strictly to room.hostId. 
                // Now we check if we are the "eldest" active player.
                const activePlayerIds = Object.keys(engine.souls).sort();
                const myId = session?.user?.id || socket?.id;
                const oldestId = activePlayerIds[0] || myId; 
                const isEffectiveHost = myId === oldestId || myId === room.hostId;

                if (socket && !isSpectator) {
                    // Sync our position to others
                    socket.emit("invader:pos:sync", {
                        roomId: room.roomId,
                        userId: session?.user?.id,
                        x: engine.player.x,
                        y: engine.player.y,
                        class: playerClass,
                        name: session?.user?.name,
                        score: engine.score,
                        isDead: engine.player.isDead
                    });

                    // Host-only sync for global state
                    if (isEffectiveHost) {
                        if (engine.bot) {
                            socket.emit("invader:bot:sync", {
                                roomId: room.roomId,
                                ...engine.bot
                            });
                        }
                        if (engine.obstacles.length > 0) {
                            socket.emit("invader:obstacles:sync", {
                                roomId: room.roomId,
                                obstacles: engine.obstacles.map(o => ({
                                    id: o.id, x: o.x, y: o.y, type: o.type, rotation: o.rotation, radius: o.radius
                                }))
                            });
                        }
                    }
                }
            }
        }, 150);

        return () => clearInterval(syncInterval);
    }, [gameState, room.roomId, socket, session?.user?.id, playerClass, room.hostId, room.withBot]);

    // --- Inputs ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { 
            const key = e.key.toLowerCase();
            engineRef.current.keys[key] = true; 
            engineRef.current.keys[e.key] = true; 

            // PAUSE LOGIC (SOLO ONLY)
            if (key === 'p' || e.key === 'Escape') {
                setGameState(prev => {
                    if (prev === 'PLAYING') return 'PAUSED';
                    if (prev === 'PAUSED') return 'PLAYING';
                    return prev;
                });
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { 
            engineRef.current.keys[e.key.toLowerCase()] = false; 
            engineRef.current.keys[e.key] = false; 
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            if (gameState !== 'PLAYING' || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            engineRef.current.mouseX = mx;
            engineRef.current.mouseY = my;
        };

        const handleMouseDown = () => { engineRef.current.keys['mousedown'] = true; };
        const handleMouseUp = () => { engineRef.current.keys['mousedown'] = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [gameState]);

    // Sync score to server every 5s
    useEffect(() => {
        if (gameState !== 'PLAYING') return;
        const interval = setInterval(() => {
            updatePlayerScore(room.roomId, score);
        }, 5000);
        return () => clearInterval(interval);
    }, [score, gameState, room.roomId]);

    const copyShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        toast.success("Lien de session copié !");
    };

    return (
        <div className="flex flex-col w-full h-full max-h-full space-y-2 lg:space-y-4 bg-zinc-950 p-2 md:p-4 overflow-hidden">
            {/* --- CORE CONTENT AREA --- */}
            <div className="flex flex-1 gap-4 lg:gap-6 overflow-hidden min-h-0 w-full p-2 lg:p-4">
                
            {/* SIDEBAR TACTIQUE */}
            <div className="hidden lg:flex flex-col w-[280px] border-r border-white/5 bg-black/40 backdrop-blur-3xl flex-none h-full relative z-[60]">
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-4 sm:p-5 flex flex-col h-full overflow-y-auto custom-scrollbar gap-4">
                    
                    {/* STATUT BLOCK */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden relative flex-none p-4 shadow-xl">
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <h2 className="text-white text-2xl font-black italic tracking-tighter leading-none uppercase drop-shadow-md">SIGIL-INVADER</h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowVoiceOverlay(!showVoiceOverlay)}
                                    className={cn(
                                        "p-2 rounded-xl border transition-all pointer-events-auto",
                                        showVoiceOverlay 
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white" 
                                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                                    )}
                                    title={showVoiceOverlay ? "Masquer le vocal" : "Afficher le vocal"}
                                >
                                    {showVoiceOverlay ? <Mic size={16} strokeWidth={3} /> : <MicOff size={16} strokeWidth={3} />}
                                </button>
                                <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500 hover:text-white transition-all pointer-events-auto" title="Quitter">
                                    <LogOut size={16} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                        
                        {(!isSolo && (room.playerCount > 1 || !room.roomId.includes('solo'))) && (
                            <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-white/60 text-[10px] font-black italic uppercase">Room: {room.roomId.slice(-6)}</span>
                                </div>
                                <button onClick={copyShareLink} className="text-indigo-400 hover:text-indigo-300 pointer-events-auto">
                                    <Link2 size={14} strokeWidth={3} />
                                </button>
                            </div>
                        )}

                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-2 shadow-inner relative z-10">
                            <div className="space-y-0.5">
                                <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic">Score de Performance</span>
                                <div className="text-white text-3xl font-black italic tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                    {score.toLocaleString()}
                                </div>
                            </div>
                            <div className="h-px w-full bg-white/5" />
                            <div className="flex justify-between items-end">
                                <div className="space-y-0.5">
                                    <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic">Vague Active</span>
                                    <div className="text-indigo-400 text-xl font-black italic tabular-nums tracking-tighter">{wave}</div>
                                </div>
                                <div className="px-2 py-1 bg-indigo-500/20 rounded-md border border-indigo-500/30 text-[8px] font-black text-indigo-300 uppercase italic animate-pulse">Incursion</div>
                            </div>
                        </div>

                        {gameState === 'PLAYING' && (
                            <div className="space-y-1 relative z-10">
                                <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic">Déploiement</span>
                                <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl relative overflow-hidden group/class">
                                    <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center p-1.5 border border-white/10 relative z-10">
                                        {engineRef.current.images[`class_${playerClass}`] ? (
                                            <img src={(engineRef.current.images[`class_${playerClass}`] as any).src || (engineRef.current.images[`class_${playerClass}`] as any).toDataURL()} className="w-full h-full object-contain animate-float" alt={playerClass} />
                                        ) : ( <span className="text-lg">{playerClass === 'cra' ? '🏹' : playerClass === 'iop' ? '⚔️' : playerClass === 'enutrof' ? '💰' : '⏳'}</span> )}
                                    </div>
                                    <div className="space-y-0 relative z-10">
                                        <div className="text-white text-lg font-black uppercase italic tracking-tighter leading-tight">{playerClass === 'cra' ? 'Crâ' : playerClass === 'iop' ? 'Iop' : playerClass === 'enutrof' ? 'Énutrof' : 'Xélor'}</div>
                                        <div className="text-indigo-400 text-[7px] font-bold uppercase tracking-widest italic">COMBAT ACTIF</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 relative z-10">
                            <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic">Escouade Sigil</span>
                            <div className="space-y-1.5 pb-2">
                                <div className="bg-indigo-500/10 rounded-xl p-2 border border-indigo-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg border border-indigo-500/50 overflow-hidden bg-black relative">
                                            <img src={session?.user?.image || `https://ui-avatars.com/api/?name=${session?.user?.name}`} className="w-full h-full object-cover" alt="" />
                                            {voiceUserIds.includes(session?.user?.id as string) && (
                                                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                                    <Mic size={10} className="text-emerald-500 fill-emerald-500" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-white text-[9px] font-black uppercase italic truncate max-w-[80px]">{session?.user?.name || "Opérateur"}</span>
                                            {voiceUserIds.includes(session?.user?.id as string) && (
                                                <Mic size={8} className="text-emerald-500" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-white text-xs font-black italic tabular-nums">{score.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        {/* VOLUME CONTROLS */}
                        <div className="bg-black/60 p-4 rounded-xl border border-white/5 space-y-3 relative z-10">
                            <h3 className="text-white/40 text-[8px] font-black uppercase tracking-widest italic mb-1">Ajustements Audio</h3>
                            <div className="space-y-0.5">
                                <div className="flex justify-between items-center text-[9px] font-bold text-white/60">
                                    <span>FX</span><span>{Math.round(volume * 100)}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.05" value={volume} 
                                    onChange={e => {
                                        const v = parseFloat(e.target.value);
                                        setVolume(v);
                                        localStorage.setItem('sigil_volume', v.toString());
                                    }} 
                                    className="w-full accent-indigo-500 pointer-events-auto cursor-pointer"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold text-white/60">
                                    <span>Musique Ambiance</span>
                                    <span>{Math.round(musicVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={e => { const v = parseFloat(e.target.value); setMusicVolume(v); localStorage.setItem('sigil_music_volume', v.toString()); }} className="w-full accent-indigo-500 pointer-events-auto cursor-pointer h-1" />
                            </div>
                        </div>
                    </div> {/* End STATUT BLOCK */}
                    
                    {/* RESSOURCES BLOCK */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden relative flex-none p-4 space-y-4 shadow-xl mt-2">
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full" />
                        <div className="space-y-0.5 text-right relative z-10">
                            <span className="text-white/20 text-[8px] font-black uppercase tracking-[0.4em] italic leading-none">Système de Vitalité</span>
                            <h2 className="text-white text-2xl font-black italic tracking-tighter leading-none">RESSOURCES</h2>
                        </div>

                        <div className="space-y-2 relative z-10">
                            <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic flex justify-end">Cœurs d'Intégrité</span>
                            <div className="grid grid-cols-5 gap-1.5 mb-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`aspect-square rounded-lg flex items-center justify-center border transition-all duration-700 ${i < lives ? 'bg-red-500/20 border-red-500/40 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-black/60 border-white/5 text-white/5'}`}>
                                        <Heart size={14} fill={i < lives ? "currentColor" : "none"} className={i < lives ? "animate-pulse" : ""} />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic">Bouclier Structurel Phaseur</span>
                                    <span className="text-[10px] font-black italic tabular-nums" style={{ color: hp > 50 ? '#34d399' : (hp > 25 ? '#fbbf24' : '#ef4444') }}>{hp}%</span>
                                </div>
                                <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                    <div className="h-full transition-all duration-300" style={{ width: `${hp}%`, backgroundColor: hp > 50 ? '#34d399' : (hp > 25 ? '#fbbf24' : '#ef4444') }} />
                                </div>
                            </div>

                            {/* ARMOR BAR (ABRAKNYDE) */}
                            {(engineRef.current.player.armor > 0) && (
                                <div className="pt-2 animate-in fade-in slide-in-from-right-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-indigo-400 text-[8px] font-black uppercase tracking-widest italic">Écorce Abraknyde</span>
                                        <span className="text-[10px] font-black italic tabular-nums text-indigo-300">{engineRef.current.player.armor} AR</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-indigo-500/20 shadow-inner">
                                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(engineRef.current.player.armor / 100) * 100}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 relative z-10 pt-2">
                            <span className="text-white/40 text-[8px] font-black uppercase tracking-widest italic flex justify-end">Améliorations Système</span>
                            <div className="space-y-2 mt-1">
                                <div className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-sm">🔥</div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-white font-black uppercase italic leading-none">Arsenal</span>
                                            <span className="text-[7px] text-red-400 font-bold uppercase italic mt-0.5">Niv.{Math.floor(engineRef.current.player.permanentUpgrades.damage * 10)}</span>
                                        </div>
                                    </div>
                                    <div className="text-white text-sm font-black italic tabular-nums">x{engineRef.current.player.permanentUpgrades.damage.toFixed(1)}</div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 text-sm">⚡</div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-white font-black uppercase italic leading-none">Cadence</span>
                                            <span className="text-[7px] text-indigo-400 font-bold uppercase italic mt-0.5">Niv.{Math.floor(engineRef.current.player.permanentUpgrades.fireRate * 5)}</span>
                                        </div>
                                    </div>
                                    <div className="text-white text-sm font-black italic tabular-nums">x{engineRef.current.player.permanentUpgrades.fireRate.toFixed(1)}</div>
                                </div>
                            </div>
                        </div>
                    </div> {/* End RESSOURCES BLOCK */}
                    </div> {/* End inner scrollable area */}
                </div> {/* End inner flex column */}
                </div> {/* End sidebar container */}

                {/* --- CENTER COLUMN (GAME CORE) --- */}
                <div className="flex-1 flex flex-col relative overflow-hidden min-h-0 min-w-0 bg-transparent">
                    <div className="flex-1 relative bg-zinc-950 rounded-[2.5rem] border border-white/5 shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden">
                        {showVoiceOverlay && (
                            <DiscordVoiceOverlay 
                                users={voiceUsers} 
                                guildId={guildId}
                                gamePlayerIds={gameParticipantIds} 
                                currentUserId={(session?.user as any)?.discordId}
                            />
                        )}
                        <canvas 
                            ref={canvasRef} 
                            width={1920} 
                            height={1080} 
                            className="w-full h-full object-fill cursor-none select-none relative z-10 [image-rendering:pixelated]" 
                        />

                        {/* SPECTATOR OVERLAY */}
                        {engineRef.current.player.isDead && (
                            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-1000">
                                <div className="bg-zinc-950/90 border border-indigo-500/30 p-10 rounded-[4rem] text-center space-y-8 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/20 blur-[60px] rounded-full animate-pulse" />
                                    <div className="space-y-3 relative z-10">
                                        <div className="flex flex-col gap-3 relative z-10">
                                            <button 
                                                onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`}
                                                className="px-10 py-5 bg-red-500/20 border border-red-500/50 text-red-500 font-black uppercase text-sm italic rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5"
                                            >
                                                Quitter la Session
                                            </button>
                                            <p className="text-[10px] text-white/20 font-black uppercase italic animate-pulse">Mode spectateur actif...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* REACT DEBUG OVERLAY (HIDDEN) */}
                        <div className="hidden absolute top-20 left-4 z-[99] bg-black/80 p-2 rounded border border-green-500/30 font-mono text-[10px] text-green-400 pointer-events-none">
                            TICK: {engineRef.current.tick || 0}<br/>
                            MOBS: {engineRef.current.enemies.length}<br/>
                            PROJ: {engineRef.current.projectiles.length}<br/>
                            STATE: {gameState}<br/>
                            {lastLoopError && <span className="text-red-500 font-bold">ERR: {lastLoopError}</span>}
                        </div>
                    
                    <div className="absolute top-4 right-4 z-[90] flex flex-col gap-3">
                            <button 
                                onClick={() => setShowVoiceOverlay(!showVoiceOverlay)} 
                                className={cn(
                                    "p-4 bg-black/60 backdrop-blur-md border rounded-2xl transition-all cursor-pointer pointer-events-auto shadow-xl group relative",
                                    showVoiceOverlay ? "border-indigo-500/50 text-indigo-400" : "border-white/10 text-white/20 hover:text-white"
                                )}
                                title={showVoiceOverlay ? "Masquer le vocal" : "Afficher le vocal"}
                            >
                                <Mic size={20} className={showVoiceOverlay ? "animate-pulse" : ""} />
                                {!showVoiceOverlay && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 bg-red-500/50 rotate-45 rounded-full" />}
                            </button>
                            <button onClick={() => setIsMuted(!isMuted)} className="p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl text-white/40 hover:text-indigo-400 transition-all cursor-pointer pointer-events-auto shadow-xl" title="Couper le son">
                                {isMuted ? <Music size={20} className="text-red-400" /> : <Volume2 size={20} />}
                            </button>
                            <button onClick={() => setGameState(gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED')} className="p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all cursor-pointer pointer-events-auto shadow-xl" title="Pause">
                                {gameState === 'PAUSED' ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                            </button>
                            <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl text-white/40 hover:text-red-400 transition-all cursor-pointer pointer-events-auto shadow-xl" title="Quitter la partie">
                                <LogOut size={20} />
                            </button>
                        </div>

                        {gameState === 'PLAYING' && !announcement && (() => {
                            const activeBoss = engineRef.current.enemies.find(e => e.type.toString().includes('boss'));
                            return (
                                <div className="absolute bottom-6 right-6 flex pointer-events-none z-40">
                                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 py-3 px-6 rounded-full flex items-center gap-4 shadow-2xl">
                                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                                        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest italic">
                                            {activeBoss ? "MENACE SUPRÊME" : "Cibles Restantes"}
                                        </span>
                                        <div className="h-4 w-px bg-white/10 mx-1" />
                                        <span className="text-white text-lg font-black italic tabular-nums">
                                            {activeBoss ? "1" : Math.max(0, engineRef.current.waveQuota - engineRef.current.mobsKilled)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

                    {/* Shield Halo Effect */}
                    {engineRef.current.player.isShielded && (
                        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full border-4 border-sky-400/30 animate-ping absolute" />
                            <div className="w-24 h-24 rounded-full border-2 border-sky-400/50 animate-pulse absolute" />
                        </div>
                    )}

                    {/* Announcements (Stays Centered) */}
                    {isSpectator && (
                        <div className="absolute top-6 left-6 z-[90]">
                            <div className="bg-amber-500/10 backdrop-blur-xl border border-amber-500/40 py-2 px-4 rounded-xl flex items-center gap-3 shadow-2xl">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">MODE SPECTATEUR</span>
                            </div>
                        </div>
                    )}
                    <AnimatePresence>
                        {announcement && gameState === 'PLAYING' && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8, y: -50 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }}
                                className="absolute inset-x-0 top-1/4 -translate-y-1/2 flex items-center justify-center pointer-events-none z-50 px-12"
                            >
                                <div className="text-center space-y-2 py-3 px-8 bg-black/50 backdrop-blur-lg border-y border-white/10 w-full shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                                     <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] animate-pulse">WAR ALERT</div>
                                     <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(79,70,229,0.7)] leading-tight whitespace-nowrap">
                                         {announcement.text}
                                     </h2>
                                     <div className="h-0.5 w-full bg-indigo-500/60" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Modals Still Overlay Primary Game Area */}
                    <AnimatePresence>
                        {gameState === 'LOADING' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-[60] p-12">
                                <div className="w-full max-w-xs space-y-8 text-center">
                                    <div className="relative">
                                        <div className="w-24 h-24 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-white font-black italic text-xs">
                                                {Math.round((loadProgress.current / loadProgress.total) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h3 className="text-white font-black uppercase italic tracking-widest text-sm animate-pulse">Analyse du Secteur</h3>
                                        <p className="text-white/20 text-[10px] font-bold uppercase italic tracking-tighter">
                                            Initialisation des Protocoles Sigil<br/>
                                            {loadProgress.current} / {loadProgress.total} Bestiables Identifiés
                                        </p>
                                    </div>

                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-indigo-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(loadProgress.current / loadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                
                                {/* Aesthetic Grid Background */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                            </motion.div>
                        )}

                        {gameState === 'CLASS_SELECT' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center z-50 p-6 lg:p-12 pt-16 overflow-y-auto custom-scrollbar">
                                <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="absolute top-6 right-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all">
                                    <LogOut size={20} />
                                </button>
                                <div className="text-center mb-8">
                                    <span className="text-indigo-500 font-black uppercase italic tracking-[0.5em] text-[10px] mb-2 block">Protocole Sigil</span>
                                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter">SÉLECTIONNEZ VOTRE INCARNATION</h2>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 w-full max-w-4xl mx-auto pb-8">
                                    {['cra', 'iop', 'enutrof', 'xelor'].map(c => {
                                        const icon = c === 'cra' ? '/assets/dofus/classes/9.png' : 
                                                    c === 'iop' ? '/assets/dofus/classes/8.png' : 
                                                    c === 'enutrof' ? '/assets/dofus/classes/3.png' : 
                                                    '/assets/dofus/classes/5.png';
                                        return (
                                            <button 
                                                key={c} 
                                                onClick={() => startGameWithClass(c as any)} 
                                                className="bg-white/5 border border-white/10 p-4 lg:p-8 rounded-[2rem] hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all text-left group overflow-hidden relative"
                                            >
                                                <div className="relative z-10 flex items-center gap-4 lg:gap-6">
                                                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-black/40 border border-white/10 p-2 overflow-hidden shadow-2xl flex-shrink-0 flex items-center justify-center">
                                                        {engineRef.current.images[`class_${c}`] ? (
                                                            <img 
                                                                src={engineRef.current.images[`class_${c}`] instanceof HTMLCanvasElement 
                                                                    ? (engineRef.current.images[`class_${c}`] as HTMLCanvasElement).toDataURL() 
                                                                    : (engineRef.current.images[`class_${c}`] as HTMLImageElement).src} 
                                                                className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-500" 
                                                                alt="" 
                                                            />
                                                        ) : (
                                                            <span className="text-3xl">{c === 'cra' ? '🏹' : c === 'iop' ? '⚔️' : c === 'enutrof' ? '💰' : '⏳'}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-white font-black text-xl lg:text-2xl italic mb-1 uppercase group-hover:text-indigo-400 transition-colors">
                                                            {c === 'cra' ? 'Crâ' : c === 'iop' ? 'Iop' : c === 'enutrof' ? 'Énutrof' : 'Xélor'}
                                                        </div>
                                                        <p className="text-white/40 text-[9px] lg:text-[10px] uppercase font-bold tracking-widest italic line-clamp-2">
                                                            {c === 'cra' ? 'Tir Rapide / Flèches de Glace' : c === 'iop' ? 'Force Brute / Corps à Corps' : c === 'enutrof' ? 'Fortune / Triple Kamas' : 'Temporel / Laser du Néant'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="absolute top-0 right-[-20%] bottom-0 w-1/2 bg-gradient-to-l from-white/5 to-transparent skew-x-[-20deg] group-hover:from-indigo-500/20 transition-all duration-500" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {gameState === 'SHOP' && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="absolute inset-0 bg-black/95 backdrop-blur-2xl flex flex-col items-center z-50 p-6 lg:p-12 overflow-hidden"
                            >
                                {/* SCANLINE OVERLAY for Gaming Feel */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)' }} />
                                
                                <div className="relative z-20 w-full max-w-5xl flex flex-col h-full">
                                    <div className="text-center mb-10 shrink-0">
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <div className="h-px w-20 bg-gradient-to-r from-transparent to-indigo-500/50" />
                                            <span className="text-indigo-500 font-black uppercase italic tracking-[0.6em] text-[10px]">Terminal d'Armement</span>
                                            <div className="h-px w-20 bg-gradient-to-l from-transparent to-indigo-500/50" />
                                        </div>
                                        <h2 className="text-5xl md:text-7xl font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_15px_rgba(79,70,229,0.3)]">BOUTIQUE SIGIL</h2>
                                        
                                        <div className="mt-6 inline-flex items-center gap-4 bg-zinc-900/80 border border-white/10 px-8 py-3 rounded-full backdrop-blur-md shadow-2xl">
                                            <span className="text-white/40 text-[10px] font-black uppercase italic tracking-widest">Crédits de Mission</span>
                                            <div className="h-6 w-px bg-white/10" />
                                            <span className="text-white text-3xl font-black italic tabular-nums drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                                                {score.toLocaleString()} <span className="text-yellow-400">🪙</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 pb-12">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {[
                                                { id: 'dmg',          name: 'Arsenal Offensif',  desc: '+20% Dégâts par tir',             cost: 800,  icon: '🔥', tag: 'OFFENSIF' },
                                                { id: 'rate',         name: 'Cycle Rapide',      desc: '+25% Cadence de Tir',             cost: 1200, icon: '⚡', tag: 'OFFENSIF' },
                                                { id: 'multi',        name: 'Salve Sigil',       desc: '+1 Projectile (max 8)',           cost: 2500, icon: '🎯', tag: 'OFFENSIF' },
                                                { id: 'heal',         name: 'Réparation',        desc: '+1 Cœur d\'Intégrité',            cost: 2000, icon: '❤️', tag: 'DÉFENSIF' },
                                                { id: 'armor_abrak',  name: 'Écorce Abraknyde',  desc: '50 Armor (Max 100)',             cost: 1500, icon: '🪵', tag: 'DÉFENSIF' },
                                                { id: 'shield_regen', name: 'Égide du Sigil',   desc: 'Bouclier de 4 secondes',         cost: 1500, icon: '🛡️', tag: 'DÉFENSIF' },
                                                { id: 'chance_eca',   name: 'Chance Écaflip',    desc: '25% Esquive (Passif)',           cost: 2500, icon: '🎲', tag: 'SYSTÈME' },
                                                { id: 'slow_xelor',   name: 'Poussière Xelor',   desc: 'Projectiles ennemis -15% Speed', cost: 2500, icon: '⏳', tag: 'SYSTÈME' },
                                                { id: 'pierce_cra',   name: 'Tir Perçant',       desc: 'Tirs traversant l\'ennemi',      cost: 4000, icon: '🏹', tag: 'SYSTÈME' },
                                            ].map(baseItem => {
                                                const purchases = (engineRef.current.purchaseHistory as any)[baseItem.id] || 0;
                                                const cost = Math.floor(baseItem.cost * (1 + purchases * 0.5));
                                                const isPerk = ['fury_sacri', 'chance_eca', 'slow_xelor', 'pierce_cra'].includes(baseItem.id);
                                                const alreadyOwned = isPerk && purchases > 0;
                                                const canAfford = score >= cost && !alreadyOwned;

                                                return (
                                                    <motion.button 
                                                        key={baseItem.id} 
                                                        whileHover={canAfford ? { scale: 1.02, y: -4 } : {}}
                                                        whileTap={canAfford ? { scale: 0.98 } : {}}
                                                        onClick={() => {
                                                            if (canAfford) {
                                                                const engine = engineRef.current;
                                                                playSound('powerup');
                                                                engine.purchaseHistory[baseItem.id] = (engine.purchaseHistory[baseItem.id] || 0) + 1;
                                                                if (baseItem.id === 'dmg') engine.player.permanentUpgrades.damage += 0.20;
                                                                if (baseItem.id === 'rate') engine.player.permanentUpgrades.fireRate += 0.25;
                                                                if (baseItem.id === 'heal') engine.lives = Math.min(5, engine.lives + 1);
                                                                if (baseItem.id === 'armor_abrak') engine.player.armor = Math.min(100, engine.player.armor + 50);
                                                                if (baseItem.id === 'chance_eca') engine.player.perks.dodgeChance = 0.25;
                                                                if (baseItem.id === 'slow_xelor') engine.player.perks.slowProjectiles = true;
                                                                if (baseItem.id === 'pierce_cra') engine.player.perks.piercingShots = true;
                                                                if (baseItem.id === 'multi') setWeapon(prev => ({ ...prev, projectileCount: Math.min(prev.projectileCount + 1, 8) }));
                                                                if (baseItem.id === 'shield_regen') { engine.player.isShielded = true; engine.player.shieldTime = 4000; }
                                                                engine.score -= cost;
                                                                setScore(engine.score);
                                                                setGameState('PLAYING');
                                                            }
                                                        }}
                                                        disabled={!canAfford}
                                                        className={cn(
                                                            "relative flex flex-col p-5 rounded-[1.5rem] border transition-all text-left overflow-hidden h-full group",
                                                            canAfford 
                                                                ? "bg-zinc-900/50 border-white/10 hover:border-indigo-500/50 hover:bg-zinc-900/80" 
                                                                : "bg-black/20 border-white/5 opacity-50 grayscale cursor-not-allowed"
                                                        )}
                                                    >
                                                        {/* Header: Tag + Icon */}
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <div className={cn(
                                                                "px-2 py-0.5 rounded-md text-[8px] font-black italic tracking-widest",
                                                                baseItem.tag === 'OFFENSIF' ? "bg-red-500/20 text-red-400" : 
                                                                baseItem.tag === 'DÉFENSIF' ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"
                                                            )}>
                                                                {baseItem.tag}
                                                            </div>
                                                            <div className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] group-hover:scale-110 transition-transform">
                                                                {baseItem.icon}
                                                            </div>
                                                        </div>

                                                        {/* Info */}
                                                        <div className="relative z-10 flex-1">
                                                            <div className="text-white font-black text-lg italic uppercase tracking-tight mb-1 group-hover:text-indigo-400 transition-colors">
                                                                {baseItem.name}
                                                            </div>
                                                            <p className="text-white/40 text-[10px] font-bold uppercase italic leading-tight mb-6">
                                                                {baseItem.desc}
                                                            </p>
                                                        </div>

                                                        {/* Footer: Price + Action */}
                                                        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[7px] text-white/20 font-black uppercase tracking-widest italic">Coût de Déploiement</span>
                                                                <span className={cn(
                                                                    "text-xl font-black italic tabular-nums",
                                                                    canAfford ? "text-white" : "text-red-500/50"
                                                                )}>
                                                                    {cost.toLocaleString()} <span className="text-yellow-400/50">🪙</span>
                                                                </span>
                                                            </div>
                                                            <div className={cn(
                                                                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase italic transition-all",
                                                                alreadyOwned ? "bg-white/10 text-white/40" : 
                                                                (canAfford ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]" : "bg-white/5 text-white/10")
                                                            )}>
                                                                {alreadyOwned ? 'Acquis' : (score >= cost ? 'Installer' : 'Bloqué')}
                                                            </div>
                                                        </div>

                                                        {/* Glitch Overlay on Hover */}
                                                        {canAfford && (
                                                            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                                                        )}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Shop Bottom Bar */}
                                    <div className="shrink-0 mt-auto pt-6 flex flex-col md:flex-row items-center justify-between border-t border-white/10 bg-black/40 p-6 -mx-6 rounded-b-[2rem]">
                                        <div className="flex items-center gap-4 mb-4 md:mb-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                                <span className="text-red-400 font-black uppercase text-[10px] italic">Déploiement forcé dans :</span>
                                            </div>
                                            <span className="text-white text-3xl font-black italic tabular-nums min-w-[40px]">
                                                {Math.max(0, Math.ceil(((engineRef.current.shopEndTime || 0) - Date.now()) / 1000))}s
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => { setGameState('PLAYING'); engineRef.current.wave++; spawnWave(engineRef.current.wave); }} 
                                            className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black uppercase text-xs italic tracking-widest transition-all"
                                        >
                                            Ignorer le Marché (Prêt)
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        
                        {gameState === 'GAMEOVER' && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-red-950/90 backdrop-blur-3xl flex items-center justify-center z-50 p-12 text-center">
                                <div className="space-y-12 max-w-sm">
                                    <div className="space-y-4">
                                        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30 animate-pulse">
                                            <span className="text-6xl">🩸</span>
                                        </div>
                                        <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none">DÉFAITE</h2>
                                        <p className="text-red-400 font-black uppercase tracking-[0.3em] text-[10px] italic">Votre âme a été réclamée</p>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full">
                                        <button onClick={resetGame} className="w-full py-6 rounded-3xl bg-white text-black font-black uppercase text-sm italic hover:bg-red-500 hover:text-white transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]">Réessayer</button>
                                        <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="w-full py-4 rounded-3xl bg-white/5 border border-white/10 text-white/40 hover:text-white font-black uppercase text-xs italic tracking-widest transition-all">Abandonner la Mission</button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {gameState === 'PAUSED' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-[100] gap-8">
                                <div className="text-center">
                                    <span className="text-indigo-400 font-black uppercase italic tracking-[0.5em] text-[10px] mb-2">Protocole en Attente</span>
                                    <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter">PAUSE</h2>
                                </div>
                                <button 
                                    onClick={() => setGameState('PLAYING')} 
                                    className="px-12 py-6 rounded-3xl bg-indigo-500 text-white font-black uppercase text-sm italic hover:bg-indigo-400 transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)]"
                                >
                                    Reprendre la Mission
                                </button>
                                <div className="flex gap-4">
                                     <button onClick={() => setShowSettings(true)} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors">
                                        <Settings size={20} />
                                     </button>
                                     <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-red-400 transition-colors">
                                        <LogOut size={20} />
                                     </button>
                                </div>
                            </motion.div>
                        )}

                        {showSettings && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center z-[100] p-12">
                                <div className="text-center mb-12">
                                    <span className="text-indigo-500 font-black uppercase italic tracking-[0.6em] text-[10px] mb-2">Configuration Centrale</span>
                                    <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter">PARAMÈTRES</h2>
                                </div>
                                <div className="w-full max-w-md space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-white/40 text-[10px] font-black uppercase italic">Volume Global</span>
                                            <span className="text-white text-xl font-black italic">{Math.round(volume * 100)}%</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full accent-indigo-500 bg-white/10 h-2 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <button onClick={() => setIsMuted(!isMuted)} className="w-full py-6 rounded-3xl bg-white/5 border border-white/10 text-white font-black uppercase text-sm italic hover:bg-white/10 transition-all">
                                        {isMuted ? 'Activer le Son' : 'Couper le Son'}
                                    </button>

                                    {/* Music Toggle Section */}
                                    <div className="space-y-4 pt-4 border-t border-white/5 p-4 bg-white/[0.02] rounded-3xl">
                                        <div className="flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-white text-xs font-black uppercase italic tracking-wider">Musique d'ambiance</span>
                                                <span className="text-white/20 text-[9px] font-bold uppercase italic mt-1">Son-ambiance-sigil-invaders.mp3</span>
                                            </div>
                                            <button 
                                                onClick={() => setIsMusicEnabled(!isMusicEnabled)}
                                                className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase italic transition-all shadow-lg ${isMusicEnabled ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-white/10 text-white/40'}`}
                                            >
                                                {isMusicEnabled ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end px-1">
                                                <span className="text-white/40 text-[8px] font-black uppercase italic">Intensité Sonore</span>
                                                <span className="text-indigo-400 text-xs font-black italic">{Math.round(musicVolume * 100)}%</span>
                                            </div>
                                            <input 
                                               type="range" min="0" max="1" step="0.01" value={musicVolume} 
                                               onChange={(e) => setMusicVolume(parseFloat(e.target.value))} 
                                               className="w-full accent-indigo-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" 
                                            />
                                        </div>
                                    </div>

                                    <button onClick={() => setShowSettings(false)} className="w-full py-8 rounded-[2.5rem] bg-indigo-500 text-white font-black uppercase text-lg italic hover:bg-indigo-400 transition-all shadow-2xl">Continuer la Mission</button>
                                    <button onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`} className="w-full py-4 text-white/20 hover:text-red-400 font-bold uppercase text-[10px] italic transition-colors">Abandonner la Mission</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    </div> {/* End inner center column */}
                </div> {/* End center column wrapper */}
            </div> {/* End flex row container */}

        </div>
    );
}
