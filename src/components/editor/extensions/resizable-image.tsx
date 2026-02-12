import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

// 1. The React Component for the Node View
const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const [width, setWidth] = useState<number | string>(node.attrs.width || "100%");
    const [textAlign, setTextAlign] = useState<string>(node.attrs.textAlign || "center");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Sync local state with node attributes if they change externally (e.g. undo/redo)
    useEffect(() => {
        setWidth(node.attrs.width);
        setTextAlign(node.attrs.textAlign);
    }, [node.attrs.width, node.attrs.textAlign]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = containerRef.current?.offsetWidth || 0;

        const onMouseMove = (e: MouseEvent) => {
            const currentX = e.clientX;
            const diff = currentX - startX;
            const newWidth = Math.max(100, startWidth + diff); // Min 100px
            setWidth(`${newWidth}px`);
        };

        const onMouseUp = (e: MouseEvent) => {
            setIsResizing(false);
            const currentX = e.clientX;
            const diff = currentX - startX;
            const finalWidth = Math.max(100, startWidth + diff);

            updateAttributes({ width: `${finalWidth}px` });

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }, [updateAttributes]);

    const setAlignment = (align: 'left' | 'center' | 'right') => {
        setTextAlign(align);
        updateAttributes({ textAlign: align });
    };

    return (
        <NodeViewWrapper className="relative flex leading-none max-w-full my-4" style={{ justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center' }}>
            <div
                ref={containerRef}
                className={cn(
                    "relative transition-all duration-200 group",
                    (selected || isResizing) ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950 rounded-lg" : ""
                )}
                style={{ width: width }}
            >
                {/* Image */}
                <img
                    src={node.attrs.src}
                    alt={node.attrs.alt}
                    className="rounded-lg object-cover w-full h-auto"
                />

                {/* Controls (Visible on Selected) */}
                {(selected || isResizing) && (
                    <>
                        {/* Resize Handle */}
                        <div
                            className="absolute bottom-2 right-2 p-1 bg-zinc-900/80 backdrop-blur border border-white/20 rounded-md cursor-ew-resize hover:bg-indigo-500/80 transition-colors shadow-xl z-20"
                            onMouseDown={handleMouseDown}
                        >
                            <GripVertical className="w-4 h-4 text-white" />
                        </div>

                        {/* Alignment Toolbar */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur border border-white/20 rounded-md shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => { e.preventDefault(); setAlignment('left'); }} className={cn("p-1 rounded hover:bg-white/10", textAlign === 'left' && "bg-white/20 text-indigo-400")}>
                                <AlignLeft className="w-4 h-4 text-white" />
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); setAlignment('center'); }} className={cn("p-1 rounded hover:bg-white/10", textAlign === 'center' && "bg-white/20 text-indigo-400")}>
                                <AlignCenter className="w-4 h-4 text-white" />
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); setAlignment('right'); }} className={cn("p-1 rounded hover:bg-white/10", textAlign === 'right' && "bg-white/20 text-indigo-400")}>
                                <AlignRight className="w-4 h-4 text-white" />
                            </button>
                        </div>
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
            ...this.parent?.(),
            width: {
                default: "100%",
                renderHTML: (attributes) => {
                    return {
                        width: attributes.width,
                        style: `width: ${attributes.width}`
                    };
                },
            },
            textAlign: {
                default: 'center',
                renderHTML: (attributes) => {
                    return {
                        style: `text-align: ${attributes.textAlign}`
                    }
                }
            }
        };
    },
    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageComponent);
    },
});
