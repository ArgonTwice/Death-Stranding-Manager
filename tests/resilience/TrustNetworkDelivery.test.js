// tests/resilience/TrustNetworkDelivery.test.js — V1.1 LOT 1: confiance/étoiles Prepper
// (prepper:starReached), déblocage RealWalk au premier raccordement réseau (WalkSession.js#
// activateRealWalk verrouillé au niveau moteur), et isolation du snapshot de livraison au dispatch
// manuel (engine/DeliveryEngine.js#dispatchDeliveryManually).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game, runtime } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { eventBus } = await import('../../src/core/EventBus.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { applyPrepperDeliveryOutcome, connectKnot, prepperStars } = await import('../../src/systems/PrepperSystem.js');
const { activateRealWalk, deactivateRealWalk, walkSessionState } = await import('../../src/systems/WalkSession.js');
const { dispatchDeliveryManually } = await import('../../src/engine/DeliveryEngine.js');

function freshFixture(seed) {
      RNG.setSeed(seed);
      newGame(false);
      game.money = 999999;
    }

// ============================================================
// 1. Confiance & étoiles Prepper — élévation + événement prepper:starReached aux paliers
// ============================================================
await test('a successful delivery outcome raises k.relation (trust) and prepperStars(relation) accordingly', async () => {
      freshFixture(801);
      const d = game.mapsData.mexico;
      const k = d.mainKnots[0];
      k.relation = 10; // 1 étoile (starsRelationDivisor=20 -> ceil(10/20)=1)
      assertEqual(prepperStars(k.relation), 1, 'sanity: starts at 1 star');

      applyPrepperDeliveryOutcome({ mapKey: 'mexico', prepperIdx: 0 }, true, { likes: 100 }); // gain élevé pour franchir un palier
      assert(k.relation > 10, 'a successful outcome must raise relation (trust)');
    });

await test('crossing a star threshold emits exactly one prepper:starReached event with the new star count', async () => {
      freshFixture(802);
      const d = game.mapsData.mexico;
      const k = d.mainKnots[0];
      k.relation = 19; // juste sous le palier 2 étoiles (>=21 avec divisor 20 -> ceil(21/20)=2, donc 20 -> ceil(20/20)=1 encore, 21 -> 2)
      assertEqual(prepperStars(k.relation), 1, 'sanity: still 1 star just below the threshold');

      const received = [];
      const handler = (payload) => received.push(payload);
      eventBus.on('prepper:starReached', handler);

      applyPrepperDeliveryOutcome({ mapKey: 'mexico', prepperIdx: 0 }, true, { likes: 50 }); // gain suffisant pour franchir le palier 2 étoiles

      assertEqual(received.length, 1, 'exactly one prepper:starReached event must fire when crossing a star threshold');
      assertEqual(received[0].stars, prepperStars(k.relation), 'the event payload must carry the NEW star count');
      assertEqual(received[0].name, k.name, 'the event payload must identify which prepper reached the milestone');
    });

await test('a relation LOSS (failed delivery) never fires prepper:starReached (milestones only trigger upward)', async () => {
      freshFixture(803);
      const d = game.mapsData.mexico;
      const k = d.mainKnots[0];
      k.relation = 80; // 4 étoiles
      const starsBefore = prepperStars(k.relation);

      const received = [];
      eventBus.on('prepper:starReached', (p) => received.push(p));

      applyPrepperDeliveryOutcome({ mapKey: 'mexico', prepperIdx: 0 }, false, null); // échec -> relation baisse

      assert(prepperStars(k.relation) <= starsBefore, 'sanity: relation/stars must never increase on failure');
      assertEqual(received.length, 0, 'a downward relation change must never emit prepper:starReached');
    });

// ============================================================
// 2. Déblocage RealWalk — verrouillé au niveau moteur tant qu'aucun nœud n'est raccordé
// ============================================================
await test('activateRealWalk() (the engine, not just the UI) refuses to start before the first network node is connected', async () => {
      freshFixture(804);
      assertEqual(game.progression.realWalk.unlocked, false, 'sanity: a brand new game starts locked');

      const started = await activateRealWalk(true); // useMock=true (jamais de vrai capteur en test)
      assertEqual(started, false, 'activateRealWalk() must return false while locked');
      assertEqual(walkSessionState().sensorStatus, 'idle', 'the sensor must never transition to active while locked');
    });

