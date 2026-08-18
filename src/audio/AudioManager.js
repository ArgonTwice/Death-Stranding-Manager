// audio/AudioManager.js (V1.0.0, listener durci V1.0.2) — initialisation SILENCIEUSE de l'AudioContext
// dès la toute première interaction utilisateur (règle 5: "audio silencieux par défaut"), sans bouton
// "Tester le son" ni aucun contrôle sur le Start Screen. initAudio() (SoundEngine.js) crée le contexte
// mais ne joue STRICTEMENT rien tant que l'utilisateur ne bascule pas la musique lui-même dans
// Options > Paramètres Système (OptionsPanel.js) — ce module ne fait qu'anticiper la création +
// le resume() du contexte pour éviter le premier "clic à vide" que les navigateurs exigent avant tout
// usage de Web Audio.
//
// V1.0.2: écouteur posé sur `window` (pas seulement `document`) et appel explicite de resume() (pas
// juste initAudio()) — certains navigateurs créent l'AudioContext à l'état 'suspended' même pendant un
// geste utilisateur, ce qui laissait le diagnostic Options bloqué sur "non initialisé"/'suspended'.
// V1.0.3: ajout explicite de 'touchstart' à côté de 'pointerdown' — iOS Safari (y compris en PWA
// plein écran) exige que resume() soit appelé DEPUIS le geste tactile "le plus direct" possible; sur
// certaines versions, un pointerdown déclenché après une synthèse d'événements tactiles (ou capturé
// par un ancêtre avec touch-action différent) ne compte plus comme un "vrai" geste utilisateur aux
// yeux du navigateur et le resume() échoue silencieusement (`.catch(() => {})` dans SoundEngine.js).
// touchstart en `passive: true` (aucun preventDefault ici) reste le seul événement garanti fiable sur
// iOS pour ce cas précis.
import { resumeAudioContext } from './SoundEngine.js';

let armed = false;

function onFirstInteraction() {
      resumeAudioContext();
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
    }

export function initAudioManager() {
      if (armed) return;
      armed = true;
      window.addEventListener('pointerdown', onFirstInteraction, { once: true });
      window.addEventListener('keydown', onFirstInteraction, { once: true });
      window.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
    }
