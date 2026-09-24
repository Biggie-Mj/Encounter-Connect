# ENCOUNTER V4 — Table de jeu

Nouvelle version de la console V3.6.1 fournie, conçue pour suivre le combat tout en gardant son attention sur la table réelle.

## Utilisation rapide

1. **Préparer** : ajoute les personnages/adversaires depuis la bibliothèque, règle leurs initiatives et utilise **Modifier** pour ajuster une instance. Les modèles de la bibliothèque restent modifiables séparément.
2. **Combat** : le tour en cours porte un liseré doré et « À JOUER ». La cible sélectionnée est encadrée en bleu. Toucher une ligne sélectionne la cible ; cela ne change pas l’ordre des tours.
3. **PV** : sélectionne la cible, choisis Dégâts ou Soins, saisis le montant puis applique. Les boutons 1/5/10 sur grand écran remplissent le montant sans l’appliquer. Entrée valide une saisie. Le montant est effacé après application.
4. **Multi-cibles** : active le mode, touche les combattants concernés, puis applique une seule fois. Les groupes possèdent un bouton « Tout cibler » dans ce mode. Annuler restaure toute l’opération.
5. **Fiche** : touche ↗. Sur téléphone, la fiche s’ouvre au-dessus de la table ; « Retour aux combattants » la ferme. La barre de PV reste accessible. Sur iPad, la fiche reste à droite.
6. **Tour suivant** : avance dans l’initiative et sélectionne le nouveau combattant. Toucher le nom « À JOUER » recentre simplement la sélection sur le tour courant.
7. **Annuler** : toujours disponible en haut après une modification. Ctrl/Cmd+Z fonctionne hors des champs de saisie et des fenêtres modales.
8. **•••** : bibliothèque, rencontres sauvegardées, journal, verrouillage de structure, import/export et backups.

## Installer sur GitHub Pages

Décompresse cette archive puis remplace les fichiers de la console à la racine du dépôt existant. Ajoute bien les deux nouveaux fichiers **table.css** et **table.js**, ainsi que le nouveau **service-worker.js**. Conserve le dossier **data**, les icônes et `.nojekyll`.

Les fichiers sont déjà à la racine du ZIP : ne crée pas de dossier supplémentaire autour d’eux sur GitHub Pages.

Recharge une fois le site en ligne et ferme/réouvre les anciennes fenêtres afin de charger la V4 et son nouveau cache. La nouvelle version est identifiable par « V4.0 » dans le titre de la page. La PWA accepte maintenant le portrait et le paysage.

## Reprendre ses données

La clé de sauvegarde locale reste `encounter-console-v1`. Sur la même adresse et dans le même navigateur, la V4 reprend les données existantes. Si tu changes d’adresse, de navigateur ou d’appareil, exporte d’abord tes données en JSON depuis l’ancienne console puis utilise **••• → Importer JSON → Choisir un fichier JSON**.

Les données restent locales au navigateur : pas de synchronisation entre appareils. Les backups sont également locaux. La V4 conserve le contenu des bibliothèques fournies dans le ZIP, les rencontres et les fonctions de combat de la V3. Elle ne revalide pas les caractéristiques D&D de chaque profil.

## Vérification réalisée

14 tests de logique exécutés sur le JavaScript livré : dégâts/résistance/immunité, absorption des PV temporaires, soins plafonnés, dégâts à zéro PV, montants invalides, multi-cibles et annulation, changement de mode sans remise à zéro, tours/rounds, sauvegarde/reprise, import V3, affichage des états et échappement du nom, cible et validation du bouton.

Contrôles statiques : syntaxe JavaScript, références des fichiers, identifiants HTML uniques, JSON, manifeste et ressources de cache.

Ces tests utilisent un environnement simulé pour les éléments d’interface ; ils ne constituent pas une validation visuelle ni un test Safari/iPad réel. L’affichage tactile reste à vérifier sur les appareils de jeu.

Voir **ANALYSE-ERGONOMIE.md** pour le diagnostic et les choix de conception.

## Attribution

Le contenu SRD 5.1 reste sous CC-BY-4.0. Voir **LICENSE-SRD.txt**. Les illustrations et profils propres à la console d’origine restent inchangés.

## Connexion aux applications joueurs

Le bouton **◎ Joueurs** ajoute le contrôle MJ de RPG Connect, les demandes à valider et les adversaires révélés sans PV exacts. Lire [le guide de connexion](docs/CONNEXION-JOUEURS.md) pour l’utilisation, le relais privé fourni et les adaptations encore nécessaires dans Wonq. La connexion est facultative et commence en pause.
