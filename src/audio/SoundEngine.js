// AUTO-EXTRACTED MODULE: audio/SoundEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { logEvent } from '../core/GameState.js';

let audioCtx = null, musicNodes = [], musicPlaying = false, musicGain = null, musicVolume = 0.28;

// V0.3.0 — ambiance adaptative: toute la musique passe par ce filtre passe-bas commun. On ne
// rebranche jamais les nappes individuellement — juste sa fréquence de coupure, qui monte/descend
// selon l'état du jeu (calme/tension/alerte). C'est ce qui rend la transition audible et fluide.
let masterFilter = null;
let ambienceState = 'calm';

export function isMusicPlaying() { return musicPlaying; }

export function initAudio() {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = musicVolume;
        masterFilter = audioCtx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 20000; // ouvert par défaut (calme) — indistinguable d'un lien direct
        masterFilter.Q.value = 0.5;
        musicGain.connect(masterFilter);
        masterFilter.connect(audioCtx.destination);
      } catch (e) {
        logEvent('❌ Audio indisponible sur ce navigateur: ' + e.message, 'warn');
      }
    }

// V1.0.2 — beaucoup de navigateurs créent l'AudioContext à l'état 'suspended' tant qu'aucun resume()
// explicite n'a été appelé depuis un vrai geste utilisateur (audio/AudioManager.js appelle ceci au
// tout premier pointerdown/keydown de la page), même si initAudio() a déjà tourné une fois — sans
// quoi Options > Diagnostics restait bloqué sur "AudioContext: non initialisé" ou sur l'état
// 'suspended'. Ne joue jamais aucun son (règle 5 silence par défaut) — resume() seul.
export function resumeAudioContext() {
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      audioDiag();
    }

// Bascule fluide de l'ambiance sonore entre 'calm' (nappe ouverte), 'tension' (Timefall/Tempête
// Chirale — filtre étouffé, oppressant) et un pulse ponctuel d'alerte (BT détecté).
const AMBIENCE_CUTOFF = { calm: 20000, tension: 900 };

export function setAmbienceState(state) {
      if (!audioCtx || !masterFilter) { ambienceState = state; return; }
      ambienceState = state;
      const target = AMBIENCE_CUTOFF[state] ?? AMBIENCE_CUTOFF.calm;
      masterFilter.frequency.cancelScheduledValues(audioCtx.currentTime);
      masterFilter.frequency.setTargetAtTime(target, audioCtx.currentTime, 1.4); // transition ~4s, pas de saut brutal
    }

// Pulse ponctuel (pas un état persistant): étouffe brièvement puis revient à l'ambiance courante —
// pour un repérage BT, pas pour un changement météo durable.
export function pulseAlertAmbience() {
      if (!audioCtx || !masterFilter) return;
      const now = audioCtx.currentTime;
      masterFilter.frequency.cancelScheduledValues(now);
      masterFilter.frequency.setTargetAtTime(500, now, 0.08);
      masterFilter.frequency.setTargetAtTime(AMBIENCE_CUTOFF[ambienceState] ?? AMBIENCE_CUTOFF.calm, now + 0.5, 1.2);
    }

export function audioDiag() {
      const el = document.getElementById('audioDiag');
      if (!el) return;
      if (!audioCtx) { el.textContent = 'AudioContext: non initialisé'; return; }
      el.textContent = `AudioContext: ${audioCtx.state} · sampleRate ${audioCtx.sampleRate}Hz · ${musicPlaying ? 'lecture en cours' : 'arrêté'}`;
    }

export function toggleMusic() {
      initAudio();
      audioDiag(); // affiche l'état tout de suite, sans attendre resume() (qui peut rester bloqué sur certains navigateurs)
      if (!audioCtx) return;
      try { audioCtx.resume(); } catch (e) {}
      if (musicPlaying) stopMusic(); else startMusic();
      const btn = document.getElementById('musicBtn');
      if (btn) btn.textContent = musicPlaying ? '🎵 Musique: ON' : '🎵 Musique: OFF';
      setTimeout(audioDiag, 300); // re-vérifie l'état une fois resume() éventuellement retombé
    }

