// Wordt de extensie bijgewerkt of opnieuw geladen terwijl een ONS-pagina
// openstaat, dan blijven de scripts in die pagina draaien zonder verbinding met
// de extensie: elke chrome-API faalt dan, en de nieuwe versie komt pas na
// herladen. bijLosgekoppeld(opruimen) merkt dat op (chrome.runtime.id is dan
// weg) en roept opruimen één keer aan.

const ELKE_MS = 2000;

export function bijLosgekoppeld(opruimen) {
  const timer = setInterval(() => {
    if (chrome.runtime && chrome.runtime.id) return;
    clearInterval(timer);
    opruimen();
  }, ELKE_MS);
}
