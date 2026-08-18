// sensors/MockMotionAdapter.js (V0.8.0) — adaptateur simulé, même contrat que MotionAdapter.js
// ({ requestPermission, start, stop, isSupported }), plus simulateSteps(n) pour Playwright et le
// harnais de déterminisme Node (tests/run-once.mjs). Génère des échantillons synthétiques
// (magnitude, timestamp) passés au MÊME StepDetector que le matériel réel — le pipeline de
// validation est identique, seule la source du signal change. Timestamps synthétiques
// monotones (jamais Date.now()): l'injection de milliers de pas reste instantanée et
// reproductible, indépendamment du temps réel d'exécution du test.
import { createStepDetector } from './StepDetector.js';

export function createMockMotionAdapter({ onStep }) {
      const detector = createStepDetector();
      let active = false;
      let syntheticTs = 0;

      async function requestPermission() { return true; }
      function isSupported() { return true; }
      function start() { active = true; }
      function stop() { active = false; detector.reset(); }

      // Simule n pas: pour chacun, un échantillon bas (sous le seuil, réarme le détecteur) puis un
      // pic au-dessus du seuil, espacés de intervalMs/2 — respecte le cooldown anti-triche par
      // défaut (intervalMs >= BALANCE.realWalk.stepCooldownMs pour que chaque pas soit validé).
      function simulateSteps(n, intervalMs = 400) {
        let validated = 0;
        for (let i = 0; i < n; i++) {
          detector.processSample(6, syntheticTs);
          syntheticTs += intervalMs / 2;
          const stepped = detector.processSample(14, syntheticTs);
          syntheticTs += intervalMs / 2;
          if (stepped) { validated++; onStep(1); }
        }
        return validated;
      }

      return { requestPermission, start, stop, isSupported, simulateSteps };
    }
