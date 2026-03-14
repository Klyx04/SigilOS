export const HONEYPOT_FIELD_NAME = "hp_ignore_field";

/**
 * Validate honeypot field
 * Returns true if it's a human (field is empty), false if it's a bot (field is filled)
 */
export function validateHoneypot(formData: FormData | Record<string, any>): boolean {
    const value = formData instanceof FormData 
        ? formData.get(HONEYPOT_FIELD_NAME) 
        : formData[HONEYPOT_FIELD_NAME];
    
    // If the field is present and NOT empty, it's likely a bot
    return !value;
}
