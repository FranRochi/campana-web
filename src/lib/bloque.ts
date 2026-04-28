export const BLOQUE_COLORS: Record<string, string> = {
  fp: "#62b5e5",
  jxc: "#ffb81c",
  lla: "#753bbd",
  otro: "#F28BB3",
  sd: "#BDBDBD",
};

export function getMunicipioBloque(frente?: string | null, partido?: string | null): string {
  const text = ((frente || "") + " " + (partido || "")).toUpperCase();
  if (/FUERZA PATRIA|UNION POR LA PATRIA|FRENTE PARA LA VICTORIA|FRENTE DE TODOS|KIRCHNER|PERONISMO/.test(text)) return "fp";
  if (/LIBERTAD AVANZA/.test(text)) return "lla";
  if (/JUNTOS POR EL CAMBIO|CAMBIEMOS|PROPUESTA REPUBLICANA|\bPRO\b|UCR|RADICAL/.test(text)) return "jxc";
  if (text.trim()) return "otro";
  return "sd";
}
