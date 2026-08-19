// tests/resilience/VersionBadge.test.js — V1.0.6 GOLD: source de vérité unique config/version.js.
// Vérifie que VERSION, le texte peint dans l'UI d'accueil (#versionBadge, ui/VersionBadge.js) et
// game.meta.version restent strictement identiques à tout moment (nouvelle partie, reload d'une
// sauvegarde récente, reload d'une sauvegarde ANTÉRIEURE à V1.0.6 qui n'a jamais eu de champ
// meta.version) — jamais de chaîne de version dupliquée en dur qui pourrait diverger de la source
// unique.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { VERSION } = await import('../../src/config/version.js');
const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, saveGame, loadGame, saveKeyFor } = await import('../../src/persistence/SaveManager.js');
const { renderVersionBadge } = await import('../../src/ui/VersionBadge.js');

RNG.setSeed(606);

await test('VERSION is a non-empty descriptive string (config/version.js, the single source of truth)', async () => {
      assert(typeof VERSION === 'string' && VERSION.length > 0, 'VERSION must be a non-empty string');
    });

await test('a fresh game (newGame) stamps game.meta.version with VERSION exactly', async () => {
      newGame(false);
      assertEqual(game.meta.version, VERSION, 'game.meta.version must equal config/version.js VERSION exactly');
    });

await test('renderVersionBadge() paints #versionBadge with text derived from VERSION (UI == source of truth)', async () => {
      renderVersionBadge();
      const el = document.getElementById('versionBadge');
      assertEqual(el.textContent, `V${VERSION}`, 'UI badge text must derive from VERSION, never a hardcoded duplicate string');
    });

await test('VERSION, the UI badge text and game.meta.version are all mutually consistent at once', async () => {
      newGame(false);
      renderVersionBadge();
      const uiText = document.getElementById('versionBadge').textContent;
      assertEqual(uiText, `V${VERSION}`, 'UI badge must match VERSION');
      assertEqual(game.meta.version, VERSION, 'GameState.meta.version must match VERSION');
      assertEqual(uiText, `V${game.meta.version}`, 'UI badge and GameState.meta.version must agree with each other (both derived from the same VERSION)');
    });

await test('save/reload keeps game.meta.version equal to VERSION (never a stale value after loading)', async () => {
      newGame(false);
      await saveGame(true);
      const persistedRaw = localStorage.getItem(saveKeyFor(1));
      newGame(false);
      localStorage.setItem(saveKeyFor(1), persistedRaw);
      const loaded = await loadGame(1);
      assert(loaded, 'reload must succeed');
      assertEqual(game.meta.version, VERSION, 'game.meta.version after reload must still equal VERSION');
    });

await test('a legacy save with no meta field at all (pre-V1.0.6) is normalized to VERSION on load, never left undefined', async () => {
      newGame(false);
      await saveGame(true);
      const raw = localStorage.getItem(saveKeyFor(1));
      const s = JSON.parse(raw);
      delete s.meta; // simule une sauvegarde antérieure à V1.0.6 GOLD (aucun champ meta du tout)
      localStorage.setItem(saveKeyFor(1), JSON.stringify(s));
      const loaded = await loadGame(1);
      assert(loaded, 'reload of a legacy save (no meta field) must still succeed');
      assertEqual(game.meta.version, VERSION, 'a legacy save without meta.version must be normalized to the current VERSION, never left undefined');
    });

summary('VersionBadge.test.js');
