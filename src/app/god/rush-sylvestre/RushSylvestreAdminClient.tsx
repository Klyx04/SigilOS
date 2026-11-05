"use client";

/**
 * Coquille mince du studio God « Rush Sylvestre » (E1, 05/11/2026).
 *
 * Le studio vit désormais **hors** de `src/app/god/**` :
 *  ① le plafond `god-deslop` est à **77/77** fichiers — aucun fichier God neuf ;
 *  ② la refonte E1→E5 découpe le studio par lot dans `src/components/god/rush-editor/`.
 *
 * Ce fichier ne porte plus que la **frontière `"use client"`** attendue par `page.tsx`.
 */
export { RushSylvestreAdminClient } from "@/components/god/rush-editor/RushEditorStudio";
