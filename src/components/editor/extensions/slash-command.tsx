import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { uploadImageFile } from "../utils/image-upload";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import {
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    MessageSquareQuote,
    Code,
    CheckSquare,
    Image as ImageIcon,
    Type,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

const getSuggestionItems = ({ query }: { query: string }) => {
    return [
        {
            title: "Texte",
            description: "Commencez à écrire du texte brut.",
            searchTerms: ["p", "paragraph"],
            icon: <Type size={18} />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .toggleNode("paragraph", "paragraph")
                    .run();
            },
        },
        {
            title: "Titre 1",
            description: "Grand titre de section.",
            searchTerms: ["title", "big", "large"],
            icon: <Heading1 size={18} />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 1 })
                    .run();
            },
        },
        {
            title: "Titre 2",
            description: "Titre de sous-section.",
            searchTerms: ["subtitle", "medium"],
            icon: <Heading2 size={18} />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 2 })
                    .run();
            },
        },
        {
            title: "Titre 3",
            description: "Petit titre de sous-section.",
            searchTerms: ["subtitle", "small"],
            icon: <Heading3 size={18} />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 3 })
                    .run();
            },
        },
        {
            title: "Liste à puces",
            description: "Créer une simple liste à puces.",
            searchTerms: ["unordered", "point"],
            icon: <List size={18} />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleBulletList().run();
            },
        },
        {
            title: "Liste numérotée",
            description: "Créer une liste avec numérotation.",
            searchTerms: ["ordered"],
            icon: <ListOrdered size={18} />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleOrderedList().run();
            },
        },
        {
            title: "Citation",
            description: "Capturer une citation.",
            searchTerms: ["blockquote"],
            icon: <MessageSquareQuote size={18} />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .toggleNode("paragraph", "paragraph")
                    .toggleBlockquote()
                    .run();
            },
        },
        {
            title: "Code",
            description: "Capturer un snippet de code.",
            searchTerms: ["codeblock"],
            icon: <Code size={18} />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
            },
        },
        // --- ELITE CALLOUTS ---
        {
            title: "Note (Info)",
            description: "Information générale ou neutre.",
            searchTerms: ["info", "callout", "note"],
            icon: <Type size={18} className="text-info" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "info" }).run();
            },
        },
        {
            title: "Astuce (Tip)",
            description: "Conseils et bonnes pratiques.",
            searchTerms: ["tip", "hint", "astuce"],
            icon: <Type size={18} className="text-success" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "tip" }).run();
            },
        },
        {
            title: "Succès (Success)",
            description: "Confirmation ou réussite.",
            searchTerms: ["success", "done", "ok"],
            icon: <CheckSquare size={18} className="text-success" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "success" }).run();
            },
        },
        {
            title: "Question (FAQ)",
            description: "Interrogations ou FAQ.",
            searchTerms: ["question", "help", "faq"],
            icon: <MessageSquareQuote size={18} className="text-info" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "question" }).run();
            },
        },
        {
            title: "Important",
            description: "Point critique à ne pas manquer.",
            searchTerms: ["important", "alert", "must"],
            icon: <Heading1 size={18} className="text-info" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "important" }).run();
            },
        },
        {
            title: "Avertissement (Warning)",
            description: "Attention particulière requise.",
            searchTerms: ["warning", "warn", "attention"],
            icon: <Heading2 size={18} className="text-warning" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "warning" }).run();
            },
        },
        {
            title: "Danger / Erreur",
            description: "Risques élevés ou erreurs.",
            searchTerms: ["danger", "error", "stop"],
            icon: <Heading3 size={18} className="text-danger" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "danger" }).run();
            },
        },
        {
            title: "Bug",
            description: "Signalement d'un problème technique.",
            searchTerms: ["bug", "issue", "fix"],
            icon: <Code size={18} className="text-danger" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "bug" }).run();
            },
        },
        {
            title: "Todo (Liste de tâches)",
            description: "Choses à faire.",
            searchTerms: ["todo", "task", "plan"],
            icon: <List size={18} className="text-teal-400" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "todo" }).run();
            },
        },
        {
            title: "Résumé (Abstract)",
            description: "Introduction ou résumé global.",
            searchTerms: ["abstract", "summary", "intro"],
            icon: <MessageSquareQuote size={18} className="text-info" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).setCallout({ type: "abstract" }).run();
            },
        },
        // --- EMOJIS & SYMBOLS ---
        {
            title: "Emoji: Info",
            description: "💡 Ampoule / Idée",
            searchTerms: ["emoji", "bulb", "idea", "info"],
            icon: <div className="text-lg">💡</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("💡 ").run();
            },
        },
        {
            title: "Emoji: Succès",
            description: "✅ Validation",
            searchTerms: ["emoji", "check", "ok", "success"],
            icon: <div className="text-lg">✅</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("✅ ").run();
            },
        },
        {
            title: "Emoji: Warning",
            description: "⚠️ Attention",
            searchTerms: ["emoji", "warn", "warning", "attention"],
            icon: <div className="text-lg">⚠️</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("⚠️ ").run();
            },
        },
        {
            title: "Emoji: Rocket",
            description: "🚀 Performance / Start",
            searchTerms: ["emoji", "rocket", "fast", "start"],
            icon: <div className="text-lg">🚀</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("🚀 ").run();
            },
        },
        {
            title: "Emoji: Fire",
            description: "🔥 Populaire / Urgent",
            searchTerms: ["emoji", "fire", "hot", "urgent"],
            icon: <div className="text-lg">🔥</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("🔥 ").run();
            },
        },
        {
            title: "Emoji: Lock",
            description: "🔒 Sécurité / Privé",
            searchTerms: ["emoji", "lock", "security", "private"],
            icon: <div className="text-lg">🔒</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("🔒 ").run();
            },
        },
        {
            title: "Emoji: Sparkles",
            description: "✨ Nouveau / Magique",
            searchTerms: ["emoji", "sparkles", "new", "magic"],
            icon: <div className="text-lg">✨</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("✨ ").run();
            },
        },
        {
            title: "Emoji: Dofus (Diamond)",
            description: "💎 Premium / Rare",
            searchTerms: ["emoji", "diamond", "dofus", "premium", "rare"],
            icon: <div className="text-lg">💎</div>,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).insertContent("💎 ").run();
            },
        },
        {
            title: "Image",
            description: "Ajouter une image depuis votre ordinateur.",
            searchTerms: ["photo", "picture", "media", "image"],
            icon: <ImageIcon size={18} />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).run();
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async () => {
                    if (input.files?.length) {
                        const file = input.files[0];
                        const url = await uploadImageFile(file);
                        if (url) {
                            editor.chain().focus().setImage({ src: url }).run();
                        }
                    }
                };
                input.click();
            },
        },
    ].filter((item) => {
        if (typeof query === "string" && query.length > 0) {
            const search = query.toLowerCase();
            return (
                item.title.toLowerCase().includes(search) ||
                item.description.toLowerCase().includes(search) ||
                (item.searchTerms &&
                    item.searchTerms.some((term: string) => term.includes(search)))
            );
        }
        return true;
    });
};

