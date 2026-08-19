// systems/PorterTalentTree.js (V1.7.0) — arbre de compétences par porteur du roster. Réutilise le
// système de grades DÉJÀ existant (p.grades[cat], data/Constants.js#gradeLevel — portage/combat/
// discretion/service/reseau, 0-100 -> niveau 0-4) plutôt que d'inventer un second système de
// progression parallèle: un Talent est débloqué au niveau MAXIMUM d'une branche déjà investie, jamais
// un état stocké séparément (toujours dérivé, comme prepperStars/revealedRoutes — même principe
// établi depuis V1.1). "APAS" du brief n'a aucune trace dans ce codebase (grep vérifié) — les grades
// existants (portage/combat/discretion/service/reseau) sont le vrai système de progression du jeu.
import { gradeLevel } from '../data/Constants.js';
import { BALANCE } from '../data/Balance.js';

export const TALENTS = {
      muleStealth: { category: 'discretion', name: 'Furtivité MULE', icon: '🥷', desc: 'Réduit fortement le risque de repérage par les camps MULE.' },
      timefallResist: { category: 'service', name: 'Résistance Timefall', icon: '☔', desc: 'Réduit fortement l\'usure d\'équipement pendant une Frappe Temporelle.' },
      heavyCarry: { category: 'portage', name: 'Charge Lourde', icon: '🏋️', desc: 'Capacité de charge supplémentaire fixe, au-delà du bonus de grade normal.' }
    };

export function hasTalent(porter, talentId) {
      const t = TALENTS[talentId];
      if (!t || !porter) return false;
      return gradeLevel(porter, t.category) >= BALANCE.talents.minGradeLevelForTalent;
    }

export function porterTalents(porter) {
      return Object.keys(TALENTS).filter(id => hasTalent(porter, id));
    }
