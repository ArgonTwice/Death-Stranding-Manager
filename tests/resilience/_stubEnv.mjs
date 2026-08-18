// tests/resilience/_stubEnv.mjs — environnement DOM/localStorage minimal partagé par toute la suite
// de résilience, même pattern que tests/run-once.mjs (le harness de déterminisme existant): chaque
// fichier de test .test.js tourne dans son PROPRE processus Node (jamais de require/import réel du
// navigateur), donc aucune fuite d'état entre tests. installStubEnv() doit être appelée AVANT tout
// import dynamique de src/* (les modules lisent document/localStorage à leur premier chargement).
//
// getListenerCounts() expose un compteur RÉEL d'addEventListener (contrairement au stub muet de
// run-once.mjs) — nécessaire à CanvasLifecycle.test.js pour prouver l'absence de fuite de listeners.
export function installStubEnv({ withHistory = false } = {}) {
  const listenerCounts = new Map(); // elementId -> { [eventType]: count }

  function makeClassList() {
    const set = new Set();
    return { add(...c) { c.forEach(x => set.add(x)); }, remove(...c) { c.forEach(x => set.delete(x)); }, toggle() {}, contains(c) { return set.has(c); } };
  }
  const fakeCtx = new Proxy({}, {
    get(t, p) { if (p in t) return t[p]; return () => fakeCtx; },
    set(t, p, v) { t[p] = v; return true; }
  });
  function makeElement(id) {
    const listeners = new Map(); // eventType -> Set<fn>, pour un removeEventListener réellement effectif
    return {
      id, value: '', textContent: '', innerHTML: '',
      style: new Proxy({}, { get: () => '', set: () => true }),
      dataset: {}, children: [], classList: makeClassList(), width: 800, height: 400,
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
        const counts = listenerCounts.get(id) || {};
        counts[type] = (counts[type] || 0) + 1;
        listenerCounts.set(id, counts);
      },
      removeEventListener(type, fn) {
        const set = listeners.get(type);
        if (set && set.has(fn)) {
          set.delete(fn);
          const counts = listenerCounts.get(id) || {};
          counts[type] = Math.max(0, (counts[type] || 0) - 1);
          listenerCounts.set(id, counts);
        }
      },
      dispatch(type, evt) { const set = listeners.get(type); if (set) set.forEach(fn => fn(evt)); },
      appendChild(c) { this.children.push(c); return c; }, remove() {},
      querySelector() { return makeElement('s'); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; },
      getContext() { return fakeCtx; }, offsetWidth: 0, offsetHeight: 0
    };
  }
  const cache = {};
  globalThis.document = {
    getElementById(id) { if (!cache[id]) cache[id] = makeElement(id); return cache[id]; },
    querySelectorAll() { return []; }, querySelector() { return makeElement('q'); },
    createElement(t) { return makeElement('c-' + t); }, addEventListener() {},
    body: makeElement('body'), hidden: false
  };
  globalThis.localStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
      _raw: m // accès direct pour SaveCorruption.test.js (injection de valeurs corrompues)
    };
  })();
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.confirm = () => true;
  globalThis.window = globalThis;

  // Optionnel: history.pushState/back + window.addEventListener('popstate') minimal, synchrone (à la
  // différence d'un vrai navigateur) — suffisant pour exercer core/NavigationManager.js (pushPanel/
  // closePanel) sans jamais toucher au vrai DOM. N'installé que par les tests qui en ont besoin
  // (RngUiOrthogonality.test.js) pour ne pas polluer l'environnement minimal des autres.
  if (withHistory) {
    const globalListeners = {};
    globalThis.addEventListener = (type, fn) => { (globalListeners[type] = globalListeners[type] || []).push(fn); };
    globalThis.removeEventListener = (type, fn) => {
      const l = globalListeners[type];
      if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
    };
    let stack = [{ state: null }];
    let idx = 0;
    globalThis.history = {
      get state() { return stack[idx].state; },
      pushState(state) { stack = stack.slice(0, idx + 1); stack.push({ state }); idx = stack.length - 1; },
      replaceState(state) { stack[idx] = { state }; },
      back() {
        if (idx <= 0) return;
        idx--;
        (globalListeners.popstate || []).forEach(fn => fn({ state: stack[idx].state }));
      }
    };
  }

  return {
    cache,
    makeElement,
    getListenerCount(id, type) { return ((listenerCounts.get(id) || {})[type]) || 0; },
    totalListenerCount() {
      let total = 0;
      for (const counts of listenerCounts.values()) for (const t in counts) total += counts[t];
      return total;
    }
  };
}

// Micro-runner: chaque .test.js appelle test(name, fn) puis summary() à la fin. Pas de dépendance
// externe (Jest n'est pas installé dans ce projet — cohérent avec tests/run-once.mjs et
// tests/determinism-check.mjs, déjà de simples scripts Node zéro-dépendance).
const results = [];
export async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e });
    console.log(`  ❌ ${name}`);
    console.log(`     ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n     ') : e}`);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
export function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'assertEqual failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
export function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'assertDeepEqual failed'}:\n  expected: ${e}\n  actual:   ${a}`);
}

export function summary(suiteName) {
  const failed = results.filter(r => !r.ok);
  console.log(`\n${suiteName}: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log(`❌ ${suiteName} FAILED`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${suiteName} PASSED`);
  }
}
