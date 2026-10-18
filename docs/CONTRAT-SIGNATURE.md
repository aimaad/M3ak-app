# Contrat : lecture, signature et cachet

## Lecture avant signature
Le client n'a plus un texte recomposé dans l'app : il ouvre **le contrat tel qu'il sera imprimé** (les mêmes 2 pages que le PDF : recto formulaire, verso conditions) dans un lecteur plein écran (`ContractViewer`, WebView), pince pour agrandir, et doit aller **jusqu'en bas** avant que la case « Lu et approuvé » devienne cochable. Puis il signe à la main.

## Toujours 2 pages
Les hauteurs de mise en page sont des estimations (calibrées sur Chromium) ; les polices d'un iPhone ne sont pas les mêmes. Trois protections empêchent une 3e page : marge d'estimation de 5 %, `overflow: hidden` sur chaque feuille (le contenu ne peut pas déborder sur une page de plus), et un petit script constant qui réduit le zoom d'une feuille si elle déborde malgré tout sur le téléphone.

## Cachet de l'agence
Deux façons, une seule active à la fois :
- **Cachet M3ak** (par défaut) : un vrai tampon dessiné en vectoriel (rond, rectangulaire ou ovale ; nom en arc, lignes au centre — raison sociale, ICE, RC, téléphone —, ville, encre bleue / rouge / noire, léger angle, posé à cheval sur la signature). Configuration enregistrée dans `agencies.stamp_config` (migration 0048), aperçu en direct dans « Mon entreprise ».
- **Photo du cachet physique** (`stamp_path`), comme avant.
Pour signer un contrat, il faut l'un OU l'autre, plus le logo (vérifié côté serveur).

## Valeur juridique (information générale, à faire valider par un avocat)
- Au Maroc, la signature électronique est encadrée par la loi 53-05 (articles 417-1 et suivants du DOC) et la loi 43-20 sur les services de confiance. Seule la signature électronique **qualifiée** (certificat délivré par un prestataire agréé) est présumée équivalente à la signature manuscrite ; une signature dessinée à l'écran est une signature électronique **simple** : recevable comme preuve, mais appréciée librement par le juge.
- Un cachet n'est pas une condition de validité d'un contrat entre particulier et agence : c'est l'usage et un repère d'identification. Un cachet numérique n'a pas de valeur particulière en soi ; la preuve repose sur le contrat signé, l'identité du client (CIN, permis) et la traçabilité (horodatage, journal, photos d'inspection).
