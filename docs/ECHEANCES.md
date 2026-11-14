# Échéances et obligations d'un véhicule

Ce document décrit comment M3ak suit les **obligations réglementaires** d'un véhicule de location (assurance, visite technique, vignette)
et ses **entretiens** (vidange, freins, pneus…). Il explique le processus, les règles et ce qui reste à confirmer.

## 1. Les obligations suivies

| Obligation | Ce que c'est | Période | Source |
|---|---|---|---|
| **Assurance** | Attestation d'assurance responsabilité civile (obligatoire) | Celle écrite sur l'attestation, en général 12 mois | [ACAPS, arrêté 213-05](https://www.acaps.ma/sites/default/files/2025-02/ARRETE%20N%C2%B0%20213-05%20DU%2026%20JANVIER%202005%20RELATIF%20AUX%20ASSURANCES%20OBLIGATOIRES%2C%20TEL%20QU%27IL%20A%20ETE%20MODIFIE.pdf) |
| **Visite technique** | Contrôle technique périodique (NARSA, centre agréé) | **6 mois par défaut pour la location**, réglable par agence (1 à 36 mois) | [Demarchesmaroc](https://www.demarchesmaroc.com/visite-technique/), [MarocTL](https://maroctl.com/routier/controle-technique-des-vehicules/les-differents-type-de-controles-techniques) |
| **Vignette** (taxe spéciale annuelle) | Taxe annuelle sur les véhicules | Année civile ; à payer **avant le 31 janvier** (60 jours après la carte grise pour un véhicule mis en circulation dans l'année) | [DGI](https://maroc.ma/index%2Ephp/fr/actualites/taxe-speciale-annuelle-sur-les-vehicules-paiement-au-plus-tard-le-31-janvier-2026), [Demarchesmaroc](https://www.demarchesmaroc.com/payer-vignette-auto-en-ligne/) |

**À confirmer.** La périodicité de la visite technique des voitures de location varie selon les sources (6 mois, ou procès-verbal valable
[un an](https://medias24.com/2020/06/26/les-pv-de-controle-technique-delivres-depuis-le-12-juin-valables-un-an/)) et peut avoir changé. M3ak propose 6 mois par défaut et
laisse chaque agence la régler selon ce que lui dit son centre de visite agréé. Les montants des pénalités de la vignette se contredisent
selon les sources : M3ak n'en affiche aucun. Il n'existe pas de délai de tolérance connu pour l'assurance : aucun n'est appliqué.

## 2. Une période, pas une date

Chaque obligation est une suite de **périodes** (table `vehicle_compliance`) : du … au …, avec le n° de police (ou de procès-verbal, ou de
quittance), l'assureur (ou le centre), le montant et la photo du papier. **Renouveler ajoute une période** ; l'ancienne reste dans
l'historique. La **période en cours** est celle dont la fin est la plus lointaine.

La fin d'une période est le **dernier jour couvert** : une assurance qui finit aujourd'hui est encore valable aujourd'hui, expirée demain.

## 3. États

| État | Règle |
|---|---|
| À jour | fin dans plus de 30 jours |
| Bientôt | 30 jours ou moins |
| Urgent | 7 jours ou moins (y compris le jour même) |
| Expirée | fin dépassée |
| Non renseignée | aucune période enregistrée — **jamais traité comme « expirée »** (les véhicules déjà dans l'application n'ont pas d'historique) |

Vignette : à jour quand la période couvre l'année en cours ; la prochaine date limite est alors le 31 janvier suivant. Si l'année en cours
n'est pas couverte, la date limite est le 31 janvier de cette année, puis « expirée ».

## 4. Renouveler (sur la fiche du véhicule)

*Fiche → Échéances → Obligations légales → toucher la ligne → Renouveler.* La période est proposée (modifiable) :

- assurance : 12 mois, à partir du lendemain de la fin en cours (ou d'aujourd'hui si elle est expirée ou absente) ;
- visite technique : à partir d'aujourd'hui, pour la périodicité réglée par l'agence ;
- vignette : l'année civile (la suivante si l'année en cours est déjà couverte).

Contrôles : fin obligatoire et réelle ; début pas après la fin ; la nouvelle période doit **finir après la période en cours** (sinon c'est une
correction, à faire sur la ligne de l'historique) ; montant positif ; longueurs. La photo est envoyée **avant** l'enregistrement : si l'envoi
échoue, rien n'est enregistré. Un même renouvellement envoyé deux fois (double appui) ne crée pas de doublon.

## 5. Qui peut quoi

| Action | Employé | Responsable | Propriétaire |
|---|---|---|---|
| Voir les périodes, renouveler | oui | oui | oui |
| Voir les montants | non | non | oui |
| Corriger ou supprimer une période | non | oui | oui |
| Régler la périodicité de la visite | non | oui | oui |

Appliqué par la base de données (RLS), avec la même isolation par filiale que le reste ; l'agence d'une période est toujours celle du véhicule.

## 6. Avertissements avant une location

À la création d'une location (choix du véhicule et récapitulatif) et dans la liste de contrôle avant départ : carte « À vérifier avant de louer » si
l'assurance ou la visite est **absente**, **expirée au départ** ou **expire pendant la location**, ou si la vignette est expirée. C'est un
**simple avertissement** : la location reste possible (décision de l'agence).

## 7. Rappels

Chaque heure (pg_cron, 7 h – 21 h heure du Maroc), pour le **propriétaire et les responsables** : palier à 30, 15, 7, 3, 1 jour(s) et le jour
même (une fois par palier) ; après l'échéance, « expirée » dès le lendemain puis tous les 7 jours jusqu'au renouvellement. Un renouvellement
repart de zéro. Un véhicule archivé ou sans période ne déclenche rien.

## 8. Cohérence avec le reste de l'application

« À surveiller » (Ma Flotte), le chat M3ak et les rappels d'entretien lisent encore les dates d'expiration des **documents** du véhicule et les
**échéances d'entretien**. À chaque période ajoutée, corrigée ou supprimée, la base remet ces deux endroits d'accord avec la période en cours,
dans la même transaction. Dans l'autre sens, une date saisie à l'ajout d'un véhicule (sans photo) crée aussi la période.

## 9. Entretiens

Vidange, freins, pneus, autre : échéance par **date** et/ou **kilométrage**, corrigeable sur place, « Marquer comme fait » ouvre l'écran de
l'entretien (garage, pièces, coût, facture). Suggestions d'usage : vidange +10 000 km ou 12 mois, freins +30 000 km, pneus +40 000 km.

## 10. Mise en route

Migrations `0069` (table, droits, reprise de l'existant, synchronisation) puis `0070` (rappels, pg_cron). Fonction `send-push` à redéployer
pour les nouveaux textes. La reprise de l'existant est rejouable.
