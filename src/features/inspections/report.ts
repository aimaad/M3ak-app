import { chargeableDamages, countDamages, effectiveCost, sortDamages, totalCharge, type Damage } from './damages';

export type ReportPhoto = { angle: string; depart: string | null; retour: string | null };

export type ReportData = {
  language: 'fr' | 'ar';
  agencyName: string;
  agencyPhone: string | null;
  rentalNumber: string;
  vehicleLabel: string;
  plate: string;
  customerName: string;
  dateInspection: string;
  kmDepart: number | null;
  kmRetour: number | null;
  fuelDepart: number | null;
  fuelRetour: number | null;
  damages: Damage[];
  /** Caution : null si la location n'en a pas. */
  deposit: { bloque: number; retenu: number } | null;
  /** Photos (déjà réduites, en data URI) des dommages imputables : une paire départ / retour par angle. */
  photos: ReportPhoto[];
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (iso: string) => string;
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const mad = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} MAD`;

/** Dommages repris dans le rapport : tout ce qui n'a pas été rejeté par l'employé. */
export function reportDamages(damages: Damage[]): Damage[] {
  return sortDamages(damages.filter((damage) => damage.statut !== 'rejete'));
}

/** Message WhatsApp : court, sans photos, avec la synthèse et la retenue. */
export function whatsappMessage(data: Pick<ReportData, 'agencyName' | 'vehicleLabel' | 'plate' | 'damages' | 'deposit' | 't'>): string {
  const { t } = data;
  const charge = totalCharge(data.damages);
  const lines = [
    t('inspection.report.whatsapp.greeting', { agency: data.agencyName }),
    t('inspection.report.whatsapp.vehicle', { vehicle: data.vehicleLabel, plate: data.plate }),
  ];
  const nouveaux = chargeableDamages(data.damages);
  if (nouveaux.length === 0) {
    lines.push(t('inspection.report.whatsapp.noDamage'));
  } else {
    lines.push(t('inspection.report.whatsapp.damages', { count: nouveaux.length }));
    for (const damage of nouveaux) {
      lines.push(`• ${t(`inspection.analysis.zonesLabel.${damage.zone}`)} — ${t(`inspection.analysis.types.${damage.type}`)} (${mad(effectiveCost(damage))})`);
    }
    lines.push(t('inspection.report.whatsapp.total', { amount: mad(charge) }));
    if (data.deposit) lines.push(t('inspection.report.whatsapp.deposit', { deposit: mad(data.deposit.bloque), rest: mad(Math.max(data.deposit.bloque - data.deposit.retenu, 0)) }));
  }
  lines.push(t('inspection.report.whatsapp.attached'));
  return lines.join('\n');
}

/** Rapport d'inspection de retour (A4) : synthèse, dommages détaillés avec photos, retenue sur la caution. */
export function buildReportHtml(data: ReportData): string {
  const { t } = data;
  const rtl = data.language === 'ar';
  const counts = countDamages(data.damages);
  const listed = reportDamages(data.damages);
  const charge = totalCharge(data.damages);
  const reading = (depart: number | null, retour: number | null, unit: string) =>
    depart === null && retour === null ? '—' : `${depart ?? '—'} → ${retour ?? '—'} ${unit}`;

  const rows = listed
    .map(
      (damage, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(t(`inspection.analysis.zonesLabel.${damage.zone}`))}</td>
        <td>${escapeHtml(t(`inspection.analysis.types.${damage.type}`))}${damage.description ? `<div class="desc">${escapeHtml(damage.description)}</div>` : ''}</td>
        <td>${escapeHtml(t(`inspection.analysis.damages.severity.${damage.gravite}`))}</td>
        <td class="${damage.nouveau ? 'new' : 'old'}">${escapeHtml(t(damage.nouveau ? 'inspection.analysis.damages.new' : 'inspection.analysis.damages.existing'))}</td>
        <td class="num">${damage.nouveau && damage.statut === 'confirme' ? escapeHtml(mad(effectiveCost(damage))) : '—'}</td>
      </tr>`
    )
    .join('');

  const photos = data.photos
    .map(
      (photo) => `<div class="pair"><div class="cap">${escapeHtml(t(`inspection.angles.${photo.angle}`))}</div><div class="imgs">
        ${photo.depart ? `<figure><img src="${photo.depart}"/><figcaption>${escapeHtml(t('inspection.analysis.compare.depart'))}</figcaption></figure>` : ''}
        ${photo.retour ? `<figure><img src="${photo.retour}"/><figcaption>${escapeHtml(t('inspection.analysis.compare.retour'))}</figcaption></figure>` : ''}
      </div></div>`
    )
    .join('');

  const deposit = data.deposit
    ? `<table class="sum"><tr><td>${escapeHtml(t('inspection.report.depositBlocked'))}</td><td class="num">${escapeHtml(mad(data.deposit.bloque))}</td></tr>
       <tr><td>${escapeHtml(t('inspection.report.deduction'))}</td><td class="num red">− ${escapeHtml(mad(charge))}</td></tr>
       <tr class="tot"><td>${escapeHtml(t('inspection.report.toRefund'))}</td><td class="num">${escapeHtml(mad(Math.max(data.deposit.bloque - charge, 0)))}</td></tr></table>`
    : '';

  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#211A2E;font-size:12px;margin:0;padding:28px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #EAE5F2;padding-bottom:4px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:8px 0}
  .meta div span{color:#6B6280}
  .banner{border-radius:10px;padding:10px 12px;margin:10px 0;font-weight:bold;background:${counts.nouveaux > 0 ? '#FEE2E2' : '#DCFCE7'};color:${counts.nouveaux > 0 ? '#991B1B' : '#166534'}}
  table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #EAE5F2;padding:5px 6px;text-align:${rtl ? 'right' : 'left'};vertical-align:top}
  th{background:#FAF9FF;font-size:11px} .num{text-align:${rtl ? 'left' : 'right'};white-space:nowrap} .desc{color:#6B6280;font-size:11px}
  .new{color:#B91C1C;font-weight:bold} .old{color:#B45309} .red{color:#B91C1C} .sum{width:60%;margin-${rtl ? 'right' : 'left'}:auto} .tot td{font-weight:bold;font-size:13px}
  .pair{page-break-inside:avoid;margin:8px 0} .cap{font-weight:bold;margin-bottom:3px} .imgs{display:flex;gap:8px} figure{margin:0;flex:1} img{width:100%;max-height:200px;object-fit:contain;background:#000;border-radius:6px} figcaption{font-size:10px;color:#6B6280;text-align:center}
  .foot{margin-top:18px;font-size:10px;color:#6B6280}
  </style></head><body>
  <div class="head"><div><h1>${escapeHtml(t('inspection.analysis.title.retour'))}</h1><div>${escapeHtml(data.agencyName)}${data.agencyPhone ? ` · ${escapeHtml(data.agencyPhone)}` : ''}</div></div>
  <div>${escapeHtml(data.rentalNumber)}<br/>${escapeHtml(data.formatDate(data.dateInspection))}</div></div>
  <div class="meta">
    <div><span>${escapeHtml(t('inspection.report.vehicle'))} :</span> ${escapeHtml(data.vehicleLabel)} (${escapeHtml(data.plate)})</div>
    <div><span>${escapeHtml(t('inspection.report.customer'))} :</span> ${escapeHtml(data.customerName)}</div>
    <div><span>${escapeHtml(t('inspection.report.km'))} :</span> ${escapeHtml(reading(data.kmDepart, data.kmRetour, 'km'))}</div>
    <div><span>${escapeHtml(t('inspection.report.fuel'))} :</span> ${escapeHtml(reading(data.fuelDepart, data.fuelRetour, '%'))}</div>
  </div>
  <div class="banner">${escapeHtml(counts.nouveaux > 0 ? t('inspection.analysis.summary.new', { count: counts.nouveaux }) : t('inspection.analysis.summary.none'))}${charge > 0 ? ` — ${escapeHtml(t('inspection.report.deductionTotal', { amount: mad(charge) }))}` : ''}</div>
  ${listed.length > 0 ? `<h2>${escapeHtml(t('inspection.analysis.damages.title'))}</h2><table><tr><th>#</th><th>${escapeHtml(t('inspection.analysis.damages.zone'))}</th><th>${escapeHtml(t('inspection.analysis.damages.type'))}</th><th>${escapeHtml(t('inspection.analysis.damages.severity'))}</th><th></th><th class="num">${escapeHtml(t('inspection.report.cost'))}</th></tr>${rows}</table>` : ''}
  ${deposit ? `<h2>${escapeHtml(t('inspection.report.depositTitle'))}</h2>${deposit}` : ''}
  ${photos ? `<h2>${escapeHtml(t('inspection.report.evidence'))}</h2>${photos}` : ''}
  <div class="foot">${escapeHtml(t('inspection.report.footer'))}</div>
  </body></html>`;
}

/** Numéro marocain (« 06 61 23 45 67 », « +212661234567 ») → format WhatsApp « 212661234567 » ; null si ce n'est pas un numéro plausible. */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`;
  return /^\d{9,15}$/.test(digits) ? digits : null;
}
