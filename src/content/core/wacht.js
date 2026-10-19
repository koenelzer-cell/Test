// Wachten tot iets klaar is, op een signaal in plaats van met vaste timers.
//
// wachtTot(voorwaarde, { max, elke }) kijkt meteen, daarna bij elke wijziging
// in de pagina (MutationObserver, hooguit één keer per tekenronde) en als
// vangnet elke `elke` ms (wijzigingen binnen webcomponenten meldt de pagina
// niet). -> Promise met de eerste 'ware' uitkomst van voorwaarde(), of null
// als `max` ms voorbij zijn. Een fout in voorwaarde() telt als 'nog niet'.
export function wachtTot(voorwaarde, opties) {
  const max = (opties && opties.max) || 3000;
  const elke = (opties && opties.elke) || 250;
  return new Promise((klaar) => {
    let gemeld = false, gepland = false, obs = null, timer = null, tik = null;
    const einde = (w) => {
      if (gemeld) return;
      gemeld = true;
      clearTimeout(timer);
      clearInterval(tik);
      if (obs) obs.disconnect();
      klaar(w || null);
    };
    const probeer = () => {
      gepland = false;
      if (gemeld) return;
      let w = null;
      try { w = voorwaarde(); } catch (e) { w = null; }
      if (w) einde(w);
    };
    const straks = () => { if (gepland || gemeld) return; gepland = true; setTimeout(probeer, 16); };
    timer = setTimeout(() => { probeer(); einde(null); }, max);
    tik = setInterval(probeer, elke);
    try {
      obs = new MutationObserver(straks);
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) { obs = null; }
    probeer();
  });
}