export function playCinematicDrum(type = 'impact') {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const heavy = type === 'heavy';

        // Sub-oscillateur descendant: 120Hz -> 30Hz, le corps de l'impact
        const sub = audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + (heavy ? 0.45 : 0.3));
        const subGain = audioCtx.createGain();
        subGain.gain.setValueAtTime(heavy ? 0.4 : 0.22, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.65 : 0.4));
        sub.connect(subGain);
        subGain.connect(audioCtx.destination);
        sub.start(now);
        sub.stop(now + 0.7);

        // Burst de bruit filtré: l'attaque de caisse au tout début de l'impact
        const dur = 0.15;
        const bSize = Math.floor(audioCtx.sampleRate * dur);
        const buf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bSize, 2);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = heavy ? 160 : 280;
        bp.Q.value = 0.8;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.value = heavy ? 0.3 : 0.15;
        src.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        src.start(now);
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

export function playBrassStinger(intensity = 1) {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const notes = [130.8, 164.8, 196]; // C3-E3-G3, accord grave façon cor
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, now);
          filter.frequency.exponentialRampToValueAtTime(2200 * intensity, now + 0.15); // balayage rapide = attaque de cuivre
          filter.frequency.exponentialRampToValueAtTime(600, now + 1.2);
          filter.Q.value = 2;
          const g = audioCtx.createGain();
          g.gain.value = 0;
          osc.connect(filter);
          filter.connect(g);
          g.connect(audioCtx.destination);
          const start = now + i * 0.03;
          osc.start(start);
          g.gain.linearRampToValueAtTime(0.06 * intensity, start + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
          osc.stop(start + 1.7);
        });
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

export function setMusicVolume(v) {
      musicVolume = v / 100;
      if (musicGain) musicGain.gain.linearRampToValueAtTime(musicVolume, audioCtx.currentTime + 0.2);
    }

let musicTimers = [];

