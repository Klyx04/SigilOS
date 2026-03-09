'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, Home, Eye, EyeOff, Plus, Minus, Move } from 'lucide-react';

interface MinimapWrapperProps {
    children: React.ReactNode;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onRecenter: () => void;
    zoomLevel: number;
    onValidate?: () => void;
    canValidate?: boolean;
    validateLabel?: string;
}

export default function MinimapWrapper({
    children,
    onZoomIn,
    onZoomOut,
    onRecenter,
    zoomLevel,
    onValidate,
    canValidate,
    validateLabel = "Valider ma Position"
}: MinimapWrapperProps) {
    const [isHidden, setIsHidden] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial position: bottom right
    useEffect(() => {
        const updatePosition = () => {
            if (typeof window !== 'undefined') {
                setPosition({ x: window.innerWidth - (isExpanded ? 600 : 400) - 40, y: window.innerHeight - (isExpanded ? 450 : 300) - 40 });
            }
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, [isExpanded]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.map-controls')) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (isHidden) {
        return (
            <button
                onClick={() => setIsHidden(false)}
                className="fixed bottom-10 right-10 z-[300] p-4 bg-slate-900/90 backdrop-blur-xl border border-emerald-500/50 rounded-full shadow-2xl text-emerald-500 hover:scale-110 transition-all pointer-events-auto shadow-emerald-500/20 animate-in fade-in zoom-in-50"
            >
                <Eye size={24} />
            </button>
        );
    }

    const width = isExpanded ? 600 : 400;
    const height = isExpanded ? 450 : 300;

    return (
        <div
            ref={containerRef}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${width}px`,
                height: `${height + 60}px`, // +60 for the validation button area
            }}
            className={`fixed z-[300] flex flex-col pointer-events-auto transition-shadow ${isDragging ? 'shadow-2xl cursor-grabbing' : 'shadow-xl'}`}
        >
            {/* Map Area */}
            <div
                className="relative flex-1 bg-slate-950 border-2 border-white/10 rounded-t-[2rem] overflow-hidden group shadow-2xl"
                onMouseDown={handleMouseDown}
            >
                <div className="absolute inset-0 z-0">
                    {children}
                </div>

                {/* Controls Overlay */}
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 map-controls opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
                        <button onClick={onZoomIn} className="p-2 hover:bg-white/10 text-white/60 hover:text-white transition-all"><Plus size={16} /></button>
                        <div className="px-2 py-2 text-[10px] font-black text-emerald-400 border-x border-white/5 flex items-center">{Math.round((zoomLevel + 4) * 20)}%</div>
                        <button onClick={onZoomOut} className="p-2 hover:bg-white/10 text-white/60 hover:text-white transition-all"><Minus size={16} /></button>
                    </div>

                    <button onClick={onRecenter} className="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl text-white/60 hover:text-white transition-all flex items-center justify-center">
                        <Home size={16} />
                    </button>

                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl text-white/60 hover:text-white transition-all flex items-center justify-center">
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    <button onClick={() => setIsHidden(true)} className="p-2 bg-slate-900/80 backdrop-blur-md border border-red-500/30 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                        <EyeOff size={16} />
                    </button>
                </div>

                {/* Drag Handle Icon */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-20 transition-opacity group-hover:opacity-60">
                    <Move size={16} className="text-white" />
                </div>
            </div>

            {/* Validation Button Area */}
            <div className="h-[60px] bg-slate-900/10 border-x-2 border-b-2 border-white/10 rounded-b-[2rem] overflow-hidden">
                <button
                    disabled={!canValidate}
                    onClick={onValidate}
                    className={`w-full h-full font-black uppercase italic text-xs tracking-[0.2em] transition-all active:scale-95 ${canValidate ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
                >
                    {validateLabel}
                </button>
            </div>
        </div>
    );
}
