import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import { accessStatus, adminErrorMessage, costLabel, formatDate, formatInt, formatMad, formatUsd, isValidCode, isValidEmail, normalizeCode, parseDecimal, periodRange, summarize, validateKey, validateNewPassword } from './format.js';

// Session conservée seulement pour l'onglet (sessionStorage) : fermer l'onglet déconnecte.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
});

const app = document.getElementById('app');
const sessionBox = document.getElementById('session');
const sessionEmail = document.getElementById('session-email');
const state = { period: 'month', overview: null, editing: null, agencies: [], created: null };

/** Création de nœuds DOM : tout texte venant de la base (noms d'entreprises…) passe par des nœuds texte, jamais par du HTML brut. */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function render(...nodes) {
  app.replaceChildren(...nodes);
}

// ---------- Connexion ----------
function showLogin(message) {
  sessionBox.hidden = true;
  const error = h('p', { class: 'error', role: 'alert' }, message ?? '');
  const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
  const password = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Se connecter');
  const form = h(
    'form',
    {
      class: 'card login',
      onsubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = '';
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        password.value = '';
        submit.disabled = false;
        if (signInError) {
          error.textContent = adminErrorMessage(signInError);
          return;
        }
        await start();
      },
    },
    h('h1', {}, 'Console KRIHA'),
    h('p', { class: 'muted' }, 'Réservée aux administrateurs de la plateforme.'),
    h('label', {}, 'E-mail', email),
    h('label', {}, 'Mot de passe', password),
    error,
    h('div', { class: 'actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => showForgotPassword(email.value) }, 'Mot de passe oublié ?'), submit)
  );
  render(form);
}

// ---------- Mot de passe oublié : e-mail → code reçu → nouveau mot de passe ----------
function showForgotPassword(prefillEmail = '') {
  sessionBox.hidden = true;
  const message = h('p', { class: 'error', role: 'alert' });
  const email = h('input', { type: 'email', required: true, autocomplete: 'username', value: prefillEmail });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Envoyer le code');
  const form = h(
    'form',
    {
      class: 'card login',
      onsubmit: async (event) => {
        event.preventDefault();
        message.className = 'error';
        message.textContent = '';
        if (!isValidEmail(email.value)) {
          message.textContent = 'Entrez une adresse e-mail valide.';
          return;
        }
        submit.disabled = true;
        const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim());
        submit.disabled = false;
        if (error) {
          // Message générique : on ne révèle pas si l'adresse correspond à un compte.
          message.textContent = 'Impossible d’envoyer le code pour le moment. Réessayez dans quelques minutes.';
          return;
        }
        showResetPassword(email.value.trim());
      },
    },
    h('h1', {}, 'Mot de passe oublié'),
    h('p', { class: 'muted' }, 'Entrez l’e-mail de votre compte : un code vous sera envoyé.'),
    h('label', {}, 'E-mail', email),
    message,
    h('div', { class: 'actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => showLogin() }, 'Retour'), submit)
  );
  render(form);
}

function showResetPassword(emailAddress) {
  const message = h('p', { class: 'ok-msg', role: 'status' }, 'Si un compte existe pour cette adresse, un code vient d’être envoyé (pensez aux courriers indésirables).');
  const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', required: true, placeholder: '123456' });
  const password = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  const confirm = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Changer le mot de passe');
  code.addEventListener('input', () => { code.value = normalizeCode(code.value); });
  const form = h(
    'form',
    {
      class: 'card login',
      onsubmit: async (event) => {
        event.preventDefault();
        message.className = 'error';
        message.textContent = '';
        if (!isValidCode(code.value)) {
          message.textContent = 'Code incorrect ou expiré.';
          return;
        }
        const problem = validateNewPassword(password.value, confirm.value);
        if (problem) {
          message.textContent = problem;
          return;
        }
        submit.disabled = true;
        const { error: verifyError } = await supabase.auth.verifyOtp({ email: emailAddress, token: code.value, type: 'recovery' });
        if (verifyError) {
          submit.disabled = false;
          message.textContent = 'Code incorrect ou expiré. Réessayez ou demandez un nouveau code.';
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password: password.value });
        password.value = '';
        confirm.value = '';
        submit.disabled = false;
        if (updateError) {
          // Le code est consommé : on referme la session de récupération et on repart de zéro.
          await supabase.auth.signOut();
          message.textContent = 'Le mot de passe n’a pas pu être changé. Demandez un nouveau code.';
          return;
        }
        await start(); // connecté avec le nouveau mot de passe ; l'accès administrateur est revérifié
      },
    },
    h('h1', {}, 'Nouveau mot de passe'),
    message,
    h('label', {}, 'Code reçu par e-mail', code),
    h('label', {}, 'Nouveau mot de passe (8 caractères minimum)', password),
    h('label', {}, 'Confirmer le mot de passe', confirm),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => showForgotPassword(emailAddress) }, 'Renvoyer un code'),
      submit)
  );
  render(form);
}

