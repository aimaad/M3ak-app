# Contrat complet et signatures manuscrites

## Le contrat par défaut : carnet de location
Toutes les agences démarrent avec un contrat au format **carnet de location** (une page de cadres, puis les conditions générales au verso) : en-tête avec logo et coordonnées, numéro du contrat, **Conducteur 1** (nom, prénom, naissance, nationalité, adresse, téléphone, permis, CIN, passeport), **Véhicule et période**, **Conducteur 2**, **Paiement** (prix par jour, nombre de jours, total, caution, avance, reste, mode), **Kilométrage**, **jauge de carburant**, **schémas de l'état du véhicule** (départ et retour, à marquer à la main : R rayures, B bosses, E éclats, C cassures), franchise sinistre, signatures et cachet, ligne Patente / R.C / I.F / C.N.S.S à compléter, puis **14 articles bilingues** au verso. Les informations du client (adresse, naissance, permis…) sont figées à la création du contrat (migration 0041) ; paiements et kilométrages sont lus à la génération du PDF.

### Modifier le contrat (propriétaire)
**Mon entreprise → Modèle de contrat de l'agence → Modifier le modèle** : le propriétaire peut modifier tous les textes, **renommer, déplacer, supprimer ou ajouter des champs** dans chaque cadre (en choisissant un champ automatique dans une liste, ou une « ligne à remplir à la main »), **ajouter, déplacer ou supprimer des cadres, titres, paragraphes, schémas, jauges, séparateurs et sauts de page**, passer un cadre en demi-largeur (côte à côte) ou pleine largeur, et regarder un **aperçu PDF** avant d'enregistrer. « Revenir au modèle M3ak » recharge le modèle standard.

## Importer le contrat existant de l'agence (option)
Chaque agence a son propre contrat. Dans **Mon entreprise → Modèle de contrat de l'agence** (propriétaire), on envoie **une seule fois** un exemple de son contrat (PDF ou photos de toutes les pages, vierge ou déjà rempli) :
1. Gemini (avec la clé de l'entreprise, après accord du propriétaire) **recopie tout le texte** de l'exemple (rien n'est résumé ni omis). L'application met ensuite ce texte en forme **localement** : en-tête, titre, articles, listes, tableaux « libellé : champ », texte arabe de droite à gauche, zones de signature et de cachet. Les informations propres à une location (client, CIN, plaque, dates, montants, adresse de l'agence…) sont remplacées par des **champs automatiques** ; si l'exemple est rempli, rien du vrai client n'est conservé.
2. Le propriétaire **relit** le résultat, corrige les textes si besoin, regarde un **aperçu PDF** et enregistre.
3. Ensuite, **chaque contrat ne fait que remplir ce modèle** sur le téléphone : aucune IA, aucun délai, aucune consommation. L'IA n'est appelée qu'à l'envoi de l'exemple (limite : 10 analyses par jour).
4. Le client lit ce même texte avant de signer. À la signature, le modèle utilisé est **figé sur le contrat** : modifier le modèle plus tard ne change jamais un contrat déjà signé.
Sans modèle personnalisé (ou sans clé Gemini), l'app utilise le modèle M3ak standard ci-dessous. « Revenir au modèle standard » est possible à tout moment.

**Limites honnêtes :** la priorité est que **tout le contenu** du contrat de l'agence soit présent, dans le même ordre. La mise en page est celle de M3ak (titres, articles, listes, tableaux) : les polices, couleurs, colonnes et encadrés d'origine ne sont pas reproduits à l'identique. Une information sans champ équivalent (ex. numéro de permis) devient une ligne de points à remplir à la main.

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