export function startMusic() {
      musicPlaying = true;

      // Reverb partagée (delay + feedback long) — donne l'espace/l'ampleur qu'on associe à l'ambient DS
      const reverb = audioCtx.createDelay(2);
      reverb.delayTime.value = 0.45;
      const reverbFeedback = audioCtx.createGain();
      reverbFeedback.gain.value = 0.42;
      const reverbFilter = audioCtx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.value = 2000;
      reverb.connect(reverbFilter);
      reverbFilter.connect(reverbFeedback);
      reverbFeedback.connect(reverb);
      reverb.connect(musicGain);
      musicNodes.push(reverb, reverbFeedback, reverbFilter);

      // Basse profonde et chaude (façon Low Roar): fondamentale grave seule, filtrée serré, sans les tierces
      // aiguës qui donnaient un côté "pad" plutôt que "basse d'accompagnement"
      const bassFreq = 82.4; // E2, tenue et chaude
      const bassOsc = audioCtx.createOscillator();
      bassOsc.type = 'sine';
      bassOsc.frequency.value = bassFreq;
      const bassFilter = audioCtx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.value = 320;
      const bassGain = audioCtx.createGain();
      bassGain.gain.value = 0;
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(musicGain);
      bassOsc.start();
      bassGain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 2.5);
      const bassLFO = audioCtx.createOscillator();
      bassLFO.frequency.value = 0.02;
      const bassLFOGain = audioCtx.createGain();
      bassLFOGain.gain.value = 60;
      bassLFO.connect(bassLFOGain);
      bassLFOGain.connect(bassFilter.frequency);
      bassLFO.start();
      musicNodes.push(bassOsc, bassFilter, bassGain, bassLFO, bassLFOGain);

      // Nappe médiane (accord mineur, 110-196Hz, audible sur haut-parleur mobile) — soutient la basse
      const notes = [110, 130.8, 164.8, 196]; // A2-C3-E3-G3
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004); // léger détune, texture organique
        const oscGain = audioCtx.createGain();
        oscGain.gain.value = 0;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900 + i * 150;
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(musicGain);
        osc.start();
        oscGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 2); // en retrait, la basse porte l'accompagnement

        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 0.025 + i * 0.015;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        musicNodes.push(osc, lfo, oscGain, filter, lfoGain);
      });

      // Souffle d'air / timefall organique: bruit filtré en bande, modulé TRÈS lentement (LFO façon respiration)
      // au lieu d'un filtre figé — donne l'impression d'un souffle qui varie, pas d'un sifflement statique
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 2200;
      noiseFilter.Q.value = 0.6;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(musicGain);
      noise.start();
      noiseGain.gain.linearRampToValueAtTime(0.018, audioCtx.currentTime + 5);
      const breathLFO = audioCtx.createOscillator();
      breathLFO.frequency.value = 0.04; // très lent, façon respiration/souffle
      const breathLFOGain = audioCtx.createGain();
      breathLFOGain.gain.value = 900;
      breathLFO.connect(breathLFOGain);
      breathLFOGain.connect(noiseFilter.frequency);
      breathLFO.start();
      musicNodes.push(noise, noiseFilter, noiseGain, breathLFO, breathLFOGain);

      // Arpège folk solitaire (façon Low Roar): triangle + lowpass doux 800Hz + attaque/release naturels,
      // plus proche d'une guitare/piano feutré que d'une simple note sinusoïdale
      const scale = [440, 493.9, 523.3, 587.3, 659.3, 698.5, 783.99]; // gamme mineure naturelle sur A4
      function scheduleMelodyNote() {
        if (!musicPlaying) return;
        const freq = scale[Math.floor(Math.random() * scale.length)];
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.7;
        const g = audioCtx.createGain();
        g.gain.value = 0;
        osc.connect(filter);
        filter.connect(g);
        g.connect(musicGain);
        g.connect(reverb);
        const t = audioCtx.currentTime;
        osc.start(t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.5); // attaque douce, façon picking feutré
        g.gain.exponentialRampToValueAtTime(0.0008, t + 4); // release long et mélancolique
        osc.stop(t + 4.1);
        const timer = setTimeout(scheduleMelodyNote, 5000 + Math.random() * 9000); // 5-14s entre les notes
        musicTimers.push(timer);
      }
      musicTimers.push(setTimeout(scheduleMelodyNote, 3000));

      // Craquements radio épars — évoque la résonance d'un BB Pod / signal chiral instable
      function scheduleCrackle() {
        if (!musicPlaying) return;
        const dur = 0.03 + Math.random() * 0.04;
        const bSize = Math.floor(audioCtx.sampleRate * dur);
        const buf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bSize);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3000;
        const g = audioCtx.createGain();
        g.gain.value = 0.025;
        src.connect(hp);
        hp.connect(g);
        g.connect(musicGain);
        src.start();
        const timer = setTimeout(scheduleCrackle, 7000 + Math.random() * 15000); // 7-22s entre les craquements
        musicTimers.push(timer);
      }
      musicTimers.push(setTimeout(scheduleCrackle, 6000));
    }

export function stopMusic() {
      musicPlaying = false;
      musicTimers.forEach(t => clearTimeout(t));
      musicTimers = [];
      const now = audioCtx.currentTime;
      musicGain.gain.linearRampToValueAtTime(0, now + 1.5);
      const toStop = musicNodes;
      musicNodes = [];
      setTimeout(() => {
        toStop.forEach(n => { try { n.stop && n.stop(); n.disconnect && n.disconnect(); } catch (e) {} });
        if (musicGain) musicGain.gain.value = musicVolume;
      }, 1600);
    }