await test('the first successful connectKnot() unlocks RealWalk, after which activateRealWalk() succeeds', async () => {
      freshFixture(805);
      hireRaw('scout');
      const d = game.mapsData.mexico;
      connectKnot(0); // premier raccordement réseau de la partie
      assertEqual(game.progression.realWalk.unlocked, true, 'the first connectKnot() success must unlock RealWalk');

      const started = await activateRealWalk(true);
      assertEqual(started, true, 'activateRealWalk() must now succeed once unlocked');
      deactivateRealWalk();
    });

await test('a legacy save with no progression field at all is grandfathered unlocked=true (never retroactively locked)', async () => {
      const { saveGame, loadGame, serializeGame, saveKeyFor } = await import('../../src/persistence/SaveManager.js');
      freshFixture(806);
      await saveGame(true);
      const raw = localStorage.getItem(saveKeyFor(1));
      const s = JSON.parse(raw);
      delete s.progression; // simule une sauvegarde antérieure à V1.1
      localStorage.setItem(saveKeyFor(1), JSON.stringify(s));
      const loaded = await loadGame(1);
      assert(loaded, 'reload of a legacy save (no progression field) must still succeed');
      assertEqual(game.progression.realWalk.unlocked, true, 'a legacy save must be grandfathered unlocked=true, never locked out retroactively');
    });

// ============================================================
// 3. Isolation du snapshot de livraison au dispatch manuel
// ============================================================
await test('dispatchDeliveryManually() creates an isolated delivery snapshot — mutating runtime.deliveryPlanning after dispatch never affects it', async () => {
      freshFixture(807);
      hireRaw('scout');
      const porterIdx = game.porters.length - 1;
      const before = game.deliveries.length;

      runtime.deliveryPlanning = { porterId: game.porters[porterIdx].id, cargoType: 'standard', route: 'express', destX: 3, destY: 4 };
      const ok = dispatchDeliveryManually(porterIdx, runtime.deliveryPlanning.destX, runtime.deliveryPlanning.destY, { cargoType: runtime.deliveryPlanning.cargoType, route: runtime.deliveryPlanning.route });
      assert(ok, 'a valid manual dispatch on an idle porter must succeed');
      assertEqual(game.deliveries.length, before + 1, 'exactly one delivery must be created');
      const delivery = game.deliveries[game.deliveries.length - 1];
      const snapshotDestX = delivery.destX, snapshotDestY = delivery.destY, snapshotCargo = delivery.cargoType;

      // Vide/mute le formulaire de saisie APRÈS le dispatch — la livraison déjà créée ne doit jamais
      // s'en trouver affectée (aucune référence partagée, cf. commentaire de dispatchDeliveryManually).
      runtime.deliveryPlanning.destX = 0;
      runtime.deliveryPlanning.destY = 0;
      runtime.deliveryPlanning.cargoType = 'heavy';
      runtime.deliveryPlanning = { porterId: null, cargoType: null, route: null, destX: null, destY: null };

      assertEqual(delivery.destX, snapshotDestX, 'the dispatched delivery destX must stay isolated from later mutations of the planning form');
      assertEqual(delivery.destY, snapshotDestY, 'the dispatched delivery destY must stay isolated from later mutations of the planning form');
      assertEqual(delivery.cargoType, snapshotCargo, 'the dispatched delivery cargoType must stay isolated from later mutations of the planning form');
    });

await test('dispatchDeliveryManually() never marks the delivery as a quest/contract (main delivery, not side content)', async () => {
      freshFixture(808);
      hireRaw('scout');
      const porterIdx = game.porters.length - 1;
      dispatchDeliveryManually(porterIdx, 5, 5, { cargoType: 'standard' });
      const delivery = game.deliveries[game.deliveries.length - 1];
      assertEqual(delivery.quest, null, 'a manually-dispatched main delivery must never be tagged as a quest/contract downstream');
    });

await test('dispatchDeliveryManually() rejects a non-idle porter without creating a delivery', async () => {
      freshFixture(809);
      hireRaw('scout');
      const porterIdx = game.porters.length - 1;
      game.porters[porterIdx].status = 'en route';
      const before = game.deliveries.length;
      const ok = dispatchDeliveryManually(porterIdx, 5, 5, {});
      assertEqual(ok, false, 'dispatch on a non-idle porter must fail');
      assertEqual(game.deliveries.length, before, 'no delivery must be created on a rejected dispatch');
    });

summary('TrustNetworkDelivery.test.js');
