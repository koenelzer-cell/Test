import { useEffect, useRef } from 'react';

// Herhaalde controle die zichzelf opruimt zodra het scherm verdwijnt.
//
// Waarom niet gewoon setInterval in een effect met [callback] als afhankelijkheid:
// content.js maakt bij elke hertekening een nieuwe callback, dus de interval zou
// telkens worden afgebroken en opnieuw gestart — de klok begint dan steeds
// opnieuw en een controle van 250ms zou nooit aflopen. Daarom onthouden we de
// laatste callback in een ref en blijft de interval zelf ongemoeid.
//
// De winst t.o.v. de oude opzet: er is geen losse stop-functie meer nodig die
// van overal aangeroepen moet worden. Verdwijnt het scherm, dan ruimt React de
// interval op — vergeten kan niet meer.
export function useInterval(callback, delayMs) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (!delayMs || delayMs <= 0) return undefined;
    const id = setInterval(() => { const fn = saved.current; if (fn) fn(); }, delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
