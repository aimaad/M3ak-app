# Design BIBIP

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides). Le nom de l'application est **BIBIP** et sa palette est **Emerald Ivory** (émeraude `#087F70` sur ivoire `#FAF8F1`). Les identifiants techniques (slug Expo `m3ak`, scheme `m3ak`, clés de stockage `m3ak.*`, noms de fonctions serveur, tables) gardent leur nom d'origine : les renommer casserait les liens, les données locales et le serveur.

## Logo
Le logo BIBIP est un symbole « b » (trait + cercle) accompagné de deux ondes sonores orange, suivi du texte « bibip » en minuscules (Montserrat SemiBold 600). Fichiers sources : `assets/images/bibip-symbole-gris.svg` (« b » graphite `#202527`, fond clair) et `bibip-symbole-blanc.svg` (« b » blanc, fond sombre) ; les ondes sont toujours orange `#CA531D`. Ils ne se modifient pas (empreintes vérifiées par `brand-assets.test.ts`).

Le composant `Logo` (`src/components/logo.tsx`) redessine ces mêmes tracés avec `react-native-svg` : prop `symbolOnly` pour le symbole seul, `tone` (`dark` / `light` / `auto`) pour le fond. `scripts/build-brand-assets.py` fabrique les icônes : `icon.png` (fond graphite, « b » blanc, ondes orange, symbole ≈ 60 % de la largeur), `android-icon-foreground/background/monochrome.png`, `splash-icon.png` et `favicon.png`. L'icône de l'app est le symbole seul.

## Palette BIBIP « Graphite & Orange »
**Source de vérité unique : `src/constants/brand.js`** (jetons `light` et `dark`), lue par `src/constants/theme.ts` (`Brand`, `Themes`, `Palette`, `Shadows`, `Colors`) et par `tailwind.config.js`. Le thème sombre est préparé mais l'application reste forcée en clair (`userInterfaceStyle: "light"`).

| Rôle | Jeton | Clair | Sombre | Usage |
|---|---|---|---|---|
| Fond | `background` | `#FFFFFF` | `#202527` | fond des écrans |
| Surface / surface alt. | `surface`, `surfaceAlt` | `#F6F6F5`, `#EDEEEE` | `#2A3033`, `#343B3F` | zones douces, pastilles, champs |
| Carte | `card` | `#FFFFFF` | `#2A3033` | cartes : fond + bordure, **sans ombre** |
| Bordure | `border` | `#E2E4E5` | `#3F474B` | contours de cartes et de champs |
| Texte principal | `textPrimary` | `#202527` | `#FFFFFF` | titres et texte (graphite) |
| Texte secondaire / discret | `textSecondary`, `textMuted` | `#5E6466`, `#8A9092` | — | `textMuted` : décoratif ou grand texte seulement (2,99:1 sur `surface`) |
| Orange (action) | `primary` | `#CA531D` | — | **un seul bouton plein par écran** ; blanc dessus 4,4:1, donc texte 16 px minimum et gras |
| Orange appuyé | `primaryPressed` | `#A84416` | — | état pressé ; texte d'action sur teinte claire |
| Orange doux | `primarySoft`, `onPrimarySoft` | `#FBEDE6`, `#A84416` | — | sélections, pastilles |
| Orange en texte | `accentText` | `#CA531D` | `#EC7A45` | seulement ≥ 16 px ou en gras ; petits liens en graphite avec flèche orange |
| Graphite | `Brand.graphite` | `#202527` | — | hero, carte des revenus, onglet actif, puces sélectionnées |

### Couleurs fonctionnelles
| Sens | Jeton | Valeur | Fond doux |
|---|---|---|---|
| Succès / disponible | `success` | `#1A7F53` | `successSoft` `#E3F3EB` |
| Information / en location | `info` | `#3D6FB6` | `infoSoft` `#E6EEF8` (sombre `#223246`) |
| Attention / maintenance | `warning` | `#7A5A00` | `warningSoft` `#FFF6D6` |
| Erreur / suppression | `error` | `#C42B4B` | `errorSoft` `#FBE6EA` |