export const CommandList = forwardRef((props: any, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === "ArrowUp") {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === "Enter") {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-md transition-all">
            {props.items.length ? (
                props.items.map((item: any, index: number) => (
                    <button
                        className={`flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-elevated ${index === selectedIndex ? "bg-elevated" : ""
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface">
                            {item.icon}
                        </div>
                        <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                    </button>
                ))
            ) : (
                <div className="p-2 text-muted-foreground text-sm">Aucun résultat</div>
            )}
        </div>
    );
});
CommandList.displayName = "CommandList";


const renderItems = () => {
    let component: any = null;
    let popup: any | null = null;

    return {
        onStart: (props: { editor: any; clientRect: any }) => {
            component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
            });

            if (!props.clientRect) {
                return;
            }

            // @ts-ignore
            popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
            });
        },
        onUpdate: (props: { editor: any; clientRect: any }) => {
            component?.updateProps(props);

            if (!props.clientRect) {
                return;
            }

            popup?.[0].setProps({
                getReferenceClientRect: props.clientRect,
            });
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === "Escape") {
                popup?.[0].hide();
                return true;
            }
            // @ts-ignore
            return component?.ref?.onKeyDown(props);
        },
        onExit: () => {
            popup?.[0].destroy();
            component?.destroy();
        },
    };
};

const SlashCommand = Extension.create({
    name: "slash-command",
    addOptions() {
        return {
            suggestion: {
                char: "/",
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
            },
        };
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export const configureSlashCommand = () => {
    return SlashCommand.configure({
        suggestion: {
            items: getSuggestionItems,
            render: renderItems,
        },
    });
};
