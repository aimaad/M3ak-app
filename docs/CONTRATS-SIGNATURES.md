# Contrat complet et signatures manuscrites

## Deux pages seulement : recto et verso
Le PDF fait **exactement deux feuilles A4**. **Page principale (recto)** : tout le formulaire (en-tête avec logo, conducteurs, véhicule, paiement, kilométrage, carburant, état du véhicule, franchise, signatures et cachet, mentions légales). **Verso** : les conditions générales, en deux colonnes serrées (français | arabe). Chaque feuille est automatiquement réduite juste ce qu'il faut pour tenir sur UNE page (jamais en dessous de 45 %) : plus le propriétaire ajoute de champs ou de conditions, plus le texte est serré. Le calcul est testé et vérifié sur un rendu réel (Chromium) ; le rendu exact peut varier légèrement selon le téléphone.

## Le contrat par défaut : carnet de location
Toutes les agences démarrent avec un contrat au format **carnet de location** (une page de cadres, puis les conditions générales au verso) : en-tête avec logo et coordonnées, numéro du contrat, **Conducteur 1** (nom, prénom, naissance, nationalité, adresse, téléphone, permis, CIN, passeport), **Véhicule et période**, **Conducteur 2** (nom, **prénom**, permis, CIN), **Paiement** (prix par jour, nombre de jours, total, caution, avance, reste, mode), **Kilométrage**, **jauge de carburant**, **schémas de l'état du véhicule** (départ et retour, à marquer à la main : R rayures, B bosses, E éclats, C cassures), franchise sinistre, signatures et cachet, ligne Patente / R.C / I.F / C.N.S.S à compléter, puis **14 articles bilingues** au verso. Les informations du client (adresse, naissance, permis…) sont figées à la création du contrat (migration 0041) ; paiements et kilométrages sont lus à la génération du PDF.

### Régler son contrat (propriétaire) — « Mon entreprise → Mon contrat »
Un seul écran, sans aucun vocabulaire technique. Puis 5 parties numérotées :
1. **Vos informations légales** : Patente, R.C, I.F, C.N.S.S **et tous les autres numéros que le propriétaire veut ajouter** (ex. ICE : un nom + un numéro), affichés en bas du contrat ; ce qui est vide n'apparaît pas. L'e-mail de l'agence n'est pas affiché sur le contrat. Le nom, l'adresse, le téléphone, le logo et le cachet viennent de « Mon entreprise ».
2. **Informations demandées au client** : interrupteurs (date de naissance, nationalité, adresse à l'étranger, hôtel, CIN, passeport).
3. **Parties du contrat** : interrupteurs (deuxième conducteur, paiement, kilométrage, niveau de carburant, schémas de l'état du véhicule, franchise sinistre avec son texte modifiable, conditions générales au verso).
4. **Ajouter une information à écrire au stylo** : on écrit un nom (ex. « Numéro de dossier »), une ligne vide apparaît dans la fiche du conducteur.
5. **Vos conditions (verso)** : on touche une condition pour la lire et la modifier en français et en arabe, la supprimer, ou en ajouter.
Boutons toujours visibles en bas : **Voir un aperçu** (contrat vierge à imprimer, ou exemple rempli) et **Enregistrer**. « Revenir aux réglages M3ak » efface les réglages de l'agence. Le modèle de contrat (cadres et champs) est fabriqué automatiquement à partir de ces réglages (migration 0042 pour les conserver) ; le propriétaire n'a rien à construire.

## Logo de l'agence (obligatoire)
Le logo se gère à un seul endroit : **Mon entreprise** (en haut). Il est **obligatoire** : sans lui, **aucun contrat ne peut être signé** (écran de signature et base de données, migration 0043), et l'accueil du propriétaire affiche un bandeau rouge qui renvoie vers Mon entreprise. L'envoi montre une **barre de chargement** avec le pourcentage (vérification, envoi, enregistrement) et explique chaque erreur en une phrase : format non accepté (PNG ou JPEG seulement), image trop lourde (5 Mo), trop petite (150 px), vide ou illisible, pas de connexion (bouton « Réessayer »), droits insuffisants, accès aux photos refusé. Le logo s'affiche en haut de chaque PDF.

## Signature du personnel (propriétaire, responsable, employé)
Profil → **Ajouter ma signature** : un petit écran s'ouvre, on signe au doigt, **Enregistrer**. La signature est ensuite collée automatiquement sur tous les contrats que cette personne fait signer. Elle peut être modifiée ou retirée à tout moment depuis le profil.

## Faire signer le client
Sur un contrat « Prêt à signer » → **Faire signer le client** :
1. **Lecture** : résumé du contrat (client, véhicule, dates, prix, caution), conditions particulières, puis les 14 articles des conditions générales, en **français ou en arabe** (au choix du client). Il faut aller jusqu'en bas et cocher « J'ai lu le contrat en entier et j'accepte » pour continuer.
2. **Signature** : le client signe au doigt dans un cadre. La signature de l'agence (profil de l'employé connecté) s'affiche à côté ; si l'employé n'en a pas, l'app propose de l'ajouter.
3. **Valider** : les deux signatures sont enregistrées, le contrat passe à « Signé » (horodaté, avec l'auteur).

## Contrat PDF (modèle M3ak standard)
Bilingue français / arabe : agence (nom, adresse, ville, téléphone, e-mail), locataire et conducteurs, véhicule, période, prix, caution, **état des lieux de départ** (s'il existe), conditions particulières, **14 articles** (objet, durée, prix, caution, conducteurs, usage, état du véhicule, carburant/kilométrage, assurance, accident/vol/panne, infractions, résiliation, données personnelles – loi 09-08, droit applicable), mention « lu et approuvé », puis les deux signatures avec nom et date.

⚠️ Les conditions générales sont un **modèle standard non validé par un juriste** : à faire relire avant usage commercial (`src/features/contracts/contract-terms.ts`).

## Cachet de l'agence
Mon entreprise → **Cachet de l'agence** (propriétaire) : photographier le tampon sur une feuille blanche bien éclairée, ou choisir une image dans la galerie. Il est apposé sur le PDF à côté de la signature de l'agence. Le cachet est **obligatoire pour signer** : sans lui, le bouton de validation est bloqué (l'écran propose au propriétaire de l'ajouter, ou indique aux autres de le demander) et la base refuse aussi la signature (migration 0039). Le PDF prend le cachet **actuel** de l'agence au moment de sa génération.

## Sécurité
- Une signature est un fichier de **tracés** (texte), jamais une image ni du code ; elle est revalidée avant affichage et avant d'entrer dans un PDF.
- Bucket privé `signatures`, isolé par agence. Chaque membre ne peut écrire que **sa** signature ; les copies figées d'un contrat (client + agence) sont en **ajout seul** : ni modification ni suppression.
- La base refuse « Signé » sans signature du client, refuse un fichier appartenant à un autre contrat, et verrouille les signatures une fois posées (migration `0037_handwritten_signatures.sql`).
- Contrats déjà signés avant la mise à jour : ils restent valides (sans signature manuscrite).

## À savoir
La valeur juridique d'une signature tracée à l'écran dépend de la réglementation et de ce que l'agence accepte comme preuve : M3ak conserve la signature, la date, l'auteur et la version du contrat, mais ne remplace pas un service de signature électronique certifiée.
