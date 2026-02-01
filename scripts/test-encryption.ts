import { encrypt, decrypt, isEncrypted } from "./src/lib/encryption";
import * as dotenv from "dotenv";

// Load environment to get ENCRYPTION_KEY
dotenv.config({ path: ".env.prod" });

async function testEncryption() {
    console.log("--- 🛡️ SIGILOS ENCRYPTION TEST ---");

    const secretData = "ma-super-cle-metamob-secrete-2026";
    console.log("Original Data:", secretData);

    try {
        // 1. Encrypt
        const encrypted = encrypt(secretData);
        console.log("Encrypted Data:", encrypted);

        if (!isEncrypted(encrypted)) {
            throw new Error("FAIL: Data is not in correct encrypted format (iv:tag:data)");
        }
        console.log("Format Check: PASSED ✅");

        // 2. Decrypt
        const decrypted = decrypt(encrypted);
        console.log("Decrypted Data:", decrypted);

        if (decrypted === secretData) {
            console.log("Integrity Check: PASSED ✅ (Data matches original)");
        } else {
            throw new Error("FAIL: Decrypted data does not match original!");
        }

        // 3. Lazy Migration Test (Should return original if not encrypted)
        const plainText = "un-texte-en-clair";
        if (decrypt(plainText) === plainText) {
            console.log("Lazy Migration Check: PASSED ✅ (Handles plain text safely)");
        }

    } catch (e) {
        console.error("❌ TEST FAILED:", e.message);
    }
}

testEncryption();
