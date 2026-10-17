# Contrat complet et signatures manuscrites

## Signature du personnel (propriétaire, responsable, employé)
Profil → **Ajouter ma signature** : un petit écran s'ouvre, on signe au doigt, **Enregistrer**. La signature est ensuite collée automatiquement sur tous les contrats que cette personne fait signer. Elle peut être modifiée ou retirée à tout moment depuis le profil.

## Faire signer le client
Sur un contrat « Prêt à signer » → **Faire signer le client** :
1. **Lecture** : résumé du contrat (client, véhicule, dates, prix, caution), conditions particulières, puis les 14 articles des conditions générales, en **français ou en arabe** (au choix du client). Il faut aller jusqu'en bas et cocher « J'ai lu le contrat en entier et j'accepte » pour continuer.
2. **Signature** : le client signe au doigt dans un cadre. La signature de l'agence (profil de l'employé connecté) s'affiche à côté ; si l'employé n'en a pas, l'app propose de l'ajouter.
3. **Valider** : les deux signatures sont enregistrées, le contrat passe à « Signé » (horodaté, avec l'auteur).

## Contrat PDF
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
