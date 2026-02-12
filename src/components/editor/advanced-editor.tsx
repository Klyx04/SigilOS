"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
// import Image from "@tiptap/extension-image"; // Replaced by custom ResizableImage
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { configureSlashCommand } from "./extensions/slash-command";
import { ResizableImage } from "./extensions/resizable-image";
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Heading3,
    ImageIcon,
    Link as LinkIcon,
    Undo,
    Redo
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdvancedEditorProps {
    initialContent?: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

export function AdvancedEditor({ initialContent, onChange, editable = true }: AdvancedEditorProps) {
    // Force re-render on selection change to update toolbar state
    const [, forceUpdate] = useState(0);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            ResizableImage.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-primary underline decoration-primary/50 underline-offset-4 hover:decoration-primary transition-colors cursor-pointer",
                },
            }),
            Placeholder.configure({
                placeholder: "Tapez '/' pour les commandes ou commencez à écrire...",
            }),
            Typography,
            BubbleMenuExtension,
            configureSlashCommand(),
        ],
        content: initialContent,
        editable,
        editorProps: {
            attributes: {
                class: "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-2",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: () => {
            forceUpdate(n => n + 1);
        },
        onTransaction: () => {
            forceUpdate(n => n + 1);
        }
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="relative border border-white/10 rounded-lg bg-zinc-950/50 overflow-hidden flex flex-col min-h-[500px]">
            {/* TOOLBAR (Visible on top) */}
            {editable && (
                <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-zinc-900/90 backdrop-blur-md flex-wrap z-20 sticky top-0">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive("bold")}
                        icon={Bold}
                        tooltip="Gras (Ctrl+B)"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive("italic")}
                        icon={Italic}
                        tooltip="Italique (Ctrl+I)"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive("strike")}
                        icon={Strikethrough}
                        tooltip="Barré"
                    />
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive("heading", { level: 1 })}
                        icon={Heading1}
                        tooltip="Titre 1"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive("heading", { level: 2 })}
                        icon={Heading2}
                        tooltip="Titre 2"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive("heading", { level: 3 })}
                        icon={Heading3}
                        tooltip="Titre 3"
                    />
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive("bulletList")}
                        icon={List}
                        tooltip="Liste à puces"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive("orderedList")}
                        icon={ListOrdered}
                        tooltip="Liste numérotée"
                    />
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive("blockquote")}
                        icon={Quote}
                        tooltip="Citation"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive("codeBlock")}
                        icon={Code}
                        tooltip="Bloc de code"
                    />
                    <div className="w-px h-6 bg-white/10 mx-1 ml-auto" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        icon={Undo}
                        tooltip="Annuler"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        icon={Redo}
                        tooltip="Rétablir"
                    />
                </div>
            )}

            {/* BUBBLE MENU (Floating on selection) */}
            {editable && editor && (
                <EditorBubbleMenu editor={editor} />
            )}

            {/* EDITOR CONTENT */}
            <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} className="h-full" />
            </div>

            <style jsx global>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #71717a;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}

function ToolbarButton({
    onClick,
    isActive,
    disabled,
    icon: Icon,
    tooltip,
    size = "default"
}: {
    onClick: () => void,
    isActive?: boolean,
    disabled?: boolean,
    icon: any,
    tooltip?: string,
    size?: "default" | "sm"
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
                e.stopPropagation(); // Prevent bubbling issues
                onClick();
            }}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            disabled={disabled}
            className={cn(
                "h-8 w-8 p-0 transition-all",
                isActive
                    ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
                size === "sm" && "h-7 w-7"
            )}
            title={tooltip}
        >
            <Icon className={cn("w-4 h-4", size === "sm" && "w-3 h-3")} />
        </Button>
    )
}

function EditorBubbleMenu({ editor }: { editor: any }) {
    if (!editor) return null;

    return (
        <BubbleMenu editor={editor} className="flex overflow-hidden rounded-md border border-white/10 bg-zinc-900 shadow-xl">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
                icon={Bold}
                tooltip="Gras"
                size="sm"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
                icon={Italic}
                tooltip="Italique"
                size="sm"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive("strike")}
                icon={Strikethrough}
                tooltip="Barré"
                size="sm"
            />
            <div className="w-px bg-white/10 my-1" />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive("heading", { level: 2 })}
                icon={Heading2}
                tooltip="Titre 2"
                size="sm"
            />
        </BubbleMenu>
    )
}
