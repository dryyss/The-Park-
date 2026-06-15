/** Dégradés d'avatar par initiale (alignés sur les maquettes). */
export const AVATAR_GRADIENTS: Record<string, string> = {
  L: "linear-gradient(135deg,#D81B60,#7A0F37)",
  M: "linear-gradient(135deg,#6FE3D0,#1F8C7A)",
  D: "linear-gradient(135deg,#4FA3FF,#1F4E8C)",
  S: "linear-gradient(135deg,#B05CFF,#5A1F8C)",
  T: "linear-gradient(135deg,#E8B23A,#8C641F)",
  H: "linear-gradient(135deg,#FF6B5E,#8C2F1F)",
  R: "linear-gradient(135deg,#E8B23A,#8C641F)",
  K: "linear-gradient(135deg,#D81B60,#7A0F37)",
  N: "linear-gradient(135deg,#9BA3B2,#45454E)",
  B: "linear-gradient(135deg,#5ED99A,#1F8C5A)",
};

export function avatarGradient(initial: string): string {
  return AVATAR_GRADIENTS[initial.toUpperCase()] ?? AVATAR_GRADIENTS.L;
}
