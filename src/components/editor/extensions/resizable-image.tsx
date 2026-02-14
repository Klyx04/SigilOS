import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

// 1. The React Component for the Node View
const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const [width, setWidth] = useState<number | string>(node.attrs.width || "100%");
    const [layout, setLayout] = useState<'block' | 'left' | 'right'>(node.attrs.layout || "block");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Sync local state with node attributes if they change externally (e.g. undo/redo)
    useEffect(() => {
        setWidth(node.attrs.width);
        setLayout(node.attrs.layout || "block");
    }, [node.attrs.width, node.attrs.layout]);

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

    const setLayoutMode = (mode: 'block' | 'left' | 'right') => {
        setLayout(mode);
        updateAttributes({ layout: mode });
    };

    return (
        <NodeViewWrapper
            className={cn(
                "relative leading-none max-w-full my-4 transition-all duration-300",
                layout === 'left' ? "float-left mr-6 mb-4 clear-left" :
                    layout === 'right' ? "float-right ml-6 mb-4 clear-right" :
                        "flex justify-center flex-col items-center clear-both"
            )}
        >
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
