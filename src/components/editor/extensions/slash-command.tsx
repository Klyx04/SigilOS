import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
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
        // {
        //   title: "Image",
        //   description: "Upload an image from your computer.",
        //   searchTerms: ["photo", "picture", "media"],
        //   icon: <ImageIcon size={18} />,
        //   command: ({ editor, range }: any) => {
        //     editor.chain().focus().deleteRange(range).run();
        //     // upload image
        //     const input = document.createElement("input");
        //     input.type = "file";
        //     input.accept = "image/*";
        //     input.onchange = async () => {
        //       if (input.files?.length) {
        //         const file = input.files[0];
        //         const pos = editor.view.state.selection.from;
        //         // Should create logic for uploading here or triggering external upload logic
        //         // Since we don't have direct access here easily without configuring props
        //         // We might implement drag and drop separately.
        //         // For now, simpler to just rely on paste/drag for images or a button.
        //       }
        //     };
        //     input.click();
        //   },
        // },
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
        <div className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 p-1 shadow-md transition-all">
            {props.items.length ? (
                props.items.map((item: any, index: number) => (
                    <button
                        className={`flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm text-zinc-100 hover:bg-zinc-800 ${index === selectedIndex ? "bg-zinc-800" : ""
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-zinc-900">
                            {item.icon}
                        </div>
                        <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-zinc-400">{item.description}</p>
                        </div>
                    </button>
                ))
            ) : (
                <div className="p-2 text-zinc-500 text-sm">Aucun résultat</div>
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
