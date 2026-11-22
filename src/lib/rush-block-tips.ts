/**
 * Conseils d un BLOC : la trame y met parfois le programme complet, une ligne par `*`.
 *
 * On ne jette rien : on retire seulement la puce de source (`*`, `•`, `- `) et on
 * decoupe en lignes — le rendu decide ensuite du repli (3 lignes + « voir tout »).
 */
export function parseBlockTips(text: string | null | undefined): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[*•·]|[-–]\s)\s*/, "").trim())
    .filter((line) => line.length > 0);
}