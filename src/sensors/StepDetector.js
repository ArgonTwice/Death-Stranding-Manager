// sensors/StepDetector.js (V0.8.0) — filtrage pur du signal d'accélération: détection de pics par
// seuil dynamique (moyenne glissante + marge), cooldown anti-triche (300ms, BALANCE.realWalk) et
// plafond de vitesse plausible (secouage frénétique ignoré). Ne connaît NI DeviceMotionEvent NI
// game.*/RNG.js — reçoit (magnitude, timestamp) déjà extraits par l'adaptateur appelant et ne fait
// que répondre "pas validé: oui/non", à charge de l'appelant de compter/persister.
import { BALANCE } from '../data/Balance.js';

const WINDOW_SIZE = 20;
const PEAK_MARGIN = 1.5; // m/s² au-dessus de la moyenne glissante pour compter comme un pic

// Instance isolée (jamais de state module-level partagé): chaque adaptateur crée son propre
// détecteur, ce qui permet à MotionAdapter et MockMotionAdapter — et plusieurs sessions de test —
// de coexister sans contaminer leurs historiques respectifs.
export function createStepDetector() {
      const history = [];
      let rising = false;
      let lastStepTimestamp = -Infinity;
      let recentStepTimestamps = []; // pour le plafond de pas/minute plausibles

      function processSample(magnitude, timestamp) {
        history.push(magnitude);
        if (history.length > WINDOW_SIZE) history.shift();
        const avg = history.reduce((a, b) => a + b, 0) / history.length;
        const threshold = avg + PEAK_MARGIN;

        if (magnitude < avg) rising = false; // redescendu sous la moyenne: prêt pour le prochain pic

        if (magnitude <= threshold || rising) return false;

        // Cooldown anti-triche: pas de double-comptage rapproché (secouage)
        if (timestamp - lastStepTimestamp < BALANCE.realWalk.stepCooldownMs) return false;

        // Plafond de vitesse plausible: purge les timestamps hors fenêtre 60s, refuse si excessif
        recentStepTimestamps = recentStepTimestamps.filter(t => timestamp - t < 60000);
        if (recentStepTimestamps.length >= BALANCE.realWalk.maxPlausibleStepsPerMinute) return false;

        rising = true;
        lastStepTimestamp = timestamp;
        recentStepTimestamps.push(timestamp);
        return true;
      }

      function reset() {
        history.length = 0;
        rising = false;
        lastStepTimestamp = -Infinity;
        recentStepTimestamps = [];
      }

      return { processSample, reset };
    }
