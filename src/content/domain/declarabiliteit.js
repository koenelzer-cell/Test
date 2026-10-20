// Declarabiliteit: welke tijd telt voor welk team, en welk percentage.

import { APP_CONFIG } from '../config/app-config.js';

// Welke tijd is declarabel voor dit bedrijfsonderdeel/profiel?
//  - J&O/JBG: alleen DIRECTE tijd.
//  - JGGZ (en overige): alle CLIËNTGEBONDEN tijd.
export function declarabiliteitBase(profile) {
  const p = String(profile || '');
  // Instelbaar in het beheerscherm: regels 'profiel bevat X -> direct|client'. Eerste
  // match wint; geen match -> cliëntgebonden.
  try {
    const rules = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && Array.isArray(APP_CONFIG.declarabiliteitRules)) ? APP_CONFIG.declarabiliteitRules : null;
    if (rules && rules.length) {
      const pl = p.toLowerCase();
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i]; if (!r || !r.match) continue;
        if (pl.indexOf(String(r.match).toLowerCase()) !== -1) return (r.base === 'direct') ? 'direct' : 'client';
      }
      return 'client';
    }
  } catch (e) {}
  // Standaard (geen config): J&O/JBG -> alleen direct, anders cliëntgebonden.
  const up = p.toUpperCase();
  if (up.indexOf('J&O') !== -1 || up.indexOf('JBG') !== -1) return 'direct';
  return 'client';
}
// Declarabiliteit uit een summary (van planned óf registered): % declarabele tijd
// van de totale tijd, plus het aantal minuten en de gebruikte grondslag.
export function declarabiliteitPct(summary, profile) {
  const base = declarabiliteitBase(profile);
  // J&O/JBG: alleen directe tijd. JGGZ: alle cliëntgebonden tijd (= cliënttijd, inclusief
  // reistijd, want reistijd valt onder cliënttijd).
  const declarabel = base === 'direct' ? ((summary && summary.directMinutes) || 0) : ((summary && summary.clientMinutes) || 0);
  const total = (summary && summary.totalMinutes) || 0;
  return {
    base: base,
    baseLabel: base === 'direct' ? 'directe tijd' : 'cliëntgebonden tijd',
    declarabelMinutes: declarabel,
    totalMinutes: total,
    pct: total > 0 ? Math.round(declarabel / total * 1000) / 10 : 0,
    targetPct: 80
  };
}