export function playMenuChime() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        // Impact percussif d'ouverture façon Woodkid, puis l'arpège se déploie par-dessus l'écho de l'impact
        playCinematicDrum('heavy');

        const now = audioCtx.currentTime;
        const notes = [220, 261.6, 329.6, 440, 523.3]; // arpège mineur épars, résolution vers l'octave
        const delayNode = audioCtx.createDelay(2.5);
        delayNode.delayTime.value = 0.4; // écho plus long, façon réverbération de cathédrale
        const delayGain = audioCtx.createGain();
        delayGain.gain.value = 0.32;
        const delayFilter = audioCtx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 2400; // chaque répétition de l'écho s'assourdit un peu plus
        delayNode.connect(delayFilter);
        delayFilter.connect(delayGain);
        delayGain.connect(audioCtx.destination);
        delayGain.connect(delayNode); // feedback: écho longue traîne qui s'estompe naturellement

        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1600; // adoucit le triangle, façon corde feutrée plutôt que synthé cru
          const g = audioCtx.createGain();
          g.gain.value = 0;
          osc.connect(filter);
          filter.connect(g);
          g.connect(audioCtx.destination);
          g.connect(delayNode);
          const start = now + 0.2 + i * 0.42; // laisse l'impact percussif ouvrir le champ sonore d'abord
          osc.start(start);
          g.gain.linearRampToValueAtTime(0.07, start + 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, start + 2.4);
          osc.stop(start + 2.5);
        });
      };
      audioCtx.resume().then(play).catch(e => logEvent('❌ Chime échoué: ' + e.message, 'warn'));
    }

// --- SFX contextuels V0.3.0 — courts, synthétisés, mêmes garde-fous (initAudio + resume si suspendu) ---

export function playConstructionThud() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        [0, 0.11].forEach((offset, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(90 - i * 15, now + offset);
          osc.frequency.exponentialRampToValueAtTime(35, now + offset + 0.25);
          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.28, now + offset);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.4);
        });
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

export function playValidationChime(pitch = 1) {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        [523.3, 659.3].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq * pitch;
          const g = audioCtx.createGain();
          g.gain.value = 0;
          osc.connect(g);
          g.connect(audioCtx.destination);
          const start = now + i * 0.07;
          osc.start(start);
          g.gain.linearRampToValueAtTime(0.09, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
          osc.stop(start + 0.55);
        });
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

export function playRefusalTone() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

export function playRainSwell() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const dur = 1.2;
        const bSize = Math.floor(audioCtx.sampleRate * dur);
        const buf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) data[i] = (Math.random() * 2 - 1) * Math.min(1, i / (bSize * 0.3));
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.5;
        const g = audioCtx.createGain();
        g.gain.value = 0.05;
        src.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        src.start();
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// V0.4.0 — départ de convoi: grondement grave de moteur qui monte puis se stabilise, distinct du
// "thud" de construction (plus long, plus tendu vers l'avant — un véhicule qui s'ébranle).
export function playConvoyDepartureRumble() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(45, now);
        osc.frequency.linearRampToValueAtTime(75, now + 0.6);
        osc.frequency.linearRampToValueAtTime(55, now + 1.4);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 260;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.16, now + 0.3);
        g.gain.linearRampToValueAtTime(0.08, now + 1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
        osc.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.7);
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// --- V1.3.0 — 4 SFX synthétiques additifs (WebAudio pur, même pattern que tout ce qui précède:
// initAudio() + resume-si-suspendu, connectés directement à audioCtx.destination comme
// playCinematicDrum/playValidationChime/etc — jamais via musicGain, cohérent avec le fait que ces SFX
// contextuels ont TOUJOURS joué indépendamment du bouton "Musique: ON/OFF", cf. règle 5 ci-dessus).
// RÈGLE D'ISOLATION: aucune de ces 4 fonctions n'accède à game.*/RNG.js — la seule randomisation
// éventuelle (aucune ici, contrairement à playCinematicDrum/startMusic qui texturent du bruit via
// Math.random(), jamais RNG.js) resterait de toute façon hors du flux déterministe partagé. ---