async function logout() {
  await supabase.auth.signOut();
  state.overview = null;
  showLogin();
}
document.getElementById('logout').addEventListener('click', logout);

// ---------- Données ----------
async function loadOverview() {
  const { from, to } = periodRange(state.period);
  const { data, error } = await supabase.rpc('admin_ocr_overview', { p_from: from, p_to: to });
  if (error) throw error;
  state.overview = data;
  const { data: list, error: listError } = await supabase.rpc('admin_list_agencies');
  // Tant que la migration d'accès (0057) n'est pas appliquée, la section « Accès » reste simplement vide.
  state.agencies = listError ? [] : list;
  state.accessReady = !listError;
}

async function refresh() {
  try {
    await loadOverview();
    renderDashboard();
  } catch (error) {
    render(h('div', { class: 'card' }, h('p', { class: 'error', role: 'alert' }, adminErrorMessage(error))));
  }
}

// ---------- Tableau de bord ----------
function renderDashboard(flash) {
  const { pricing, agencies } = state.overview;
  const total = summarize(agencies);
  const rate = pricing?.usd_to_mad ?? null;

  const kpi = (label, value) => h('div', { class: 'kpi' }, h('div', { class: 'value' }, value), h('div', { class: 'label' }, label));
  const costValue = total.costComplete ? formatUsd(total.costUsd) : `${formatUsd(total.costUsd)} + inconnu`;

  const periodSelect = h(
    'select',
    { id: 'period', onchange: (event) => { state.period = event.target.value; refresh(); } },
    h('option', { value: 'month', selected: state.period === 'month' }, 'Ce mois-ci'),
    h('option', { value: '30d', selected: state.period === '30d' }, '30 derniers jours'),
    h('option', { value: 'all', selected: state.period === 'all' }, 'Depuis le début')
  );

  const rows = agencies.map((a) =>
    h(
      'tr',
      {},
      h('td', {}, h('strong', {}, a.nom), a.ville ? h('div', { class: 'hint' }, a.ville) : null),
      h('td', {}, formatDate(a.created_at)),
      h('td', { class: 'num' }, formatInt(a.members)),
      h(
        'td',
        {},
        a.key_set ? h('span', { class: 'pill ok' }, `••••${a.key_last4 ?? ''}`) : h('span', { class: 'pill off' }, 'Aucune clé'),
        ' ',
        a.key_set ? h('span', { class: `pill ${a.key_tier === 'paid' ? 'warn' : 'off'}` }, a.key_tier === 'paid' ? 'Payante' : 'Gratuite') : null
      ),
      h('td', {}, a.key_set ? (a.cloud_enabled ? h('span', { class: 'pill ok' }, 'Activée') : h('span', { class: 'pill off' }, 'En attente du propriétaire')) : '—'),
      h('td', {}, a.key_set ? (a.insights_enabled ? h('span', { class: 'pill ok' }, 'Activées') : h('span', { class: 'pill off' }, 'En attente du propriétaire')) : '—'),
      h('td', { class: 'num' }, formatInt(a.scans)),
      h('td', { class: 'num' }, formatInt(a.scans_failed)),
      h('td', { class: 'num' }, formatInt(a.insights_calls)),
      h('td', { class: 'num' }, `${formatInt(a.input_tokens)} / ${formatInt(a.output_tokens)}`),
      h('td', {}, costLabel(a, rate)),
      h('td', {}, formatDate(a.last_scan_at)),
      h(
        'td',
        { class: 'actions' },
        h('button', { class: 'btn small', type: 'button', onclick: () => openKeyDialog(a) }, a.key_set ? 'Modifier' : 'Configurer'),
        a.key_set ? h('button', { class: 'btn small danger', type: 'button', onclick: () => removeKey(a) }, 'Retirer') : null
      )
    )
  );

  render(
    h('div', { class: 'toolbar' }, h('div', {}, h('h1', {}, 'Entreprises et utilisation de l’OCR'), h('p', { class: 'muted' }, 'Documents lus et rapports IA envoyés à Gemini avec la clé de chaque entreprise. Sans clé (ou sans accord du propriétaire), ces fonctions ne sont pas actives pour l’entreprise.')), h('label', {}, 'Période', periodSelect)),
    flash ? h('p', { class: 'ok-msg', role: 'status' }, flash) : null,
    h('div', { class: 'kpis' },
      kpi('Entreprises', formatInt(total.agencies)),
      kpi('Avec clé / activées', `${formatInt(total.withKey)} / ${formatInt(total.enabled)}`),
      kpi('Documents lus (dont échecs)', `${formatInt(total.scans)} (${formatInt(total.failed)})`),
      kpi('Tokens entrée / sortie', `${formatInt(total.inputTokens)} / ${formatInt(total.outputTokens)}`),
      kpi('Coût estimé (USD)', costValue),
      kpi('Coût estimé (MAD)', total.costComplete || total.costUsd > 0 ? formatMad(total.costUsd, rate) : '—')
    ),
    h('div', { class: 'card table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, ...['Entreprise', 'Créée le', 'Membres', 'Clé', 'Lecture des documents', 'Recommandations IA', 'Documents lus', 'Échecs', 'Rapports IA', 'Tokens (entrée / sortie)', 'Coût estimé', 'Dernière analyse', ''].map((label, i) => h('th', { class: i === 2 || i === 6 || i === 7 || i === 8 ? 'num' : '' }, label)))),
        h('tbody', {}, rows.length ? rows : h('tr', {}, h('td', { colspan: 13 }, 'Aucune entreprise.')))
      )
    ),
    state.accessReady ? accessSection() : h('p', { class: 'note' }, 'Exécutez la migration 0057 dans Supabase pour gérer la création des agences et la durée d’accès.'),
    pricingCard(pricing),
    h('p', { class: 'note' }, 'Les coûts sont des ESTIMATIONS : nombre de tokens × tarif saisi ci-dessus, uniquement pour les clés déclarées « payantes ». La facture réelle est celle de Google (console Google Cloud / AI Studio) ; vérifiez-y les montants avant de refacturer une entreprise.')
  );
}

