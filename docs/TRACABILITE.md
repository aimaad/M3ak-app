# Traçabilité des actions (propriétaire uniquement)

Écran **Mon entreprise → Traçabilité**. Seul le propriétaire le voit ; l'accès est refusé aussi côté base de données (RLS), pas seulement masqué dans l'app.

## Ce qui est enregistré
Automatiquement, par des déclencheurs en base (impossible de les oublier ou de les contourner depuis l'app) :
locations (création, confirmation, remise, fin, annulation, changement de dates), paiements, clients (création, modification, archivage, documents, notes), véhicules (ajout, archivage, changement de prix), contrats, cautions, entretien, inspections, vérification avant départ, équipe (invitations, rôles, retraits), réglages (lecture automatique, recommandations IA, clé Gemini).

Chaque ligne : auteur (imposé par la session, non falsifiable), rôle, date, action, élément concerné.

## Confidentialité
- Les **notes clients** sont tracées sans leur contenu (« a ajouté une note »).
- Une modification de fiche client cite le **nom des champs** modifiés, jamais leurs valeurs.
- Aucune clé d'API, photo, CIN ni numéro de téléphone n'est copié dans le journal.
- Le journal est **en ajout seul** : aucune ligne ne peut être modifiée ni supprimée depuis l'app.
- Une panne du journal ne bloque jamais l'action de l'employé.

## Écran
Filtres période (aujourd'hui / 7 j / 30 j / tout), employé, type d'action ; synthèse « activité par personne » ; liste paginée ; bouton **Exporter en PDF** (jusqu'à 2000 lignes, avertissement au-delà), partagé via la feuille de partage du téléphone.

## À définir
Durée de conservation du journal (aujourd'hui : illimitée).
