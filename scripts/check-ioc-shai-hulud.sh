#!/usr/bin/env bash
#
# check-ioc-shai-hulud.sh - Scan IOCs Shai-Hulud (keyv/cacheable, 2026-08-04)
#
# Detecte les implantations malveillantes du ver voleur de credentials npm
# (setup.mjs -> telecharge Bun -> execute Math_Symbol.js / math_init.js).
#
# << LOGIQUE DE DECISION (3 niveaux) - pour eviter tout faux positif >>
#   [PASS] : aucun fichier Math_Symbol.js / math_init.js associe a un hook,
#            ni setup.mjs contenant "execFileSync" + "bun" simultanement.
#   [INFO] : un setup.mjs existe sans la signature de contenu (exit 0).
#   [FAIL] : EXIT 1 - uniquement si les signatures COMBINEES sont presentes :
#              - un hook lifecycle (preinstall/install/postinstall) pointe vers setup.mjs
#                ET ce setup.mjs contient "execFileSync" ET "bun" ;
#              - OU Math_Symbol.js / math_init.js presents avec hook correspondant.
#
# << Whitelist explicite (justifiee) >>
#   - node_modules/motion-dom/.../setup.mjs : fonction setupGesture (AbortController),
#     aucun execFileSync/bun -> jamais bloquant.
#
# << Optimisation : UNE SEULE passe find (remonte ~3x plus vite en CI) >>
#   Toutes les cibles (setup.mjs, Math_Symbol.js, math_init.js, package.json) sont
#   collectees en un seul parcours d'arborescence, puis traitees immediatement.
#
# Usage : build local / CI : bash scripts/check-ioc-shai-hulud.sh [node_modules_dir]
# (defaut : node_modules). Ne modifie AUCUN fichier - lecture seule.
set -u

NODE_MODULES="${1:-node_modules}"

fail=0
warn=0

echo "[SCAN] Shai-Hulud IOC scan - cible: ${NODE_MODULES}"

# Lists to store findings (arrays)
PAYLOAD_FILES=()      # Math_Symbol.js / math_init.js
HOOKS_TO_SETUP=()     # package.json with preinstall/install/postinstall -> node setup.mjs
SETUP_MJS_WITH_SIG=() # setup.mjs containing execFileSync + bun (non-whitelisted)
INFO_SETUP_MJS=()     # setup.mjs present without dropper signature (non-whitelisted)

# ---- SINGLE PASS FIND ----
# One traversal; branch per filename. Avoids 3 full recursive walks.
while IFS= read -r f; do
    [ -z "$f" ] && continue

    case "$f" in
        */Math_Symbol.js|*/math_init.js)
            PAYLOAD_FILES+=("$f")
            ;;
        */package.json)
            # Hook lifecycle pointing to setup.mjs (the dropper)
            if grep -qE '"preinstall"[[:space:]]*:[[:space:]]*"node setup\.mjs"|"install"[[:space:]]*:[[:space:]]*"node setup\.mjs"|"postinstall"[[:space:]]*:[[:space:]]*"node setup\.mjs"' "$f" 2>/dev/null; then
                HOOKS_TO_SETUP+=("$f")
            fi
            ;;
        */setup.mjs)
            # Whitelist justifiee : setupGesture (AbortController), pas de dropper.
            case "$f" in
                */motion-dom/dist/es/gestures/utils/setup.mjs) continue ;;
            esac
            # Signature de contenu : execFileSync + reference a bun (runtime dropper)
            if grep -qE "execFileSync" "$f" 2>/dev/null && grep -qiE "[^a-z]bun[^a-z]|bun-v|/bun" "$f" 2>/dev/null; then
                SETUP_MJS_WITH_SIG+=("$f")
            else
                INFO_SETUP_MJS+=("$f")
            fi
            ;;
    esac
done < <(find "${NODE_MODULES}" -type f \( -name "setup.mjs" -o -name "Math_Symbol.js" -o -name "math_init.js" -o -name "package.json" \) 2>/dev/null || true)

# ---- Decision combinee -----------------------------------------------------

# a) payload connu (Math_Symbol.js / math_init.js) -> bloquant
if [ "${#PAYLOAD_FILES[@]}" -gt 0 ]; then
    echo "[FAIL] payload Shai-Hulud detecte (Math_Symbol.js / math_init.js):" >&2
    printf '    - %s\n' "${PAYLOAD_FILES[@]}" >&2
    fail=1
fi

# b) hook setup.mjs + signature de contenu -> dropper bloquant
if [ "${#HOOKS_TO_SETUP[@]}" -gt 0 ] && [ "${#SETUP_MJS_WITH_SIG[@]}" -gt 0 ]; then
    echo "[FAIL] dropper setup.mjs (hook + execFileSync + bun) detecte:" >&2
    printf '    hook -> %s\n' "${HOOKS_TO_SETUP[@]}" >&2
    printf '    file -> %s\n' "${SETUP_MJS_WITH_SIG[@]}" >&2
    fail=1
fi

# c) info : setup.mjs present sans signature de contenu (non-bloquant)
if [ "${#INFO_SETUP_MJS[@]}" -gt 0 ]; then
    echo "[INFO] setup.mjs present sans signature de dropper (non bloquant):"
    printf '    - %s\n' "${INFO_SETUP_MJS[@]}"
    warn=1
fi

# ---- Bilan ------------------------------------------------------------------
if [ "$fail" -eq 1 ]; then
    echo ""
    echo "[ECHEC] signatures Shai-Hulud detectees - verifiez immediatement." >&2
    echo "[!] Ne revoquez AUCUN token tant que la machine n'est pas nettoyee" >&2
    echo "[!] (dead-man's switch : gh-token-monitor)." >&2
    exit 1
fi

if [ "$warn" -eq 1 ]; then
    echo "[OK] Termine avec des avertissements (non bloquant)."
else
    echo "[OK] Aucun IOC Shai-Hulud detecte."
fi
exit 0