function pricingCard(pricing) {
  const input = h('input', { inputmode: 'decimal', value: pricing?.input_usd_per_million ?? '' });
  const output = h('input', { inputmode: 'decimal', value: pricing?.output_usd_per_million ?? '' });
  const rate = h('input', { inputmode: 'decimal', value: pricing?.usd_to_mad ?? '' });
  const message = h('p', { class: 'error', role: 'alert' });
  const save = h('button', { class: 'btn', type: 'submit' }, 'Enregistrer le tarif');
  return h(
    'form',
    {
      class: 'card',
      onsubmit: async (event) => {
        event.preventDefault();
        const values = [parseDecimal(input.value), parseDecimal(output.value), parseDecimal(rate.value)];
        if (values.some((v) => Number.isNaN(v)) || values[2] === 0) {
          message.className = 'error';
          message.textContent = 'Saisissez des nombres positifs (ou laissez vide).';
          return;
        }
        save.disabled = true;
        const { error } = await supabase.rpc('admin_set_ocr_pricing', { p_input_usd: values[0], p_output_usd: values[1], p_usd_to_mad: values[2] });
        save.disabled = false;
        if (error) {
          message.className = 'error';
          message.textContent = adminErrorMessage(error);
          return;
        }
        await loadOverview();
        renderDashboard('Tarif enregistré.');
      },
    },
    h('h2', {}, 'Tarif Google utilisé pour l’estimation'),
    h('p', { class: 'muted' }, 'Saisissez le tarif publié par Google pour le modèle utilisé (gemini-2.5-flash, puis ses remplaçants) : l’application ne le connaît pas et ne le devine pas.'),
    h('div', { class: 'grid2' },
      h('label', {}, 'USD par million de tokens en entrée', input),
      h('label', {}, 'USD par million de tokens en sortie', output),
      h('label', {}, '1 USD = … MAD (facultatif)', rate)
    ),
    message,
    h('div', { class: 'actions' }, save)
  );
}

