# Roadmap V2.0 — Idées de refonte majeures (non implémentées)

> Document d'archivage, créé en V1.21.0. Regroupe des concepts de refonte structurelle jugés trop
> larges/risqués pour une passe de fine-tuning classique (feature creep, risque déterminisme,
> ampleur UI). **Rien ici n'est implémenté** — ce fichier sert de mémoire externe pour une future
> mission V2.0 explicitement dédiée, afin d'éviter de re-halluciner une architecture from scratch
> à chaque nouveau brief qui redemande une variante de ces mêmes idées.
>
> Convention: chaque idée référence le code RÉEL déjà en place sur lequel elle s'appuierait, pas une
> architecture fictive. Si un futur brief propose un concept déjà couvert ici sous un autre nom,
> vérifier D'ABORD ce fichier avant d'investiguer à froid.

---

## 1. Système de Blueprints & Artisanat unifié

**Idée du brief**: remplacer l'achat direct d'équipement par un arbre Prepper → Blueprint → Craft.

**État réel actuel**: le jeu a déjà DEUX systèmes de déblocage par étoiles Prepper, parallèles et
non unifiés:
- `data/UnlockTree.js#EQUIP_MIN_STARS` / `VEHICLE_MIN_STARS` — gate l'ACHAT direct en Boutique
  (`systems/EconomySystem.js#buyEquip`/`buyVehicle`), contre `game.money`.
- `data/UnlockTree.js#RECIPE_MIN_STARS` — gate le CRAFT au Chaudron chiral
  (`engine/DeliveryEngine.js#craft`), contre `game.materials.*` (ferraille MULE, cristaux chiraux...),
  nécessite `game.structures.cauldron` construit.

Ce sont deux économies séparées (argent vs matériaux) menant à des résultats qui se recoupent
partiellement (ex: un exosquelette s'achète en Boutique, `legendary_exo` se craft — pas le même objet
mais la même famille conceptuelle).

**Piste V2.0**: fusionner en un seul pipeline Prepper → Blueprint → Craft:
- Un item d'équipement "lourd" (véhicule, exo) ne serait plus achetable en argent direct, mais
  débloqué comme *blueprint* (via étoiles Prepper, comme aujourd'hui) puis CRAFTÉ (coût matériaux +
  argent réduit), réutilisant `RECIPES`/`craft()` comme mécanisme unique plutôt que deux chemins
  (`buyEquip` ET `craft`).
- Risque principal: `buyEquip()`/`buyVehicle()` sont profondément ancrés dans
  `systems/PorterAiEngine.js` (achats autonomes IA) et plusieurs tests (`AntiSpamTransaction.test.js`,
  `BlueprintGating.test.js`). Une fusion toucherait ces deux chemins simultanément — nécessiterait de
  décider si l'IA autonome sait aussi crafter, ou reste limitée à l'argent.
- Ampleur estimée: refonte moyenne-large, pas un simple recalibrage de constantes.

---

## 2. Écran de Planification & Dispatch approfondi

**Idée du brief**: calcul de bénéfice net en amont du dispatch, choix d'itinéraire/risque dédié.

**État réel actuel**:
- `engine/DeliveryEngine.js#estimateNetMargin(d)` existe déjà (ajouté V1.17.0/V1.18.0) — calcule
  `{ gross, salaryCost, fuelCost, wearCost, net }` à partir d'une livraison EN COURS. Affiché sur les
  cartes Dashboard (`ui/HUD.js#renderCommandCenter`) et QuestPanel (`ui/QuestPanel.js#inProgressCardHtml`).
- `ui/DeliveryPlanningPanel.js` (vue "Commandes Principales") permet déjà de choisir
  destination/cargo/route AVANT dispatch (`porterDispatchRowHtml`), mais n'affiche AUCUNE estimation
  de marge nette avant validation — le joueur choisit à l'aveugle, la marge n'apparaît qu'APRÈS le
  départ (une fois la livraison "en cours").

