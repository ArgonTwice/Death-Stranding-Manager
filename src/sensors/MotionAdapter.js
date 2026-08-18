// sensors/MotionAdapter.js (V0.8.0) — SEUL module autorisé à connaître DeviceMotionEvent,
// l'événement 'devicemotion' et DeviceMotionEvent.requestPermission() (iOS 13+, contexte HTTPS
// sécurisé). Tout le reste du jeu (WalkSession.js, RealWalkSystem.js, WalkDrawer.js) ne voit jamais
// ces API directement — uniquement l'interface { requestPermission, start, stop, isSupported }
// retournée ici, identique à celle de MockMotionAdapter.js (même contrat, adaptateur interchangeable).
import { createStepDetector } from './StepDetector.js';

export function createMotionAdapter({ onStep }) {
      const detector = createStepDetector();
      let active = false;

      function handleMotion(event) {
        const a = event.accelerationIncludingGravity || event.acceleration;
        if (!a || a.x == null) return;
        const magnitude = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
        const timestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (detector.processSample(magnitude, timestamp)) onStep(1);
      }

      function isSupported() {
        return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
      }

      // iOS 13+: exige un geste utilisateur explicite + contexte HTTPS sécurisé avant d'autoriser
      // l'accès au capteur. Android/desktop: aucune permission explicite requise, considéré accordé
      // si l'API existe. Ne lance JAMAIS d'exception non gérée — retourne toujours un booléen.
      async function requestPermission() {
        if (!isSupported()) return false;
        if (typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
          return false; // devicemotion exige HTTPS (ou localhost) sur les navigateurs modernes
        }
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          try {
            const result = await DeviceMotionEvent.requestPermission();
            return result === 'granted';
          } catch {
            return false;
          }
        }
        return true; // pas de gate explicite (Android/desktop)
      }

      function start() {
        if (active || !isSupported()) return;
        window.addEventListener('devicemotion', handleMotion);
        active = true;
      }

      function stop() {
        if (!active) return;
        window.removeEventListener('devicemotion', handleMotion);
        active = false;
        detector.reset();
      }

      return { requestPermission, start, stop, isSupported };
    }
