export const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL("image/png", 0.8);
};
