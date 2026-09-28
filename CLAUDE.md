# M3ak — application mobile de gestion pour agences de location de voitures (Maroc)

Tu développes **M3ak** (« معاك », « avec toi »), une app mobile tout-en-un pour les agences de location de voitures au Maroc. Lis `docs/PRODUIT.md` (vision et fonctionnalités), `docs/ARCHITECTURE.md` (stack et modèle de données) et `docs/ROADMAP.md` (ordre de développement) avant toute tâche importante. Les maquettes Figma de référence sont dans `docs/design/`.

## Ce qui rend M3ak unique
1. **Inspection par caméra IA** : l'employé photographie la voiture au retour ; l'app compare avec l'inspection de départ et liste les **nouveaux** dommages (emplacement, gravité, confiance, coût estimé), puis génère un rapport partageable par WhatsApp et calcule la retenue sur la caution.
2. **Chat M3ak** : l'employé pose une question en darija, français ou arabe (« شكون كرا هاد الطوموبيل ملي وقع هاد الضرر؟ ») ; l'app répond **à partir des données de l'agence** (locations, inspections, maintenance, paiements).
3. **Alertes intelligentes** : vidange, assurance, visite technique, freins, demande en hausse, véhicules sous-utilisés.

## Utilisateurs et langues
- Employé de comptoir, responsable de flotte, gérant (rôles et permissions différents).
- Interface en **français et arabe (RTL)** ; le chat comprend aussi la **darija**. Toute chaîne de texte passe par l'i18n, jamais en dur.
- Monnaie : MAD. Formats marocains : immatriculation (ex. `8921 | ب | 14`), CIN, téléphone +212.
- Beaucoup d'agences ont une connexion moyenne : l'inspection doit fonctionner hors ligne et se synchroniser ensuite.

## Règles de travail
- Avance **par petites étapes** vérifiables en suivant `docs/ROADMAP.md` ; coche les étapes terminées dans ce fichier.
- Avant d'écrire du code pour une nouvelle fonctionnalité, propose un court plan et attends mon accord si le choix est structurant (base de données, dépendance lourde, service payant).
- TypeScript strict partout. Pas de clé secrète dans le code de l'app mobile : les appels IA passent par des fonctions serveur.
- Écris des tests pour la logique métier (calcul de caution, comparaison des dommages, disponibilités, permissions).
- Après chaque étape : lance les vérifications (types, lint, tests) et explique-moi en français, simplement, ce qui a été fait et comment le tester sur mon téléphone. Je ne suis pas développeur expert.
- La sécurité des données clients (CIN, téléphones, photos) est prioritaire : chaque agence ne voit que ses propres données (Row Level Security).
