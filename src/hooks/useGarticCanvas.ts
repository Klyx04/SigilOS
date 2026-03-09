"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Socket } from "socket.io-client";
import { DrawTool, StrokeData } from "../types/socket-events";

interface UseGarticCanvasOptions {
    isDrawer: boolean;
    socket: Socket;
    roomId: string;
}

function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
    let inThrottle: boolean;
    return function (this: any, ...args: any[]) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    } as T;
}

const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

const colorsMatch = (c1: number[], c2: number[]) => {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];
};

const getPixelColor = (data: Uint8ClampedArray, x: number, y: number, width: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]; // include alpha if needed, but we keep it simple
};

const setPixelColor = (data: Uint8ClampedArray, x: number, y: number, width: number, color: number[]) => {
    const i = (y * width + x) * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = 255;
};

export const useGarticCanvas = ({ isDrawer, socket, roomId }: UseGarticCanvasOptions) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(-1);

    const [tool, setTool] = useState<DrawTool>("pencil");
    const [color, setColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(3);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.imageSmoothingEnabled = true;
        ctxRef.current = ctx;

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        saveToHistory();
    }, []);

    const getRelativePos = useCallback((e: PointerEvent | MouseEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    }, []);

    const drawStroke = useCallback((stroke: StrokeData) => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        const x0 = stroke.x0 * canvas.width;
        const y0 = stroke.y0 * canvas.height;
        const x1 = stroke.x1 * canvas.width;
        const y1 = stroke.y1 * canvas.height;

        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
        ctx.lineWidth = stroke.size;

        switch (stroke.tool) {
            case "pencil":
            case "eraser":
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                break;

            case "rect-outline":
                ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                break;

            case "rect-fill":
                ctx.fillStyle = stroke.color;
                ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                break;

            case "circle-outline":
                ctx.beginPath();
                ctx.ellipse(
                    (x0 + x1) / 2, (y0 + y1) / 2,
                    Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2,
                    0, 0, Math.PI * 2
                );
                ctx.stroke();
                break;

            case "circle-fill":
                ctx.beginPath();
                ctx.fillStyle = stroke.color;
                ctx.ellipse(
                    (x0 + x1) / 2, (y0 + y1) / 2,
                    Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2,
                    0, 0, Math.PI * 2
                );
                ctx.fill();
                break;

            case "bezier":
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                break;

            case "bucket":
            case "paint-bucket":
                floodFill(ctx, canvas, Math.round(x0), Math.round(y0), stroke.color);
                break;
        }

        ctx.globalAlpha = 1;
    }, []);

    const floodFill = (
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        startX: number,
        startY: number,
        fillColor: string
    ) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const targetColor = getPixelColor(data, startX, startY, canvas.width);
        const fill = hexToRgb(fillColor);

        if (!fill || colorsMatch(targetColor, fill)) return;

        const stack = [[startX, startY]];
        const visited = new Set<string>();

        while (stack.length > 0) {
            const [x, y] = stack.pop()!;
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

            const current = getPixelColor(data, x, y, canvas.width);
            if (!colorsMatch(current, targetColor)) continue;

            visited.add(key);
            setPixelColor(data, x, y, canvas.width, fill);

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        ctx.putImageData(imageData, 0, 0);
    };

    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        historyIndexRef.current = historyRef.current.length - 1;

        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(false);
    }, []);

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current--;
        ctxRef.current!.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(true);
        if (socket) socket.emit("gartic:draw:undo");
    }, [socket]);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        ctxRef.current!.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
        setCanUndo(true);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }, []);

    const clear = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
        if (socket) socket.emit("gartic:draw:clear");
    }, [socket, saveToHistory]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!isDrawer) return;
        isDrawingRef.current = true;
        const pos = getRelativePos(e.nativeEvent);
        lastPointRef.current = pos;

        if (tool === "bucket" || tool === "paint-bucket") {
            const stroke: StrokeData = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, color, size: brushSize, tool, opacity: 1 };
            drawStroke(stroke);
            if (socket) socket.emit("gartic:draw:stroke", stroke);
            saveToHistory();
        }
    }, [isDrawer, tool, color, brushSize, drawStroke, saveToHistory, getRelativePos, socket]);

    const handlePointerMove = useMemo(() => throttle((e: React.PointerEvent) => {
        if (!isDrawer || !isDrawingRef.current) return;
        if (tool === "bucket" || tool === "paint-bucket") return;

        const pos = getRelativePos(e.nativeEvent);
        const last = lastPointRef.current ?? pos;

        const stroke: StrokeData = {
            x0: last.x, y0: last.y,
            x1: pos.x, y1: pos.y,
            color, size: brushSize, tool,
            opacity: tool === "eraser" ? 1 : 0.9,
        };

        if (["pencil", "eraser"].includes(tool)) {
            drawStroke(stroke);
            lastPointRef.current = pos;
        }

        if (socket) socket.emit("gartic:draw:stroke", stroke);
    }, 16), [isDrawer, tool, color, brushSize, drawStroke, getRelativePos, socket]);

    const handlePointerUp = useCallback(() => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        lastPointRef.current = null;
        saveToHistory();
    }, [saveToHistory]);

    useEffect(() => {
        if (!socket) return;
        socket.on("gartic:draw:stroke", drawStroke);
        socket.on("gartic:draw:clear", () => {
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
        socket.on("gartic:draw:history", (history: StrokeData[]) => {
            history.forEach(drawStroke);
        });

        return () => {
            socket.off("gartic:draw:stroke");
            socket.off("gartic:draw:clear");
            socket.off("gartic:draw:history");
        };
    }, [socket, drawStroke]);

    return {
        canvasRef,
        overlayRef,
        tool, setTool,
        color, setColor,
        brushSize, setBrushSize,
        canUndo, canRedo,
        undo, redo, clear,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
        },
    };
};