**Piste V2.0**: appeler `estimateNetMargin()` (ou une variante `estimateNetMarginPreview(porter, destX,
destY, cargoType, route)` qui ne nécessite pas encore un objet `delivery` réel) directement dans
`porterDispatchRowHtml()`, avec un recalcul live à chaque changement de `<select>` (destination/cargo/
route) via un listener JS, avant le clic sur "Envoyer". Extension naturelle et de faible ampleur du
système existant — PAS une refonte, contrairement à l'idée 1. Risque déterminisme nul (uniquement de
l'affichage, aucune consommation RNG).

---

## 3. Arbre de hiérarchie UI à 3 niveaux (Core / Contextuel / Meta)

**Idée du brief**: fluidifier la navigation globale via 3 paliers d'UI.

**État réel actuel**: la navigation a déjà été partiellement restructurée en ce sens sur plusieurs
missions successives, sans jamais être formalisée comme un système explicite à 3 niveaux:
- **Niveau "Core" (déjà existant, non nommé ainsi)**: le Dashboard "Centre de Commande"
  (`ui/HUD.js#renderCommandCenter`, `#dashboardCommandCenter`) — 3 cartes prioritaires (Action
  Prioritaire/Alerte Terrain/Progression Réseau), conçu en V1.16.0 pour concentrer l'essentiel.
- **Niveau "Contextuel" (déjà existant)**: `.map-action-bar` (Quêtes/Convois/Porteurs/Réseau/PorterIRL/
  RaidTactique) — drawers ouverts à la demande depuis la carte, action situationnelle.
- **Niveau "Meta" (déjà existant, partiellement)**: Options > Gestion (Télémétrie/Terminal) et
  Logistique > Archives (Hall of Fame) — vues secondaires reléguées hors du flux principal depuis
  V1.17.0/V1.18.0 (suppression de `.map-action-bar` pour Télémétrie/Terminal/HallOfFame).

**Piste V2.0**: PAS une nouvelle UI à construire — un exercice de FORMALISATION/AUDIT de ce qui existe
déjà, pour vérifier qu'aucune vue ne s'est glissée au mauvais niveau au fil des missions successives
(risque réel: chaque brief a ajouté ses propres boutons/drawers sans grille de lecture explicite,
cf. `index.html` qui accumule des sections ad hoc). Un futur audit pourrait cartographier chaque
élément d'UI existant contre ces 3 paliers et documenter les écarts, avant d'envisager tout
déplacement — un déplacement de bouton peut sembler cosmétique mais a déjà causé une régression
sérieuse par le passé (cf. onboarding softlock V1.18.0, où le retrait d'un bouton manuel a caché le
seul levier de croissance réseau derrière un rang tardif — toute réorganisation UI doit être vérifiée
visuellement en conditions quasi-réelles, pas seulement par des tests unitaires qui contournent les
gates UI).

---

## Notes générales pour une future mission V2.0

- Ces 3 idées sont de nature et d'ampleur très différentes: l'idée 2 est une extension mineure
  quasi-immédiate, l'idée 3 est un audit avant toute refonte, l'idée 1 est la seule véritable refonte
  structurelle risquant de toucher plusieurs systèmes simultanément (Boutique, Chaudron, IA
  autonome).
- Aucune de ces idées ne doit être traitée comme un "fine-tuning" — si un brief futur les redemande
  sous couvert d'un simple ajustement `Balance.js`, c'est un signal qu'il confond les deux catégories
  (voir [[feedback-dsm-working-mandate]] en mémoire projet).
- Toute implémentation future doit suivre le même protocole de validation déjà établi:
  `npm run test`, `node tests/determinism-check.mjs`, `npm run snapshot:verify`,
  `node tests/balancing-simulation.test.mjs`, plus une vérification visuelle Playwright pour toute
  idée touchant l'UI (idées 2 et 3 particulièrement).
