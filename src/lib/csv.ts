/** Une cellule CSV : entre guillemets si elle contient séparateur, guillemet ou saut de ligne ; neutralise les formules Excel. */
export function csvCell(value: unknown, separator = ';'): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Une cellule qui commence par = + - @ serait interprétée comme une formule par Excel : on la rend inoffensive.
  if (/^[=+\-@]/.test(text) && !/^[+-]?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return text.includes(separator) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV avec « ; » (Excel en français) et BOM UTF-8 pour que les accents et l'arabe s'affichent correctement. */
export function buildCsv(headers: string[], rows: unknown[][], separator = ';'): string {
  const lines = [headers, ...rows].map((line) => line.map((cell) => csvCell(cell, separator)).join(separator));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Télécharge un fichier texte depuis le navigateur ; sans effet hors navigateur. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
