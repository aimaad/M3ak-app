# Inspection par caméra IA

## Parcours
1. **Capture** (départ, puis retour) : 24 angles guidés — tour de la voiture (face, 3/4, côtés, capot, toit, pare-brise), 4 roues (jante + pneu), intérieur (tableau de bord, volant, frein à main, sièges avant, banquette, plafond, tapis, coffre ouvert). Chaque angle a une consigne (distance, cadrage) pour que départ et retour soient pris de la même façon. Seuls certains angles de l'intérieur peuvent être ignorés (voiture sans banquette…). Les photos sont réduites à 1600 px et envoyées en arrière-plan (fonctionne hors ligne).
2. **Analyse** : l'employé lance (après accord) la fonction `analyze-inspection` (une fois). Elle lit les photos dans le stockage privé, les envoie à Gemini par groupes (avant, côtés, arrière + toit + roues, habitacle avant, sièges + plafond + coffre) en parallèle, et enregistre les dommages avec le statut « proposé ». Au retour, chaque angle est comparé à la photo de départ du même angle : seul ce qui est visible au retour et absent au départ est « nouveau ». Sans photo de départ pour un angle, rien n'est déclaré nouveau (« à vérifier »).
3. **Validation** : l'employé confirme, rejette ou corrige chaque dommage (emplacement, type, gravité, coût, nouveau / déjà présent), ou en ajoute un que l'IA a manqué. Le coût est proposé par l'IA et modifiable.
4. **Retenue et rapport** (retour) : seuls les dommages **nouveaux ET confirmés** comptent. La retenue est proposée, modifiable, plafonnée à la caution, et ne peut pas être validée tant qu'un nouveau dommage est « à valider ». Rapport PDF (synthèse, dommages, photos départ / retour, caution) partageable, et message WhatsApp.

## Inspection avant contrat
Le contrat est l'avant-dernière étape du parcours (juste avant le départ) : il reprend tout ce qui a été recueilli. À la création du contrat, l'employé voit la liste des dommages **confirmés** à l'inspection de départ et choisit, un par un, ceux à inscrire au contrat (le client les lira et signera). Il peut aussi écrire à la main un dommage que l'app n'a pas vu. Le kilométrage et le carburant lus à l'inspection, l'état général, les accessoires et les observations sont repris dans le contrat (rubrique « État des lieux au départ »). Au départ réel, l'écran de remise des clés est prérempli avec ces valeurs.

## Départ conditionné à l'inspection
Une location **ne peut pas démarrer** tant que l'inspection de départ n'est pas terminée (au moins 8 photos ; le guide actuel en demande 24). L'écran de la location affiche un bandeau « Inspection de départ obligatoire » avec un bouton, l'écran de départ renvoie vers l'inspection, et le serveur refuse aussi (`departure_inspection_required`, migration 0047) : contourner l'écran ne suffit pas.

## Ignorer, refuser l'analyse, choisir les dommages du contrat (migration 0050)
- **Ignorer l'inspection** (départ ou retour) : bouton sur l'écran de capture et dans le parcours de la location, avec confirmation. Enregistré avec qui/quand (`skipped`, `skipped_by`, `skipped_at`) et journalisé (`inspection_skipped`). Le serveur n'exige alors plus les 8 photos. On peut reprendre l'inspection ensuite.
- **Après les photos** : l'employé choisit d'analyser avec M3ak ou non. Il n'y a plus d'analyse automatique.
  - **Non** : statut `refusee`. Les photos restent stockées (comparaison au retour) ; l'employé peut saisir des dommages à la main, ou « Analyser quand même ».
  - **Oui** : analyse, puis validation des dommages un par un ; pour chaque dommage confirmé, un interrupteur décide s'il est **inscrit au contrat** (`damages.dans_contrat`). Saisie manuelle possible en plus.

## Confidentialité et sécurité
- Même règle que la lecture de documents : clé Gemini **de l'entreprise** uniquement, accord du propriétaire obligatoire (sinon `ocr_disabled` / `ocr_not_configured`, rien n'est envoyé).
- La fonction vérifie d'abord, avec le droit de l'appelant (RLS), qu'il peut voir l'inspection (entreprise et filiale). Les photos ne sont lues avec le rôle service qu'ensuite. Ni images ni résultats ne sont journalisés.
- L'IA propose, l'humain décide : rien n'est retenu sans validation.

## Mise en route
1. Exécuter `supabase/migrations/0046_inspection_analysis.sql` puis `0047_departure_requires_inspection.sql` … jusqu'à `0050_inspection_skip_and_decline.sql`.
2. `npx supabase functions deploy analyze-inspection --project-ref <ref>` (la fonction partage `_shared/gemini.ts`).
3. Tests SQL : `supabase/tests/inspection-analysis.test.sql` (isolation entre agences, contraintes, nouveaux angles).

## Limites connues
- La qualité de détection dépend des photos (lumière, netteté, même cadrage au départ et au retour) : **non vérifiée sur de vraies photos** à ce jour.
- L'analyse demande du réseau (la capture, elle, fonctionne hors ligne).
- Pas encore de suivi de quota des analyses d'inspection (les lectures de documents ont le leur).
