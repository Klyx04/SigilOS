import { HONEYPOT_FIELD_NAME } from "@/lib/honeypot";

/**
 * Honeypot component to deter automated spam bots.
 * Renders an input that is invisible to humans but visible to bots.
 */
export function Honeypot() {
    return (
        <div 
            aria-hidden="true" 
            style={{ 
                position: "absolute", 
                opacity: 0, 
                top: 0, 
                left: 0, 
                height: 0, 
                width: 0, 
                zIndex: -1,
                overflow: "hidden",
                pointerEvents: "none"
            }}
        >
            <label htmlFor={HONEYPOT_FIELD_NAME}>Do not fill this field</label>
            <input
                id={HONEYPOT_FIELD_NAME}
                name={HONEYPOT_FIELD_NAME}
                type="text"
                tabIndex={-1}
                autoComplete="off"
            />
        </div>
    );
}
