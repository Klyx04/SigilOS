"use client";

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { DrawTool, StrokeData } from "../../../types/socket-events";

interface GarticCanvasProps {
    onStrokeSubmit: (stroke: StrokeData) => void;
    isDrawing: boolean;
    initialStrokes?: StrokeData[];
    brushColor?: string;
    brushSize?: number;
    brushTool?: DrawTool;
    brushOpacity?: number;
}

export interface GarticCanvasRef {
    clear: () => void;
    undo: () => void;
    redo: () => void;
    fill: (color: string) => void;
    getImageData: () => string;
}

export const GarticCanvas = forwardRef<GarticCanvasRef, GarticCanvasProps>(
    ({ onStrokeSubmit, isDrawing, initialStrokes = [], brushColor = "#000000", brushSize = 5, brushTool = "pencil", brushOpacity = 1 }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const [isPointerDown, setIsPointerDown] = useState(false);
        const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
        const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
        
        const undoStack = useRef<string[]>([]); 
        const redoStack = useRef<string[]>([]);

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Fill background white initially if empty
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Re-draw any initial strokes 
            redrawStrokes(initialStrokes);
        }, [initialStrokes]);

        const saveState = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            undoStack.current.push(canvas.toDataURL());
            if (undoStack.current.length > 30) undoStack.current.shift();
            redoStack.current = []; // Clear redo on new action
        }, []);

        const redrawStrokes = useCallback((strokes: StrokeData[]) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

             ctx.fillStyle = "#ffffff";
             ctx.fillRect(0, 0, canvas.width, canvas.height);

             strokes.forEach(s => drawStroke(s, canvas));
        }, []);

        const drawStroke = (stroke: StrokeData, canvas: HTMLCanvasElement) => {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            const w = canvas.width;
            const h = canvas.height;

            ctx.globalAlpha = stroke.opacity;
            ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
            ctx.fillStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            if (stroke.tool === "pencil" || stroke.tool === "eraser") {
                ctx.beginPath();
                ctx.moveTo(stroke.x0 * w, stroke.y0 * h);
                ctx.lineTo(stroke.x1 * w, stroke.y1 * h);
                ctx.stroke();
            } else if (stroke.tool === "rect-outline") {
                ctx.strokeRect(stroke.x0 * w, stroke.y0 * h, (stroke.x1 - stroke.x0) * w, (stroke.y1 - stroke.y0) * h);
            } else if (stroke.tool === "rect-fill") {
                ctx.fillRect(stroke.x0 * w, stroke.y0 * h, (stroke.x1 - stroke.x0) * w, (stroke.y1 - stroke.y0) * h);
            } else if (stroke.tool === "circle-outline" || stroke.tool === "circle-fill") {
                const rx = Math.abs(stroke.x1 - stroke.x0) * w / 2;
                const ry = Math.abs(stroke.y1 - stroke.y0) * h / 2;
                const cx = (stroke.x0 + stroke.x1) * w / 2;
                const cy = (stroke.y0 + stroke.y1) * h / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                if (stroke.tool === "circle-outline") ctx.stroke();
                else ctx.fill();
            } else if (stroke.tool === "bucket" || stroke.tool === "paint-bucket") {
                ctx.fillRect(0, 0, w, h);
            }
        };

        const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return { x: 0, y: 0 };
            return {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height
            };
        };

        const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsPointerDown(true);
            saveState();
            const pos = getPos(e);
            setStartPos(pos);
            setLastPos(pos);

            // Immediate draw for bucket
            if (brushTool === "bucket" || brushTool === "paint-bucket") {
                const canvas = canvasRef.current;
                if(canvas){
                    const stroke: StrokeData = { x0: 0, y0: 0, x1: 0, y1: 0, color: brushColor, size: 0, tool: brushTool, opacity: brushOpacity };
                    drawStroke(stroke, canvas);
                    onStrokeSubmit(stroke);
                }
            }
        };

        const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing || !isPointerDown || !lastPos || !startPos) return;
            e.preventDefault();

            const currentPos = getPos(e);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            if (brushTool === "pencil" || brushTool === "eraser") {
                const stroke: StrokeData = {
                    x0: lastPos.x, y0: lastPos.y,
                    x1: currentPos.x, y1: currentPos.y,
                    color: brushColor, size: brushSize, tool: brushTool, opacity: brushOpacity
                };
                drawStroke(stroke, canvas);
                onStrokeSubmit(stroke);
                setLastPos(currentPos);
            } else {
                // For shapes, we need to clear and redraw from the last saved state for "live preview"
                const tempImg = new Image();
                tempImg.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(tempImg, 0, 0);
                    // Draw live shape
                    const tempStroke: StrokeData = {
                        x0: startPos.x, y0: startPos.y,
                        x1: currentPos.x, y1: currentPos.y,
                        color: brushColor, size: brushSize, tool: brushTool, opacity: brushOpacity
                    };
                    drawStroke(tempStroke, canvas);
                };
                tempImg.src = undoStack.current[undoStack.current.length - 1];
            }
        };

        const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing || !isPointerDown || !startPos) return;
            e.preventDefault();
            e.currentTarget.releasePointerCapture(e.pointerId);

            const currentPos = getPos(e);
            // Finalize shape
            if (brushTool !== "pencil" && brushTool !== "eraser" && brushTool !== "bucket" && brushTool !== "paint-bucket") {
                const stroke: StrokeData = {
                    x0: startPos.x, y0: startPos.y,
                    x1: currentPos.x, y1: currentPos.y,
                    color: brushColor, size: brushSize, tool: brushTool, opacity: brushOpacity
                };
                onStrokeSubmit(stroke);
            }

            setIsPointerDown(false);
            setStartPos(null);
            setLastPos(null);
        };

        useImperativeHandle(ref, () => ({
            clear: () => {
                if (!isDrawing) return;
                saveState();
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            },
            undo: () => {
                if(!isDrawing || undoStack.current.length === 0) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if(!ctx) return;

                redoStack.current.push(canvas.toDataURL());
                const prevState = undoStack.current.pop();
                if (prevState) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0,0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0,0);
                    };
                    img.src = prevState;
                }
            },
            redo: () => {
                if(!isDrawing || redoStack.current.length === 0) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if(!ctx) return;

                undoStack.current.push(canvas.toDataURL());
                const nextState = redoStack.current.pop();
                if (nextState) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0,0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0,0);
                    };
                    img.src = nextState;
                }
            },
            fill: (c: string) => {
                if (!isDrawing) return;
                saveState();
                const stroke: StrokeData = { x0: 0, y0: 0, x1: 0, y1: 0, color: c, size: 0, tool: "bucket", opacity: brushOpacity };
                const canvas = canvasRef.current;
                if(canvas) {
                     drawStroke(stroke, canvas);
                     onStrokeSubmit(stroke);
                }
            },
            getImageData: () => {
                return canvasRef.current?.toDataURL("image/png") || "";
            }
        }));

        return (
            <div className="flex-1 w-full h-full relative border-8 border-white/50 rounded-[2rem] overflow-hidden bg-white group">
                {/* Canvas Background Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none select-none">
                     <h2 className="text-9xl font-black font-dofus tracking-tighter opacity-10">Gartic Phone</h2>
                </div>

                <canvas
                    ref={canvasRef}
                    width={1000}
                    height={750}
                    className={`w-full h-full touch-none ${!isDrawing && "opacity-80 pointer-events-none"}`}
                    style={{ aspectRatio: "4/3", cursor: isDrawing ? "crosshair" : "default" }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUpOrCancel}
                    onPointerCancel={handlePointerUpOrCancel}
                    onPointerLeave={handlePointerUpOrCancel}
                />
            </div>
        );
    }
);

GarticCanvas.displayName = "GarticCanvas";

