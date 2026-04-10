"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Download, User } from "lucide-react";

interface SkribblGalleryProps {
    history: any[];
}

export const SkribblGallery = ({ history }: SkribblGalleryProps) => {
    if (!history || history.length === 0) return null;

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 p-4">
            <div className="text-center space-y-2">
                <h2 className="text-white font-black text-4xl uppercase italic tracking-tighter drop-shadow-lg">
                    GALERIE DE LA PARTIE
                </h2>
                <div className="h-1.5 w-24 bg-[#52ce3c] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {history.map((round, idx) => (
                    <div 
                        key={idx}
                        className="bg-white/10 backdrop-blur-xl rounded-[2.5rem] border-[6px] border-white/10 p-6 flex flex-col gap-4 shadow-2xl hover:scale-105 transition-all duration-300 group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/10 overflow-hidden shrink-0">
                                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${round.drawer}`} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">ARTISTE</span>
                                    <span className="text-white font-black uppercase italic tracking-tight leading-tight">{round.drawer}</span>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-[#52ce3c] rounded-xl shadow-lg border-b-4 border-[#2d7a1d]">
                                <span className="text-white font-black uppercase text-xs italic tracking-tighter">{round.word}</span>
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-3xl p-3 shadow-inner relative overflow-hidden group/canvas min-h-[200px]">
                             <SkribblMiniCanvas actions={round.canvasActions} />
                             
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/canvas:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                <button className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                                    <Maximize2 size={20} />
                                </button>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SkribblMiniCanvas = ({ actions }: { actions: any[] }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set higher resolution internal size then scale down via CSS
        canvas.width = 800;
        canvas.height = 600;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawSegment = (x0: number, y0: number, x1: number, y1: number, col: string, lw: number) => {
            ctx.beginPath();
            ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
            ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw * (canvas.width / 500); // Scale line width
            ctx.stroke();
            ctx.closePath();
        };

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), 255] : [0,0,0,255];
        };

        const performFloodFill = (cx: number, cy: number, fillColor: string) => {
             const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             const data = canvasData.data;
             const targetColorArr = hexToRgb(fillColor);
             const startX = Math.floor(cx * canvas.width);
             const startY = Math.floor(cy * canvas.height);
             
             const getPixelIdx = (px: number, py: number) => (py * canvas.width + px) * 4;
             const startIdx = getPixelIdx(startX, startY);
             const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2], startA = data[startIdx+3];
             if (startR === targetColorArr[0] && startG === targetColorArr[1] && startB === targetColorArr[2]) return;

             const stack = [[startX, startY]];
             while (stack.length) {
                 const [x, y] = stack.pop()!;
                 if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
                 const i = getPixelIdx(x, y);
                 if (data[i] !== startR || data[i+1] !== startG || data[i+2] !== startB || data[i+3] !== startA) continue;
                 data[i] = targetColorArr[0]; data[i+1] = targetColorArr[1]; data[i+2] = targetColorArr[2]; data[i+3] = targetColorArr[3];
                 stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
             }
             ctx.putImageData(canvasData, 0, 0);
        };

        actions.forEach((dataList: any) => {
            const arr = Array.isArray(dataList) ? dataList : [dataList];
            arr.forEach((data: any) => {
                if (data.type === "fill") {
                    performFloodFill(data.normX, data.normY, data.color);
                } else {
                    drawSegment(data.x0, data.y0, data.x1, data.y1, data.color, data.lineWidth || 5);
                }
            });
        });
    }, [actions]);

    return <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />;
};
