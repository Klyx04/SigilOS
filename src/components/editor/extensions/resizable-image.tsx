import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

// 1. The React Component for the Node View
const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const [width, setWidth] = useState<number | string>(node.attrs.width || "100%");
    const [layout, setLayout] = useState<'block' | 'left' | 'right' | 'full'>(node.attrs.layout || "block");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        setWidth(node.attrs.width || "100%");
        setLayout(node.attrs.layout || "block");
    }, [node.attrs.width, node.attrs.layout]);

    const handleResize = useCallback((e: React.MouseEvent, direction: 'left' | 'right') => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = containerRef.current?.offsetWidth || 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.clientX;
            const diff = direction === 'right' ? (currentX - startX) : (startX - currentX);
            const newWidth = Math.max(100, startWidth + diff * 2); // Double for symmetrical scaling if centered

            // If block or full, we limit to container width
            const maxWidth = containerRef.current?.parentElement?.offsetWidth || 1000;
            const finalNewWidth = Math.min(maxWidth, newWidth);

            setWidth(`${finalNewWidth}px`);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            const finalWidth = containerRef.current?.style.width || "100%";
            updateAttributes({ width: finalWidth });

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }, [updateAttributes]);

    const handleLayoutChange = (newLayout: 'block' | 'left' | 'right' | 'full') => {
        setLayout(newLayout);
        const attrs: any = { layout: newLayout };
        if (newLayout === 'full') attrs.width = '100%';
        updateAttributes(attrs);
    };

    return (
        <NodeViewWrapper
            className={cn(
                "relative leading-none max-w-full my-8 flex transition-all duration-300",
                layout === 'left' ? "justify-start" :
                    layout === 'right' ? "justify-end" :
                        "justify-center"
            )}
        >
            <div
                ref={containerRef}
                className={cn(
                    "relative group",
                    layout === 'left' ? "float-left mr-8 mb-4 clear-left" :
                        layout === 'right' ? "float-right ml-8 mb-4 clear-right" :
                            layout === 'full' ? "w-full clear-both" : "clear-both",
                    (selected || isResizing) ? "ring-4 ring-indigo-500/50 rounded-2xl" : ""
                )}
                style={{ width: layout === 'full' ? '100%' : width }}
            >
                {/* 🖼️ IMAGE */}
                <img
                    src={node.attrs.src}
                    alt={node.attrs.src}
                    className={cn(
                        "rounded-2xl object-contain transition-opacity max-h-[70vh] w-full",
                        isResizing ? "opacity-50" : "opacity-100"
                    )}
                />

                {/* 🛠️ OVERLAY CONTROLS */}
                {(selected || isResizing) && (
                    <>
                        {/* Alignment Toolbar */}
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-200">
                            {[
                                { id: 'left', icon: AlignLeft, label: 'Gauche' },
                                { id: 'block', icon: AlignCenter, label: 'Centré' },
                                { id: 'right', icon: AlignRight, label: 'Droite' },
                                { id: 'full', icon: GripVertical, label: 'Pleine Largeur' }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => handleLayoutChange(mode.id as any)}
                                    className={cn(
                                        "p-2 rounded-lg transition-all",
                                        layout === mode.id ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white hover:bg-white/10"
                                    )}
                                    title={mode.label}
                                >
                                    <mode.icon className="w-4 h-4" />
                                </button>
                            ))}
                        </div>

                        {/* Resize Handles (Pro style) */}
                        {layout !== 'full' && (
                            <>
                                <div
                                    className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 flex items-center justify-center bg-indigo-500 rounded-lg cursor-ew-resize shadow-xl hover:scale-110 transition-transform z-20"
                                    onMouseDown={(e) => handleResize(e, 'right')}
                                >
                                    <div className="w-1 h-4 bg-white/40 rounded-full" />
                                </div>
                                <div
                                    className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 flex items-center justify-center bg-indigo-500 rounded-lg cursor-ew-resize shadow-xl hover:scale-110 transition-transform z-20"
                                    onMouseDown={(e) => handleResize(e, 'left')}
                                >
                                    <div className="w-1 h-4 bg-white/40 rounded-full" />
                                </div>
                            </>
                        )}

                        {/* Size Label */}
                        {isResizing && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-zinc-900 border border-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                                {typeof width === 'number' ? width : parseInt(width.toString()) || 0}px
                            </div>
                        )}
                    </>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// 2. The Tiptap Extension
export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: element => element.getAttribute('src'),
            },
            alt: {
                default: null,
                parseHTML: element => element.getAttribute('alt'),
            },
            width: {
                default: '100%',
                parseHTML: element => element.style.width || element.getAttribute('data-width') || "100%",
            },
            layout: {
                default: 'block',
                parseHTML: element => (element.getAttribute('data-layout') as any) || "block",
            },
        };
    },
    renderHTML({ HTMLAttributes }) {
        const { src, alt, width, layout } = HTMLAttributes;
        const styles: string[] = [];

        if (width) styles.push(`width: ${width}`);
        styles.push('max-width: 100%');

        if (layout === 'left') styles.push('float: left', 'margin-right: 1.5rem', 'margin-bottom: 1rem', 'clear: left');
        else if (layout === 'right') styles.push('float: right', 'margin-left: 1.5rem', 'margin-bottom: 1rem', 'clear: right');
        else if (layout === 'block') styles.push('margin: 1.5rem auto', 'display: block', 'clear: both');

        return [
            'img',
            {
                src,
                alt,
                style: styles.join('; '),
                'data-layout': layout,
                'data-width': width,
            }
        ];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageComponent);
    },
});
