export const DOFUS_AVATARS = [
  { id: 0,  name: "Iop",         emoji: "⚔️",  color: "#E74C3C" },
  { id: 1,  name: "Cra",         emoji: "🏹",  color: "#27AE60" },
  { id: 2,  name: "Eniripsa",    emoji: "💚",  color: "#1ABC9C" },
  { id: 3,  name: "Xelor",       emoji: "⏰",  color: "#8E44AD" },
  { id: 4,  name: "Osamodas",    emoji: "🐉",  color: "#2ECC71" },
  { id: 5,  name: "Sadida",      emoji: "🌿",  color: "#16A085" },
  { id: 6,  name: "Ecaflip",     emoji: "🎲",  color: "#F39C12" },
  { id: 7,  name: "Enutrof",     emoji: "💰",  color: "#D4AC0D" },
  { id: 8,  name: "Sram",        emoji: "💀",  color: "#2C3E50" },
  { id: 9,  name: "Feca",        emoji: "🛡️",  color: "#2980B9" },
  { id: 10, name: "Pandawa",     emoji: "🍶",  color: "#E67E22" },
  { id: 11, name: "Sacrieur",    emoji: "🩸",  color: "#C0392B" },
  { id: 12, name: "Eliotrope",   emoji: "🌀",  color: "#9B59B6" },
  { id: 13, name: "Huppermage",  emoji: "🔮",  color: "#3498DB" },
  { id: 14, name: "Ouginak",     emoji: "🐾",  color: "#795548" },
  { id: 15, name: "Steamer",     emoji: "⚙️",  color: "#607D8B" },
  { id: 16, name: "Roublard",    emoji: "💣",  color: "#FF5722" },
  { id: 17, name: "Zobal",       emoji: "🎭",  color: "#9C27B0" },
  { id: 18, name: "Masqueraider",emoji: "🎪",  color: "#E91E63" },
  { id: 19, name: "Forgelance",  emoji: "🔱",  color: "#FF9800" },
];

export function getDofusAvatar(seed: string) {
    let hash = 0;
    if (!seed) seed = "default";
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return DOFUS_AVATARS[Math.abs(hash) % DOFUS_AVATARS.length];
}
