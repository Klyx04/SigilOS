"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { configureSlashCommand } from "./extensions/slash-command";
import { ResizableImage } from "./extensions/resizable-image";
import { uploadImageFile } from "./utils/image-upload";
import { Callout } from "./extensions/callout";
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
    Undo,
    Redo,
    Smile,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Palette,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { EmojiPicker } from "./emoji-picker";

interface AdvancedEditorProps {
    initialContent?: string;
    onChange: (content: string) => void;
    editable?: boolean;
    contentClassName?: string;
}

export function AdvancedEditor({ initialContent, onChange, editable = true, contentClassName }: AdvancedEditorProps) {
    // Force re-render on selection change to update toolbar state
    const [, forceUpdate] = useState(0);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                // Prevent duplicate with standalone Link extension
                link: false,
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
            configureSlashCommand(),
            Callout,
            TextStyle,
            Color,
        ],
        content: initialContent,
        editable,
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-2",
                    contentClassName
                ),
            },
            handlePaste: (view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) {
                            uploadImageFile(file).then((url) => {
                                if (url && editor) {
                                    editor.chain().focus().setImage({ src: url }).run();
                                }
                            });
                        }
                        return true;
                    }
                }
                return false;
            },
            handleDrop: (view, event) => {
                const files = event.dataTransfer?.files;
                if (!files?.length) return false;

                const imageFile = Array.from(files).find(f => f.type.startsWith("image/"));
                if (imageFile) {
                    event.preventDefault();
                    uploadImageFile(imageFile).then((url) => {
                        if (url && editor) {
                            editor.chain().focus().setImage({ src: url }).run();
                        }
                    });
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: () => {
            forceUpdate(n => n + 1);
        }
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="relative border border-border rounded-2xl bg-background/50 flex flex-col h-full overflow-hidden shadow-2xl">
            {/* TOOLBAR (Sticky at top of editor) */}
            {editable && (
                <div className="flex items-center gap-1 p-2 border-b border-border bg-surface/95 backdrop-blur-md flex-wrap z-20">
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
                    <div className="w-px h-6 bg-surface mx-1" />
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
                    <div className="w-px h-6 bg-surface mx-1" />
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
                    <div className="w-px h-6 bg-surface mx-1" />
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
                    <div className="w-px h-6 bg-surface mx-1" />
                    <input
                        type="color"
                        onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                        value={editor.getAttributes('textStyle').color || '#ffffff'}
                        className="w-8 h-8 rounded-lg bg-surface border border-border cursor-pointer p-1 hover:bg-surface transition-colors"
                        title="Couleur du texte"
                    />
                    <ToolbarButton
                        onClick={() => {
                            const url = window.prompt("Entrez l'URL de l'image (ou laissez vide pour uploader):");
                            if (url) {
                                editor.chain().focus().setImage({ src: url }).run();
                                return;
                            }

                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.onchange = async () => {
                                if (input.files?.length) {
                                    const file = input.files[0];
                                    const uploadedUrl = await uploadImageFile(file);
                                    if (uploadedUrl) {
                                        editor.chain().focus().setImage({ src: uploadedUrl }).run();
                                    }
                                }
                            };
                            input.click();
                        }}
                        icon={ImageIcon}
                        tooltip="Insérer une image (Fichier ou URL)"
                    />
                    <EmojiPicker onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />
                    <div className="w-px h-6 bg-surface mx-1 ml-auto" />
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
                <UnifiedBubbleMenu key="unified-editor-menu" editor={editor} />
            )}

            {/* EDITOR CONTENT (Scrollable area) */}
            <div className="flex-1 overflow-y-auto cursor-text bg-background/20" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} className="min-h-full pb-32" />
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
                onClick();
            }}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            disabled={disabled}
            className={cn(
                "h-8 w-8 p-0 transition-all",
                isActive
                    ? "bg-info/20 text-info hover:bg-info/30"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                size === "sm" && "h-7 w-7"
            )}
            title={tooltip}
        >
            <Icon className={cn("w-4 h-4", size === "sm" && "w-3 h-3")} />
        </Button>
    )
}

function UnifiedBubbleMenu({ editor }: { editor: any }) {
    if (!editor) return null;

    const isImage = editor.isActive("image");

    return (
        <BubbleMenu
            pluginKey="unified-menu-v3"
            editor={editor}
            className="flex items-center gap-1 overflow-hidden rounded-xl border border-border bg-surface/95 backdrop-blur-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200"
            shouldShow={({ from, to }: any) => {
                // Determine if we should show the menu
                const isSelection = from !== to;
                const isImg = editor.isActive("image");
                return isImg || isSelection;
            }}
        >
            {isImage ? (
                <>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); editor.chain().focus().updateAttributes("image", { layout: 'left' }).run(); }}
                        className={cn("p-2 rounded-lg transition-all hover:bg-surface", editor.getAttributes("image").layout === 'left' ? "bg-info/20 text-info" : "text-muted-foreground")}
                        title="Aligner à gauche (Habillage texte)"
                    >
                        <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); editor.chain().focus().updateAttributes("image", { layout: 'block' }).run(); }}
                        className={cn("p-2 rounded-lg transition-all hover:bg-surface", (editor.getAttributes("image").layout === 'block' || !editor.getAttributes("image").layout) ? "bg-info/20 text-info" : "text-muted-foreground")}
                        title="Centrer (Bloc)"
                    >
                        <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); editor.chain().focus().updateAttributes("image", { layout: 'right' }).run(); }}
                        className={cn("p-2 rounded-lg transition-all hover:bg-surface", editor.getAttributes("image").layout === 'right' ? "bg-info/20 text-info" : "text-muted-foreground")}
                        title="Aligner à droite (Habillage texte)"
                    >
                        <AlignRight className="w-4 h-4" />
                    </button>
                </>
            ) : (
                <>
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
                    <div className="w-px h-4 bg-surface mx-1" />
                    <input
                        type="color"
                        onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                        value={editor.getAttributes('textStyle').color || '#ffffff'}
                        className="w-6 h-6 rounded-md bg-background border border-border cursor-pointer p-0.5"
                    />
                    <EmojiPicker onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />
                </>
            )}
        </BubbleMenu>
    )
}

