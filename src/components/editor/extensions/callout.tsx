import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutType = "info" | "tip" | "warning" | "danger";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        callout: {
            /**
             * Set a callout node
             */
            setCallout: (attributes?: { type: CalloutType }) => ReturnType;
            /**
             * Toggle a callout node
             */
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
                tag: 'div[data-type="callout"]',
            },
            {
                tag: "blockquote",
                priority: 51, // Higher than default blockquote
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
        return [
            "div",
            mergeAttributes(HTMLAttributes, {
                class: `callout callout-${HTMLAttributes["data-type"] || "info"} border-l-4 p-6 my-8 rounded-r-xl bg-white/5`,
                "data-type": HTMLAttributes["data-type"] || "info",
            }),
            0,
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
                                    content: [{ type: "text", text: (attributes?.type || "info").toUpperCase() + ": " }],
                                },
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
