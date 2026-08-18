// systems/WalkSession.js (V0.8.0) — gestion de la session de marche courante (RuntimeState): statut
// du capteur, compte de pas de la session en cours, cycle de vie de l'adaptateur actif (réel ou
// mock). Tout vit dans runtime.walk (jamais persisté, jamais lu par le check de déterminisme —
// même famille que runtime.gameSpeed/runtime.sessionStartTime). Seul point de contact entre
// l'adaptateur matériel (interface commune MotionAdapter/MockMotionAdapter) et le jeu: délègue
// systématiquement à RealWalkSystem.recordSteps() pour toute conversion en ressources.
import { eventBus } from '../core/EventBus.js';
import { runtime } from '../core/GameState.js';
import { createMotionAdapter } from '../sensors/MotionAdapter.js';
import { createMockMotionAdapter } from '../sensors/MockMotionAdapter.js';
import { recordSteps } from './RealWalkSystem.js';

let adapter = null;

function state() {
      runtime.walk = runtime.walk || { sessionSteps: 0, sensorStatus: 'idle' };
      return runtime.walk;
    }

export function walkSessionState() { return state(); }

function handleStep(count) {
      const s = state();
      s.sessionSteps += count;
      recordSteps(count); // seule porte d'entrée vers les ressources de jeu — jamais RNG, jamais tick
      eventBus.emit('walk:stepDetected', { sessionSteps: s.sessionSteps });
    }

// Active le mode "Porteur IRL". useMock=true réservé aux tests/Playwright/environnements sans
// capteur (règle 1: MockMotionAdapter.js remplace intégralement MotionAdapter.js, même contrat).
export async function activateRealWalk(useMock = false) {
      const s = state();
      if (adapter) deactivateRealWalk();
      adapter = useMock ? createMockMotionAdapter({ onStep: handleStep }) : createMotionAdapter({ onStep: handleStep });
      if (!adapter.isSupported()) {
        s.sensorStatus = 'unsupported';
        eventBus.emit('walk:sensorStatusChanged', { status: s.sensorStatus });
        return false;
      }
      const granted = await adapter.requestPermission();
      if (!granted) {
        s.sensorStatus = 'denied';
        eventBus.emit('walk:sensorStatusChanged', { status: s.sensorStatus });
        return false;
      }
      adapter.start();
      s.sensorStatus = 'active';
      eventBus.emit('walk:sensorStatusChanged', { status: s.sensorStatus });
      return true;
    }

export function deactivateRealWalk() {
      if (adapter) adapter.stop();
      adapter = null;
      const s = state();
      s.sensorStatus = 'idle';
      eventBus.emit('walk:sensorStatusChanged', { status: s.sensorStatus });
    }

// Hook de test uniquement: expose l'adaptateur actif (attendu: un MockMotionAdapter, useMock=true)
// pour que Playwright/le harnais Node puissent appeler simulateSteps() directement.
export function activeAdapter() { return adapter; }