// Clic tactile bref — navigation Cyber-Bridges 2.0 uniquement (cf. abonnement nav:mainTabChanged plus
// bas), jamais sur chaque bouton du jeu: un blip sur CHAQUE clic serait un bruit de fond agressif,
// pas un "clic tactile futuriste" ponctuel.
export function playClick() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// Jingle néon 3 notes ascendant — livraison réussie / montée d'étoile Prepper. Timbre distinct de
// playValidationChime (déjà utilisé pour les quêtes urgentes) pour que l'oreille distingue les deux
// contextes plutôt que de réutiliser exactement le même son partout.
export function playSuccess() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        [659.3, 830.6, 987.8].forEach((freq, i) => { // E5-G#5-B5, triade claire et montante
          const osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const g = audioCtx.createGain();
          g.gain.value = 0;
          osc.connect(g);
          g.connect(audioCtx.destination);
          const start = now + i * 0.06;
          osc.start(start);
          g.gain.linearRampToValueAtTime(0.08, start + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
          osc.stop(start + 0.5);
        });
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// Bip d'alerte double, net et carré — proximité BT / Timefall / camp MULE réactivé. Un bip distinct de
// playRefusalTone (grave, descendant, "refus") et de pulseAlertAmbience (filtre d'ambiance, pas un
// bip): celui-ci doit se reconnaître même coupé au milieu d'une autre ambiance sonore.
export function playAlert() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        [0, 0.16].forEach(offset => {
          const osc = audioCtx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 740;
          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.001, now + offset);
          g.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.15);
        });
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// Balayage ascendant + écho court — synchronisation du Réseau Chiral (nœud Prepper raccordé). Sweep
// continu (pas des notes discrètes) pour évoquer une poignée de main électronique, pas une mélodie.
export function playChiralConnect() {
      initAudio();
      if (!audioCtx) return;
      const play = () => {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 4;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.exponentialRampToValueAtTime(0.07, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      };
      if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {}); else play();
    }

// --- Abonnements EventBus : engine/systems ne joue jamais de son directement, il émet un événement
// et c'est le moteur audio qui décide comment le traduire en son. ---
eventBus.on('sfx:drum', (type) => playCinematicDrum(type));
eventBus.on('sfx:brass', (intensity) => playBrassStinger(intensity));

// V0.4.0 — Convois: grondement au départ, tension/impact à chaque attaque en transit.
eventBus.on('convoy:departed', () => playConvoyDepartureRumble());
eventBus.on('convoy:attacked', () => { pulseAlertAmbience(); playCinematicDrum('impact'); });
eventBus.on('convoy:arrived', ({ fullSuccess }) => { if (fullSuccess) playBrassStinger(0.6); });

// V0.3.0 — ambiance adaptative Météo/Combat/Quêtes: Exploration calme -> Tension Timefall -> Alerte BT.
eventBus.on('weather:timefallStarted', () => { setAmbienceState('tension'); playRainSwell(); });
eventBus.on('weather:chiralStormStarted', () => { setAmbienceState('tension'); playRainSwell(); });
eventBus.on('weather:cleared', () => setAmbienceState('calm'));
eventBus.on('combat:btDetected', () => { pulseAlertAmbience(); playCinematicDrum('impact'); });
eventBus.on('quest:urgent', () => playValidationChime(0.7));
eventBus.on('quest:accepted', () => playValidationChime(1));
eventBus.on('quest:negotiated', () => playValidationChime(1.25));
eventBus.on('quest:refused', () => playRefusalTone());
eventBus.on('shelter:built', () => playConstructionThud());

// V1.3.0 — 4 nouveaux SFX branchés sur des events déjà émis par la simulation mais jusqu'ici
// silencieux (delivery:resolved/prepper:starReached/network:nodeConnected n'avaient aucun son;
// mule:campReactivated est un nouvel event ajouté par CombatEngine.js#checkMuleCamps pour cette
// mission — même pattern que convoy:*/weather:* ci-dessus: la simulation émet, ce module traduit).
eventBus.on('delivery:resolved', ({ success }) => { if (success) playSuccess(); });
eventBus.on('prepper:starReached', () => playSuccess());
eventBus.on('network:nodeConnected', () => playChiralConnect());
eventBus.on('mule:campReactivated', () => playAlert());
eventBus.on('nav:mainTabChanged', () => playClick());
