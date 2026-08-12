// AUTO-EXTRACTED MODULE: persistence/SaveMigrations.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { makePrepper } from '../systems/PrepperSystem.js';

export function migratePrepperKnot(k) {
      if (k.archetype) return k; // déjà migré
      Object.assign(k, makePrepper(k.x, k.y, k.name));
      return k;
    }
