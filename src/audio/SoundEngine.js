// AUTO-EXTRACTED MODULE: audio/SoundEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { logEvent } from '../core/GameState.js';

let audioCtx = null, musicNodes = [], musicPlaying = false, musicGain = null, musicVolume = 0.28;

export function isMusicPlaying() { return musicPlaying; }

export function initAudio() {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = musicVolume;
        musicGain.connect(audioCtx.destination);
      } catch (e) {
        logEvent('❌ Audio indisponible sur ce navigateur: ' + e.message, 'warn');
      }
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
      const splashBtn = document.getElementById('splashMusicBtn');
      if (splashBtn) splashBtn.textContent = musicPlaying ? '🔊 Musique: ON' : '🔇 Musique: OFF';
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

export function testAudioBeep() {
      initAudio();
      audioDiag();
      if (!audioCtx) return;
      try { audioCtx.resume(); } catch (e) {}
      try {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 660;
        const g = audioCtx.createGain();
        g.gain.value = 0.25;
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start();
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.55);
        logEvent('🔊 Bip envoyé — si tu n\'entends rien, le problème est matériel/OS, pas le code');
      } catch (e) {
        logEvent('❌ Bip échoué: ' + e.message, 'warn');
      }
      setTimeout(audioDiag, 300);
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

// --- Abonnements EventBus : engine/systems ne joue jamais de son directement, il émet un événement
// et c'est le moteur audio qui décide comment le traduire en son. ---
eventBus.on('sfx:drum', (type) => playCinematicDrum(type));
eventBus.on('sfx:brass', (intensity) => playBrassStinger(intensity));
