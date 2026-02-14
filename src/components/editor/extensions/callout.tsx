import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutType =
    | "info"
    | "tip"
    | "success"
    | "warning"
    | "caution"
    | "danger"
    | "error"
    | "important"
    | "note"
    | "abstract"
    | "question"
    | "bug"
    | "todo";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (attributes?: { type: CalloutType }) => ReturnType;
            toggleCallout: (attributes?: { type: CalloutType }) => ReturnType;
        };
    }
}

export const Callout = Node.create({
    name: "callout",
    group: "block",
    content: "block+",
    defining: true,

    addAttributes() {
        return {
            type: {
                default: "info",
                parseHTML: (element) => element.getAttribute("data-type") || "info",
                renderHTML: (attributes) => ({
                    "data-type": attributes.type,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[class*="callout"]',
                getAttrs: (node) => {
                    const element = node as HTMLElement;
                    const typeClass = Array.from(element.classList).find(c => c.startsWith('callout-'));
                    return { type: typeClass?.replace('callout-', '') || 'info' };
                }
            },
            {
                tag: "blockquote",
                priority: 51,
                getAttrs: (node) => {
                    const element = node as HTMLElement;
                    if (element.classList.contains("callout")) {
                        return { type: element.getAttribute("data-type") || "info" };
                    }
                    return false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const type = HTMLAttributes["data-type"] || "info";
        return [
            "div",
            mergeAttributes(HTMLAttributes, {
                class: `callout callout-${type} editor-callout`,
                "data-type": type,
            }),
            [
                "div",
                { class: "callout-label-wrapper not-prose" },
                ["strong", {}, type.toUpperCase()]
            ],
            ["div", { class: "callout-content" }, 0],
        ];
    },

    addCommands() {
        return {
            setCallout:
                (attributes) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: attributes,
                            content: [
                                {
                                    type: "paragraph",
                                }
                            ],
                        });
                    },
            toggleCallout:
                (attributes) =>
                    ({ commands }) => {
                        return commands.toggleNode(this.name, "paragraph", attributes);
                    },
        };
    },
});
