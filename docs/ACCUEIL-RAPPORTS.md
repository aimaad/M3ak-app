# Accueil et rapports : indicateurs par rôle et recommandations IA

L'accueil est différent pour chaque rôle. Les données restent protégées **côté serveur** (par entreprise et par filiale :
un employé rattaché à une filiale ne reçoit que les données de sa filiale) ; la table ci-dessous ne décide que de ce qui est
**affiché**. Elle est dans `src/features/dashboard/role-layout.ts` (testée).

| Bloc | Propriétaire | Responsable | Employé |
|---|:-:|:-:|:-:|
| Finances (encaissé, reste à encaisser, résultat 30 j, entretien, panier moyen, annulations, tendance 6 mois) | ✅ | — | — |
| Flotte (état des véhicules, en location maintenant, occupation du mois) | ✅ | ✅ | ✅ |
| Activité des locations (départs/retours du jour, retards, à confirmer, 7 jours, durée moyenne, nouveaux clients) | ✅ | ✅ | — |
| Travail du jour au comptoir (départs, retours, retards, à confirmer, soldes à encaisser, disponibles, boutons Nouvelle location / Nouveau client) | — | — | ✅ |
| Performance de la flotte (véhicules peu loués ; **plus rentables** avec montants pour le propriétaire seulement) | ✅ | ✅ (sans argent) | — |
| Entretien (retards, échéances, liste) | ✅ | ✅ | — |
| Documents à renouveler | ✅ | ✅ | ✅ |
| Analyse et recommandations IA | ✅ | ✅ (sans finances) | — |

## Définitions
- **Encaissé** = paiements « payé » moins remboursements ; les paiements en attente ou échoués ne comptent pas.
- **Reste à encaisser** = prix total moins encaissé net, sur les locations commencées ou terminées (jamais négatif).
- **Occupation** = jours loués / jours disponibles (flotte active, locations en cours ou terminées, véhicules archivés exclus).
- **Peu loués** = occupation sous 20 % sur 30 jours. **Résultat 30 jours** = encaissé − frais d'entretien effectués.
- **À encaisser aujourd'hui** = retour prévu aujourd'hui ou en retard, avec un solde non réglé.
- Une nouvelle entreprise sans données affiche des zéros et « — » (jamais de calcul absurde) ; aucune variation n'est inventée
  sans mois précédent.

## Indicateurs et recommandations IA
- **Fonctionnement :** l'app envoie des **statistiques agrégées** (compteurs, totaux, quelques libellés « marque modèle ») à la
  fonction serveur `generate-insights`, qui interroge Gemini avec **la clé de l'entreprise** et renvoie un résumé, jusqu'à 4
  indicateurs déduits et 5 recommandations classées par priorité. Réponses relues et bornées, en français ou en arabe.
- **Jamais envoyé :** nom de client, téléphone, CIN, immatriculation, photo. Le serveur reconstruit lui-même les données à
  partir d'une liste blanche. Un responsable n'envoie aucun chiffre d'argent ; le serveur ignore l'argent s'il en reçoit.
- **IA non configurée :** si l'entreprise n'a pas de clé, ou si le propriétaire n'a pas activé « Recommandations IA » (Mon entreprise),
  chaque bloc IA affiche « Cet indicateur ne peut pas être affiché : l'IA n'est pas configurée / pas activée… », avec un bouton vers
  Mon entreprise pour le propriétaire. Les employés ne voient pas ce bloc.
- **Coûts maîtrisés :** résultat gardé **6 h sur l'appareil** (rouvrir l'accueil ne refait pas d'appel), bouton « Actualiser » limité à
  une fois toutes les 2 minutes, et **20 analyses par jour et par entreprise** côté serveur. Les rapports IA et leurs tokens
  apparaissent dans la console web d'administration.
- **Fiabilité :** ce sont des suggestions générées par une IA, à vérifier avant d'agir (avertissement affiché).
- **Clé gratuite :** avec une clé gratuite, Google peut utiliser les données envoyées. Elles sont agrégées et sans nom de client,
  mais pour la production utilisez une clé avec facturation activée.

## Mise en service
1. Migration `0035_ai_insights.sql` (SQL Editor, « Copy raw file »).
2. `npx supabase functions deploy generate-insights` (et redéployer `scan-document`, qui partage maintenant du code avec elle).
3. Clé de l'entreprise dans la console web, puis le propriétaire active « Recommandations IA » dans Mon entreprise.

## Vérifications
| Vérification | Résultat |
|---|---|
| Calculs (revenus, soldes, occupation, rentabilité, activité, entretien, entreprise vide) | PASS (tests Jest) |
| Qui voit quoi par rôle | PASS (tests Jest) |
| Aucune donnée personnelle dans les données IA ; responsable sans argent ; réponse relue et bornée ; cache 6 h | PASS (tests Jest) |
| Accord propriétaire seul, clé jamais lisible, suivi « insights » (tests SQL) | PASS |
| Appel réel à Gemini pour les recommandations ; qualité des conseils | NOT VERIFIED |
| Affichage sur un téléphone, vues des trois rôles | NOT VERIFIED |
