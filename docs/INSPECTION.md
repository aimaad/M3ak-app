# Inspection par caméra IA

## Parcours
1. **Capture** (départ, puis retour) : 24 angles guidés — tour de la voiture (face, 3/4, côtés, capot, toit, pare-brise), 4 roues (jante + pneu), intérieur (tableau de bord, volant, frein à main, sièges avant, banquette, plafond, tapis, coffre ouvert). Chaque angle a une consigne (distance, cadrage) pour que départ et retour soient pris de la même façon. Seuls certains angles de l'intérieur peuvent être ignorés (voiture sans banquette…). Les photos sont réduites à 1600 px et envoyées en arrière-plan (fonctionne hors ligne).
2. **Analyse** : l'écran lance automatiquement la fonction `analyze-inspection` (une fois). Elle lit les photos dans le stockage privé, les envoie à Gemini par groupes (avant, côtés, arrière + toit + roues, habitacle avant, sièges + plafond + coffre) en parallèle, et enregistre les dommages avec le statut « proposé ». Au retour, chaque angle est comparé à la photo de départ du même angle : seul ce qui est visible au retour et absent au départ est « nouveau ». Sans photo de départ pour un angle, rien n'est déclaré nouveau (« à vérifier »).
3. **Validation** : l'employé confirme, rejette ou corrige chaque dommage (emplacement, type, gravité, coût, nouveau / déjà présent), ou en ajoute un que l'IA a manqué. Le coût est proposé par l'IA et modifiable.
4. **Retenue et rapport** (retour) : seuls les dommages **nouveaux ET confirmés** comptent. La retenue est proposée, modifiable, plafonnée à la caution, et ne peut pas être validée tant qu'un nouveau dommage est « à valider ». Rapport PDF (synthèse, dommages, photos départ / retour, caution) partageable, et message WhatsApp.

## Confidentialité et sécurité
- Même règle que la lecture de documents : clé Gemini **de l'entreprise** uniquement, accord du propriétaire obligatoire (sinon `ocr_disabled` / `ocr_not_configured`, rien n'est envoyé).
- La fonction vérifie d'abord, avec le droit de l'appelant (RLS), qu'il peut voir l'inspection (entreprise et filiale). Les photos ne sont lues avec le rôle service qu'ensuite. Ni images ni résultats ne sont journalisés.
- L'IA propose, l'humain décide : rien n'est retenu sans validation.

## Mise en route
1. Exécuter `supabase/migrations/0046_inspection_analysis.sql`.
2. `npx supabase functions deploy analyze-inspection --project-ref <ref>` (la fonction partage `_shared/gemini.ts`).
3. Tests SQL : `supabase/tests/inspection-analysis.test.sql` (isolation entre agences, contraintes, nouveaux angles).

## Limites connues
- La qualité de détection dépend des photos (lumière, netteté, même cadrage au départ et au retour) : **non vérifiée sur de vraies photos** à ce jour.
- L'analyse demande du réseau (la capture, elle, fonctionne hors ligne).
- Pas encore de suivi de quota des analyses d'inspection (les lectures de documents ont le leur).
