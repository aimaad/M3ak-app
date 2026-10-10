// M3ak — création / renvoi d'une invitation + envoi de l'e-mail via Gmail (SMTP).
//
// Le code d'invitation est généré par la base (fonctions create_agency_invite /
// resend_agency_invite) AVEC LES DROITS DE L'APPELANT : toutes les règles de rôle
// et de filiale s'appliquent donc exactement comme dans l'app. Cette fonction ne
// fait qu'ajouter l'envoi de l'e-mail, avec des identifiants SMTP qui restent
// côté serveur (secrets Supabase), jamais dans l'app mobile.
//
// Secrets à définir (voir supabase/README.md) :
//   SMTP_USER       adresse Gmail d'envoi
//   SMTP_PASSWORD   mot de passe d'application Gmail (16 caractères)
//   SMTP_FROM_NAME  (optionnel) nom affiché, ex. « M3ak »
//
// Si les secrets sont absents ou si l'envoi échoue, l'invitation est quand même
// créée et le code est renvoyé à l'app (partage WhatsApp / copie).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InvitePayload = {
  id: string;
  agency_id: string;
  code: string;
  email: string;
  prenom: string;
  nom: string;
  role: 'manager' | 'employee';
  branch_id: string | null;
  branch_name: string | null;
  agency_name: string;
  inviter_name: string | null;
  expires_at: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Retire accents et caractères non ASCII (ex. « Zaïd » → « Zaid », texte arabe → vide).
function toAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

const ROLE_LABELS: Record<string, { fr: string; ar: string }> = {
  manager: { fr: 'Responsable', ar: 'مسؤول' },
  employee: { fr: 'Employé', ar: 'موظف' },
};

export function buildInviteEmail(invite: InvitePayload): { subject: string; text: string; html: string } {
  const code = formatCode(invite.code);
  const role = ROLE_LABELS[invite.role] ?? ROLE_LABELS.employee;
  const expires = new Date(invite.expires_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const inviter = invite.inviter_name?.trim() || null;
  const branchLine = invite.branch_name ? ` (filiale ${invite.branch_name})` : '';

  // Titre en ASCII pur : l'encodage des accents dans l'en-tête Subject s'affiche
  // brut (=?utf-8?Q?...?=) chez certains clients. Le corps reste en UTF-8.
  const subject = `Invitation a rejoindre M3ak - ${toAscii(invite.agency_name) || 'votre agence'}`;

  const text = [
    `Bonjour ${invite.prenom},`,
    '',
    `${inviter ?? "L'agence"} vous invite à rejoindre l'agence « ${invite.agency_name} » sur M3ak, en tant que ${role.fr}${branchLine}.`,
    '',
    `Votre code d'invitation : ${code}`,
    '',
    'Comment faire :',
    '1. Installez et ouvrez l\'application M3ak.',
    `2. Créez un compte avec CETTE adresse e-mail : ${invite.email}`,
    '3. Confirmez votre e-mail avec le code reçu, puis choisissez « Rejoindre » et entrez le code ci-dessus.',
    '',
    `Ce code est personnel, à usage unique et valable jusqu'au ${expires}. Il ne fonctionne qu'avec ${invite.email}. Ne le partagez pas.`,
    "Si vous n'attendiez pas cette invitation, ignorez simplement cet e-mail.",
    '',
    '—',
    'معاك — M3ak',
    `دعوة للانضمام إلى وكالة « ${invite.agency_name} ». رمز الدعوة: ${code}. أنشئ حساباً بنفس هذا البريد الإلكتروني (${invite.email}) ثم اختر «انضم» وأدخل الرمز.`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#F6F3FB;font-family:Arial,Helvetica,sans-serif;color:#211A2E;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;">
    <h2 style="margin:0 0 4px;color:#7C3AED;">M3ak · معاك</h2>
    <p style="margin:16px 0 0;">Bonjour ${escapeHtml(invite.prenom)},</p>
    <p>${escapeHtml(inviter ?? "L'agence")} vous invite à rejoindre l'agence <strong>${escapeHtml(invite.agency_name)}</strong>
       sur M3ak, en tant que <strong>${escapeHtml(role.fr)}</strong>${escapeHtml(branchLine)}.</p>
    <p style="margin:24px 0 8px;">Votre code d'invitation :</p>
    <div style="font-size:26px;letter-spacing:3px;font-weight:bold;background:#F1E9FE;color:#5B21B6;border-radius:14px;padding:16px;text-align:center;">${escapeHtml(code)}</div>
    <ol style="padding-left:20px;line-height:1.6;">
      <li>Installez et ouvrez l'application M3ak.</li>
      <li>Créez un compte avec <strong>cette adresse e-mail : ${escapeHtml(invite.email)}</strong></li>
      <li>Confirmez votre e-mail avec le code reçu, puis choisissez « Rejoindre » et entrez le code ci-dessus.</li>
    </ol>
    <p style="font-size:13px;color:#6B6479;">Ce code est personnel, à usage unique et valable jusqu'au ${escapeHtml(expires)}.
       Il ne fonctionne qu'avec ${escapeHtml(invite.email)}. Ne le partagez pas.<br>
       Si vous n'attendiez pas cette invitation, ignorez simplement cet e-mail.</p>
    <hr style="border:none;border-top:1px solid #EAE5F2;margin:20px 0;">
    <p dir="rtl" style="font-size:14px;line-height:1.7;">دعوة للانضمام إلى وكالة <strong>${escapeHtml(invite.agency_name)}</strong>.
       رمز الدعوة: <strong>${escapeHtml(code)}</strong>.<br>
       أنشئ حساباً بنفس هذا البريد الإلكتروني (${escapeHtml(invite.email)}) ثم اختر «انضم» وأدخل الرمز.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

async function sendEmail(invite: InvitePayload): Promise<{ sent: boolean; error?: string }> {
  const user = Deno.env.get('SMTP_USER');
  const password = Deno.env.get('SMTP_PASSWORD');
  if (!user || !password) {
    return { sent: false, error: 'smtp_not_configured' };
  }

  const fromName = Deno.env.get('SMTP_FROM_NAME') ?? 'M3ak';
  const { subject, text, html } = buildInviteEmail(invite);

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: user, password },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${user}>`,
      to: invite.email,
      subject,
      content: text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error('Échec de l\'envoi SMTP :', error instanceof Error ? error.message : error);
    return { sent: false, error: 'smtp_send_failed' };
  } finally {
    try {
      await client.close();
    } catch {
      // connexion déjà fermée
    }
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_authenticated' }, 401);

  // Client agissant AU NOM de l'appelant : auth.uid() et la RLS s'appliquent.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  let rpc;
  if (body.action === 'create') {
    rpc = await supabase.rpc('create_agency_invite', {
      p_agency_id: body.agencyId,
      p_email: body.email,
      p_prenom: body.prenom,
      p_nom: body.nom,
      p_role: body.role,
      p_branch_id: body.branchId ?? null,
    });
  } else if (body.action === 'resend') {
    rpc = await supabase.rpc('resend_agency_invite', { p_invite_id: body.inviteId });
  } else {
    return json({ error: 'invalid_request' }, 400);
  }

  if (rpc.error) {
    // Les erreurs métier sont des codes courts (not_allowed, invite_already_pending…).
    return json({ error: rpc.error.message }, 400);
  }

  const invite = rpc.data as InvitePayload;
  const email = await sendEmail(invite);

  return json({ invite, emailSent: email.sent, emailError: email.error ?? null });
});
