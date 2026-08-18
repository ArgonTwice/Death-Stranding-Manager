// audio/AudioManager.js (V1.0.0) — initialisation SILENCIEUSE de l'AudioContext dès la toute première
// interaction utilisateur (règle 5: "audio silencieux par défaut"), sans bouton "Tester le son" ni
// aucun contrôle sur le Start Screen. initAudio() (SoundEngine.js) crée le contexte mais ne joue
// STRICTEMENT rien tant que l'utilisateur ne bascule pas la musique lui-même dans Options > Paramètres
// Système (OptionsPanel.js) — ce module ne fait qu'anticiper la création du contexte pour éviter le
// premier "clic à vide" que les navigateurs exigent avant tout usage de Web Audio.
import { initAudio } from './SoundEngine.js';

let armed = false;

function onFirstInteraction() {
      initAudio();
      document.removeEventListener('pointerdown', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
    }

export function initAudioManager() {
      if (armed) return;
      armed = true;
      document.addEventListener('pointerdown', onFirstInteraction, { once: true });
      document.addEventListener('keydown', onFirstInteraction, { once: true });
    }