// ---------- Création d'agences et durée d'accès ----------
function accessSection() {
  const nom = h('input', { maxlength: 120, autocomplete: 'off' });
  const ville = h('input', { maxlength: 80, autocomplete: 'off' });
  const prenom = h('input', { autocomplete: 'off' });
  const nomFamille = h('input', { autocomplete: 'off' });
  const email = h('input', { type: 'email', autocomplete: 'off' });
  const days = h('input', { inputmode: 'numeric', value: '5' });
  const message = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn', type: 'button' }, 'Créer l’agence');

  save.addEventListener('click', async () => {
    message.hidden = true;
    const trial = days.value.trim() === '' ? null : Number.parseInt(days.value, 10);
    if (!isValidEmail(email.value) || nom.value.trim().length < 2 || (trial !== null && !(trial >= 1))) {
      message.textContent = 'Renseignez le nom de l’agence, l’e-mail du client et un nombre de jours valide (vide = illimité).';
      message.hidden = false;
      return;
    }
    save.disabled = true;
    const { data, error } = await supabase.rpc('admin_create_agency', {
      p_nom: nom.value.trim(),
      p_ville: ville.value.trim(),
      p_owner_email: email.value.trim(),
      p_owner_prenom: prenom.value.trim(),
      p_owner_nom: nomFamille.value.trim(),
      p_trial_days: trial,
    });
    save.disabled = false;
    if (error) {
      message.textContent = adminErrorMessage(error);
      message.hidden = false;
      return;
    }
    state.created = { nom: nom.value.trim(), email: data.email, code: data.invite_code };
    await refresh();
  });

  const created = state.created
    ? h('div', { class: 'note' },
        h('strong', {}, `Agence « ${state.created.nom} » créée.`),
        h('p', {}, 'Donnez ce code au client (il ne sera plus affiché) :'),
        h('p', {}, h('strong', { class: 'code' }, state.created.code)),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => { state.created = null; renderDashboard(); } }, 'J’ai copié le code, masquer'),
        h('p', {}, `Le client doit créer son compte dans l’application avec l’e-mail ${state.created.email} (et confirmer cet e-mail), puis saisir ce code dans « Rejoindre ». Le code est valable 30 jours.`))
    : null;

  const rows = state.agencies.map((a) => {
    const status = accessStatus(a);
    const extend = (n) => setAccess(a, { p_days: n });
    return h('tr', {},
      h('td', {}, h('strong', {}, a.nom), a.ville ? h('div', { class: 'hint' }, a.ville) : null),
      h('td', {}, a.owner_email ?? h('span', { class: 'pill warn' }, 'Code non utilisé')),
      h('td', {}, h('span', { class: `pill ${status.kind}` }, status.label)),
      h('td', {}, a.access_until ? formatDate(a.access_until) : '—'),
      h('td', { class: 'num' }, formatInt(a.vehicles)),
      h('td', { class: 'num' }, formatInt(a.customers)),
      h('td', { class: 'num' }, formatInt(a.rentals)),
      h('td', {}, a.last_activity ? formatDate(a.last_activity) : '—'),
      h('td', { class: 'actions' },
        a.owner_email ? null : h('button', { class: 'btn small', type: 'button', onclick: () => reissueCode(a) }, 'Nouveau code'),
        h('button', { class: 'btn small', type: 'button', onclick: () => extend(5) }, '+5 jours'),
        h('button', { class: 'btn small', type: 'button', onclick: () => extend(30) }, '+30 jours'),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => setAccess(a, { p_unlimited: true, p_suspended: false }) }, 'Illimité'),
        a.suspended
          ? h('button', { class: 'btn small', type: 'button', onclick: () => setAccess(a, { p_suspended: false }) }, 'Réactiver')
          : h('button', { class: 'btn small danger', type: 'button', onclick: () => setAccess(a, { p_suspended: true }) }, 'Suspendre')
      )
    );
  });

  return h('section', {},
    h('div', { class: 'card' },
      h('h2', {}, 'Créer l’agence d’un client'),
      h('p', { class: 'muted' }, 'Seul cet écran peut créer une agence. Laissez « jours d’essai » vide pour un accès illimité.'),
      h('div', { class: 'grid2' },
        h('label', {}, 'Nom de l’agence', nom),
        h('label', {}, 'Ville', ville),
        h('label', {}, 'Prénom du propriétaire', prenom),
        h('label', {}, 'Nom du propriétaire', nomFamille),
        h('label', {}, 'E-mail du propriétaire', email),
        h('label', {}, 'Jours d’essai', days)
      ),
      message,
      h('div', { class: 'actions' }, save)
    ),
    created,
    h('div', { class: 'card table-wrap' },
      h('h2', {}, 'Accès des agences'),
      h('table', {},
        h('thead', {}, h('tr', {}, ...['Agence', 'Propriétaire', 'Accès', 'Fin de l’accès', 'Voitures', 'Clients', 'Locations', 'Dernière activité', ''].map((label, i) => h('th', { class: i >= 4 && i <= 6 ? 'num' : '' }, label)))),
        h('tbody', {}, rows.length ? rows : h('tr', {}, h('td', { colspan: 9 }, 'Aucune agence.')))
      )
    )
  );
}