Règles : dégradés et ombres colorées supprimés ; seule ombre autorisée, grise et très légère (`Shadows.raised`) pour les éléments flottants (bouton « + », feuilles, fenêtres). Les actions destructrices sont un bouton contour/texte `error`, jamais un aplat primaire, toujours avec confirmation ; le rouge est interdit pour une action non destructrice.

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, pas d'ombre sur les cartes (fond blanc + bordure), zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.

## Tableau de bord (Accueil)
Référence visuelle : `docs/design/accueil-reference.html` (maquette « premium »). L'accueil répond à une seule question : « Qu'est-ce qui demande mon attention aujourd'hui ? ». Ce qui sert à analyser est dans **Rapports**.
- **Règle de rangement** : Accueil = le travail du jour ; barre du bas = Accueil, Flotte, [+], Locations, Clients ; Rapports = pilotage hebdomadaire (Finances, Activité, Flotte, Analyse IA) ; menu du profil (avatar) = Mon profil, Mon agence, Équipe, Déconnexion. Un indicateur ne remonte dans les « Priorités » que s'il est anormal.
- **En-tête graphite** (`home-header.tsx`) : logo, notifications, avatar ; micro-libellé agence + date ; « Bonjour / Bonsoir (dès 18 h), Prénom » en Montserrat ; image de la voiture de l'ouverture (`assets/images/home-hero-car.jpg`) et pastille « N véhicules disponibles » ; onglets de période soulignés (mémorisés sur l'appareil) ; deux cartes montants **Encaissé** / **Reste à encaisser** (propriétaire seulement ; le reste à encaisser est global) ; trois chiffres de la période Actives / Départs / Retours (chacun ouvre Locations filtrée) ; lien « Voir tous les rapports ».
- **Période** : « Aujourd'hui » = en cours maintenant ; 7 j / 30 j = locations actives qui chevauchent la période. Départs et retours : locations non annulées dont le départ (ou retour) réel, sinon prévu, tombe dans la période (`periodActivity` dans `kpis.ts`).
- **Demander à BIBIP** (`ask-bibip.tsx`) : carte à cheval sur l'en-tête ; pastilles de questions (« Qui est en retard ? », « Impayés du mois », « Dispo demain ») qui envoient la question à l'assistant (`/chat/nouveau?question=…`) ;
- **Bandeau unique** (`home-notice.tsx`) sous les pastilles, refermable (mémorisé) : logo manquant > premiers pas > fin d'essai.
- **Priorités** (`priorities.ts`, `priorities-carousel.tsx`) : tri retards > impayés (propriétaire) > documents expirés > entretiens en retard > véhicules à l'arrêt (0 % sur la période) ; 3 cartes au maximum, le compteur affiche le total, « Analyse → » ouvre Rapports. Chaque carte ouvre sa liste (`accueil/retards`, `impayes`, `documents`, `vehicules-a-l-arret`, `/maintenance`). Sans priorité : « Tout est sous contrôle ».
- **Disponibilités** (`availability.ts`, `availability-section.tsx`), entre Priorités et Parc : tout le parc sur 7 jours (bande des jours, barre de répartition, véhicules libres → `/locations/nouveau?vehicleId=…&date=…`, véhicules occupés). Statut d'un jour, par priorité : Retard > Inspection / Entretien > Indisponible > Louée > À confirmer > Libre. Un retard reste « Retard » tous les jours jusqu'au retour réel ; s'il chevauche une location prévue c'est un **conflit** (sous-titre rouge + carte de Priorités « CONFLIT » → la réservation menacée). Les statuts du véhicule (inspection, maintenance, indisponible) valent pour aujourd'hui et les jours suivants. Heure locale du téléphone. **Un seul calcul** (`buildAvailability`, `freeToday`, `parcCounts`) alimente la pastille « N véhicules disponibles » de l'en-tête, le Parc et le badge du jour.
- **Parc** (`parc-section.tsx`) : jauge compte-tours animée (aiguille de 0 au taux en 600 ms), taux d'occupation, Disponibles / En location / À inspecter. **Agenda** (`agenda-section.tsx`) : À confirmer, À venir 7 j, deux prochaines locations ou encart pointillé « Réserver ».
- **Rôles** : responsable et employé ne voient ni « Encaissé », ni « Reste à encaisser », ni la priorité Trésorerie ; tout le reste est identique.
- **Rapports** (`src/app/rapports/index.tsx`) : Finances (propriétaire), Activité, Flotte (avec performance et entretiens), Analyse IA (priorités complètes, indicateurs et recommandations, mention de prudence).
- **Typographie de l'accueil** : Montserrat (prénom, nom « bibip », gros chiffres), Inter (le reste), Cairo en arabe ; interlettrage des micro-libellés coupé en arabe. Petits écrans (≤ 360 dp) : montants de 28 à 24 px, jamais tronqués.
- **Barre du bas** (`bottom-tab-bar.tsx`) : pilule graphite flottante en position absolue (16 px des bords, 26 px du bas + zone de sécurité ; les écrans à onglets laissent `useTabBarInset()` en bas de leur contenu) (rayon 34, hauteur 68), « + » orange central → `/locations/nouveau` (une réservation n'est pas un type distinct : même formulaire, statut choisi à la fin).
- **Ouverture (vidéo, 4,4 s, à chaque lancement à froid)** : `assets/video/bibip-intro-vertical-court.mp4` (1080×1920, H.264 + AAC), jouée par `expo-video` (`src/features/opening/intro-video.tsx`) sur un rideau noir plein écran (`cover`) posé par-dessus l'application, juste après le splash noir.
  - **Un toucher la passe** ; à la fin (ou au toucher) fondu de 350 ms vers l'application.
  - **Erreur ou démarrage trop lent (> 4 s)** : retour direct à l'application, sans écran d'erreur.
  - **Son** : mélangé à la musique éventuelle du téléphone (`audioMixingMode: 'mixWithOthers'`), elle n'est pas coupée.
  - **Vibration** : une seule, légère (`Light`), 0,85 s après le début de la lecture (allumage des phares), via `expo-haptics`.
  - Ignorée si animations réduites ou écran « bureau ». Jouée une seule fois par lancement à froid. `EXPO_PUBLIC_DISABLE_OPENING=1` la coupe (diagnostic).

## Calendriers (`calendar-theme.ts`, `calendar-locale.ts`)
- Un thème commun : fond blanc, chiffres foncés, jour sélectionné émeraude signature plein, aujourd'hui en pastille émeraude claire.
- Mois et jours **en français et en arabe**, semaine qui commence le **lundi**.
- Calendrier des locations : un point par statut présent ce jour-là, légende des statuts, liste colorée par statut.
- Sélection de dates : jours déjà réservés en pastille **rouge pâle avec chiffre rouge foncé** (lisibles, non sélectionnables), période choisie en émeraude.

## Chat BIBIP (`features/chat/chat-bubble.tsx`)
- Bulle de l'utilisateur : émeraude, texte blanc, coin serré côté auteur. Bulle de BIBIP : blanche, bord clair, avatar « étincelle ».
- Heure sous chaque bulle, sources en pastilles cliquables, indicateur « BIBIP écrit… » (trois points animés).
- Écran d'accueil du chat : avatar, phrase d'accueil et cartes de questions suggérées (état vide utile).
- Champ de saisie en bas, bouton d'envoi rond (émeraude quand il y a du texte, grisé sinon).

## Vérification
Les captures d'écran ont été prises en exportant l'app en version web (`npx expo export -p web`) et en l'ouvrant dans un navigateur. Le rendu sur iPhone n'a pas été vérifié par l'équipe de développement.

- **Boutons d'ajout** : plus de bouton flottant orange sur Flotte et Clients, mais un « + » graphite dans un cercle de 44 px en haut à droite (`HeaderAddButton`) ; le seul bouton orange est le « + » de la barre (nouvelle location). Équipe est un écran empilé (`/equipe`, bouton retour), ouvert depuis le menu du profil.
- **Données de démonstration** : `scripts/demo-seed/dataset.mjs` (jeu fictif : retards, impayés, document expiré, entretiens en retard, locations à venir) et `scripts/seed-demo.mjs` (insertion dans une base de TEST uniquement ; refuse toute adresse non locale sans `ALLOW_DEMO_SEED=oui`).
