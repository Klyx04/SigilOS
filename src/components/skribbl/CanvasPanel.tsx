import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Eraser, Trash2, Undo, Loader2, PenLine, PaintBucket } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasPanelProps {
    socket: Socket;
    gameState: any;
    isDrawer: boolean;
    isSpectator?: boolean;
}

export default function CanvasPanel({ socket, gameState, isDrawer, isSpectator }: CanvasPanelProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#000000");
    const [lineWidth, setLineWidth] = useState(5);
    const [tool, setTool] = useState<"pen" | "fill">("pen");
    const [lastPos, setLastPos] = useState<{ x: number, y: number, normX: number, normY: number } | null>(null);
    const currentStroke = useRef<any[]>([]);
    const currentPathId = useRef<string | null>(null);

    const colors = [
        "#ffffff", "#dcdcdc", "#ff0000", "#ff8c00", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee", "#8b4513",
        "#000000", "#808080", "#800000", "#a52a2a", "#ffa500", "#006400", "#40e0d0", "#000080", "#800080", "#ffc0cb"
    ];

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const setCanvasSize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
                canvas.width = w;
                canvas.height = h;
            }
        };
        setCanvasSize();
        const ro = new ResizeObserver(setCanvasSize);
        ro.observe(container);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const drawSegment = (x0: number, y0: number, x1: number, y1: number, col: string, lw: number) => {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
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
            
            const getPixelIdx = (px: number, py: number) => (py * canvas.width + px) * 4;
            
            const startIdx = getPixelIdx(cx, cy);
            const startR = data[startIdx];
            const startG = data[startIdx+1];
            const startB = data[startIdx+2];
            const startA = data[startIdx+3];

            if (startR === targetColorArr[0] && startG === targetColorArr[1] && startB === targetColorArr[2]) return;

            const matchStartColor = (idx: number) => {
                return data[idx] === startR && data[idx+1] === startG && data[idx+2] === startB && data[idx+3] === startA;
            };

            const stack = [[cx, cy]];
            while (stack.length) {
                const [x, y] = stack.pop()!;
                if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
                const i = getPixelIdx(x, y);
                if (!matchStartColor(i)) continue;

                data[i] = targetColorArr[0];
                data[i+1] = targetColorArr[1];
                data[i+2] = targetColorArr[2];
                data[i+3] = targetColorArr[3];

                stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
            }
            ctx.putImageData(canvasData, 0, 0);
        };

        socket.on("skribbl:draw:stroke", (dataList: any[]) => {
            if (!Array.isArray(dataList)) dataList = [dataList];
            dataList.forEach(data => {
                if (data.type === "fill") {
                    const cx = Math.floor(data.normX * canvas.width);
                    const cy = Math.floor(data.normY * canvas.height);
                    performFloodFill(cx, cy, data.color);
                } else {
                    const x0 = data.x0 * canvas.width;
                    const y0 = data.y0 * canvas.height;
                    const x1 = data.x1 * canvas.width;
                    const y1 = data.y1 * canvas.height;
                    drawSegment(x0, y0, x1, y1, data.color, data.lineWidth || 5);
                }
            });
        });

        socket.on("skribbl:draw:clear", () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        const redrawCanvas = (actions: any[]) => {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            actions.forEach((dataList: any) => {
                const arr = Array.isArray(dataList) ? dataList : [dataList];
                arr.forEach((data: any) => {
                    if (data.type === "fill") {
                        const cx = Math.floor((data.normX as number) * canvas.width);
                        const cy = Math.floor((data.normY as number) * canvas.height);
                        performFloodFill(cx, cy, data.color);
                    } else {
                        const x0 = (data.x0 as number) * canvas.width;
                        const y0 = (data.y0 as number) * canvas.height;
                        const x1 = (data.x1 as number) * canvas.width;
                        const y1 = (data.y1 as number) * canvas.height;
                        drawSegment(x0, y0, x1, y1, data.color, data.lineWidth || 5);
                    }
                });
            });
        };

        socket.on("skribbl:canvas:restore", ({ actions }) => {
            redrawCanvas(actions);
        });

        socket.on("skribbl:draw:undo", () => {
            socket.emit("skribbl:room:join", { roomId: gameState.id, playerObj: {} });
        });

        const sendBatch = setInterval(() => {
            if (currentStroke.current.length > 0) {
                socket.emit("skribbl:draw:stroke", currentStroke.current);
                currentStroke.current = [];
            }
        }, 50);

        return () => {
            clearInterval(sendBatch);
            ro.disconnect();
            socket.off("skribbl:draw:stroke");
            socket.off("skribbl:draw:clear");
            socket.off("skribbl:canvas:restore");
            socket.off("skribbl:draw:undo");
        };
    }, [socket, gameState.id]);

    const getMouseCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0, normX: 0, normY: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        let clientX = 0, clientY = 0;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: (clientX as number) - rect.left,
            y: (clientY as number) - rect.top,
            normY: ((clientY as number) - rect.top) / rect.height,
            normX: ((clientX as number) - rect.left) / rect.width
        };
    };

    const hexToRgbFast = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), 255] : [0,0,0,255];
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawer) return;
        const { x, y, normX, normY } = getMouseCoords(e);
        
        if (tool === "fill") {
            currentStroke.current.push({
                type: "fill",
                normX, normY, color, pathId: Math.random().toString(36).substring(7)
            });
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = canvasData.data;
                const targetColorArr = hexToRgbFast(color);
                const cx = Math.floor(x);
                const cy = Math.floor(y);
                const getPixelIdx = (px: number, py: number) => (py * canvas.width + px) * 4;
                const startIdx = getPixelIdx(cx, cy);
                const startR = data[startIdx];
                const startG = data[startIdx+1];
                const startB = data[startIdx+2];
                const startA = data[startIdx+3];

                if (!(startR === targetColorArr[0] && startG === targetColorArr[1] && startB === targetColorArr[2])) {
                    const matchStartColor = (idx: number) => 
                        data[idx] === startR && data[idx+1] === startG && data[idx+2] === startB && data[idx+3] === startA;

                    const stack = [[cx, cy]];
                    while (stack.length) {
                        const [px, py] = stack.pop()!;
                        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
                        const i = getPixelIdx(px, py);
                        if (!matchStartColor(i)) continue;

                        data[i] = targetColorArr[0];
                        data[i+1] = targetColorArr[1];
                        data[i+2] = targetColorArr[2];
                        data[i+3] = targetColorArr[3];

                        stack.push([px+1, py], [px-1, py], [px, py+1], [px, py-1]);
                    }
                    ctx.putImageData(canvasData, 0, 0);
                }
            }
            return;
        }

        setIsDrawing(true);
        currentPathId.current = Math.random().toString(36).substring(7);
        setLastPos({ x, y, normX, normY });
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !isDrawer || tool !== "pen" || !lastPos || !canvasRef.current) return;
        const { x, y, normX, normY } = getMouseCoords(e);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx && lastPos) {
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y); 
            ctx.lineTo(x, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            ctx.closePath();
            currentStroke.current.push({
                type: "pen",
                x0: lastPos.normX, y0: lastPos.normY,
                x1: normX, y1: normY,
                color, lineWidth,
                pathId: currentPathId.current
            });
        }
        setLastPos({ x, y, normX, normY });
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        setLastPos(null);
        currentPathId.current = null;
    };

    const clearCanvas = () => {
        if (!isDrawer) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        socket.emit("skribbl:draw:clear");
    };

    const undoLast = () => {
        if (!isDrawer) return;
        socket.emit("skribbl:draw:undo");
    };

    return (
        <div className="flex-1 w-full min-h-0 flex flex-col bg-transparent relative gap-3 overflow-hidden">
            <div className="flex-1 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden border-b-[8px] md:border-b-[14px] border-black/10 min-h-0">
                 <div className="absolute top-0 left-0 w-full flex justify-around px-8 md:px-24 opacity-10 pointer-events-none z-0">
                    {Array.from({length: 15}).map((_, i) => (
                        <div key={i} className="w-2.5 md:w-3.5 h-8 md:h-12 bg-black rounded-full -mt-4 md:-mt-6 shadow-inner" />
                    ))}
                </div>

                <div ref={containerRef} className="absolute inset-0 cursor-crosshair">
                    <canvas
                        ref={canvasRef}
                        className="block w-full h-full cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
            </div>

            {isDrawer && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-[2.5rem] px-4 md:px-6 py-3 md:py-4 flex flex-col lg:flex-row items-center justify-center lg:justify-between shrink-0 shadow-2xl border-b-[6px] md:border-b-[8px] border-black/10 z-20 gap-3 md:gap-4">
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <div className="bg-slate-100 p-2 md:p-3 rounded-xl md:rounded-[1.5rem] border-b-2 border-black/5">
                            <div className="grid grid-cols-5 md:grid-cols-10 gap-1 md:gap-1.5">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "w-5 h-5 md:w-6 md:h-6 rounded-md border transition-all hover:scale-125 active:scale-95",
                                            color === c ? "ring-2 ring-[#5d3fd3]/30 scale-125 border-white shadow-lg" : "border-black/5"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-center">
                        <div className="flex items-center gap-3 md:gap-4 bg-slate-100/50 px-4 md:px-6 py-2 md:py-3 rounded-[1rem] md:rounded-[1.5rem]">
                            {[4, 10, 20, 40].map(w => (
                                <button key={w} onClick={() => setLineWidth(w)} className="relative group transition-transform active:scale-90">
                                    <div className={cn(
                                        "rounded-full transition-all duration-300",
                                        lineWidth === w ? "bg-[#5d3fd3] ring-2 md:ring-4 ring-[#5d3fd3]/20 shadow-xl scale-125" : "bg-slate-400"
                                    )} style={{ width: Math.max(5, w/2.5), height: Math.max(5, w/2.5) }} />
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {[
                                { id: "pen", icon: <PenLine className="w-4 h-4 md:w-5 md:h-5" /> },
                                { id: "fill", icon: <PaintBucket className="w-4 h-4 md:w-5 md:h-5" /> }
                            ].map(t => (
                                <button key={t.id} onClick={() => setTool(t.id as any)} className={cn(
                                    "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center transition-all border-b-[4px] shadow-lg",
                                    tool === t.id ? "bg-[#5d3fd3] text-white border-[#3d2080] scale-105" : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-white"
                                )}>
                                    {t.icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pl-2 md:pl-4 lg:border-l-2 border-slate-200">
                        <button onClick={undoLast} className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center border-b-[4px] border-amber-700 active:translate-y-1 active:border-b-0 transition-all shadow-lg group">
                            <Undo className="w-5 h-5 md:w-6 md:h-6 group-hover:-rotate-45 transition-transform" />
                        </button>
                        <button onClick={clearCanvas} className="px-3 md:px-6 h-10 md:h-12 rounded-lg md:rounded-xl bg-red-500 hover:bg-red-400 text-white flex items-center gap-2 border-b-[4px] border-red-700 active:translate-y-1 active:border-b-0 transition-all shadow-lg font-black uppercase italic tracking-tighter text-[10px] md:text-xs text-nowrap">
                            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden xs:inline">Effacer</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