async function reissueCode(agency) {
  const email = window.prompt(`E-mail du propriétaire de « ${agency.nom} » (le client devra créer son compte avec cet e-mail) :`);
  if (email === null) return;
  if (!isValidEmail(email)) {
    window.alert('Adresse e-mail invalide.');
    return;
  }
  const { data, error } = await supabase.rpc('admin_reissue_owner_code', { p_agency_id: agency.agency_id, p_owner_email: email.trim() });
  if (error) {
    window.alert(adminErrorMessage(error));
    return;
  }
  state.created = { nom: agency.nom, email: data.email, code: data.invite_code };
  await refresh();
}

async function setAccess(agency, args) {
  if (args.p_suspended === true && !window.confirm(`Suspendre « ${agency.nom} » ? Ses utilisateurs seront bloqués immédiatement.`)) return;
  const { error } = await supabase.rpc('admin_set_agency_access', {
    p_agency_id: agency.agency_id,
    p_days: null,
    p_unlimited: false,
    p_suspended: null,
    ...args,
  });
  if (error) {
    window.alert(adminErrorMessage(error));
    return;
  }
  await refresh();
}

// ---------- Clé d'une entreprise ----------
const dialog = document.getElementById('key-dialog');
const keyForm = document.getElementById('key-form');
const keyInput = document.getElementById('key-input');
const keyError = document.getElementById('key-error');
const keySave = document.getElementById('key-save');

function openKeyDialog(agency) {
  state.editing = agency;
  keyInput.value = '';
  keyError.hidden = true;
  document.getElementById('key-agency').textContent = agency.nom;
  document.getElementById('key-title').textContent = agency.key_set ? 'Modifier la clé Gemini' : 'Configurer la clé Gemini';
  document.getElementById('key-hint').textContent = agency.key_set
    ? 'Laissez la clé vide pour ne changer que l’offre. Une nouvelle clé remplace l’ancienne. Écriture seule : une clé enregistrée ne peut plus être relue.'
    : 'Écriture seule : une fois enregistrée, la clé ne peut plus être relue ni affichée.';
  keyForm.elements.tier.value = agency.key_tier === 'paid' ? 'paid' : 'free';
  dialog.showModal();
  keyInput.focus();
}

function closeKeyDialog() {
  keyInput.value = ''; // la clé ne reste jamais en mémoire de la page
  state.editing = null;
  dialog.close();
}

document.getElementById('key-cancel').addEventListener('click', closeKeyDialog);
dialog.addEventListener('cancel', () => { keyInput.value = ''; });

keyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const agency = state.editing;
  if (!agency) return;
  const tier = keyForm.elements.tier.value;
  const typed = keyInput.value.trim();
  keyError.hidden = true;

  keySave.disabled = true;
  let error = null;
  if (typed) {
    const problem = validateKey(typed);
    if (problem) {
      keySave.disabled = false;
      keyError.textContent = 'Clé invalide : vérifiez qu’elle est copiée en entier, sans espace.';
      keyError.hidden = false;
      return;
    }
    ({ error } = await supabase.rpc('admin_set_ocr_key', { p_agency_id: agency.agency_id, p_key: typed, p_tier: tier }));
  } else if (agency.key_set) {
    ({ error } = await supabase.rpc('admin_set_ocr_key_tier', { p_agency_id: agency.agency_id, p_tier: tier }));
  } else {
    keySave.disabled = false;
    keyError.textContent = 'Collez la clé d’API.';
    keyError.hidden = false;
    return;
  }
  keySave.disabled = false;
  if (error) {
    keyError.textContent = adminErrorMessage(error);
    keyError.hidden = false;
    return;
  }
  const name = agency.nom;
  closeKeyDialog();
  await loadOverview();
  renderDashboard(`Clé enregistrée pour ${name}. Le propriétaire doit maintenant activer l’analyse Gemini dans l’application.`);
});

async function removeKey(agency) {
  if (!window.confirm(`Retirer la clé de « ${agency.nom} » ? L’analyse Gemini sera arrêtée pour cette entreprise.`)) return;
  const { error } = await supabase.rpc('admin_clear_ocr_key', { p_agency_id: agency.agency_id });
  if (error) {
    window.alert(adminErrorMessage(error));
    return;
  }
  await loadOverview();
  renderDashboard(`Clé retirée pour ${agency.nom}.`);
}

// ---------- Démarrage ----------
async function start() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    showLogin();
    return;
  }
  const { data: isAdmin, error } = await supabase.rpc('is_platform_admin');
  if (error || isAdmin !== true) {
    await supabase.auth.signOut();
    showLogin('Ce compte n’est pas administrateur de la plateforme.');
    return;
  }
  sessionEmail.textContent = session.user.email ?? '';
  sessionBox.hidden = false;
  await refresh();
}

start();
