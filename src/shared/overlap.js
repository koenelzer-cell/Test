// Antwoorden van ONS' overlapcontroles lezen. Gedeeld: het content-script
// leest ze, en de main-world kijkt of het antwoord op een afspraakcontrole
// leesbaar is zonder het antwoord zelf door te geven.

// Deze endpoints zijn niet gedocumenteerd. De vorm van het antwoord is
// afgeleid, niet gegarandeerd. Daarom: herkennen wat we kunnen en anders null
// teruggeven, zodat de aanroeper op zijn eigen berekening terugvalt in plaats
// van op een gok te handelen.

// /worksheet/registrations/detect_overlap -> true (overlap), false (geen) of
// null (antwoord niet herkend).
export function parseDetectOverlap(json) {
  if (typeof json === 'boolean') return json;
  if (Array.isArray(json)) return json.length > 0;
  if (!json || typeof json !== 'object') return null;
  const boolKeys = ['overlap', 'overlaps', 'has_overlap', 'hasOverlap', 'overlapping', 'is_overlapping', 'isOverlapping'];
  for (let i = 0; i < boolKeys.length; i++) {
    const v = json[boolKeys[i]];
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
  }
  const listKeys = ['registrations', 'overlapping_registrations', 'conflicts', 'items', 'data'];
  for (let j = 0; j < listKeys.length; j++) {
    if (Array.isArray(json[listKeys[j]])) return json[listKeys[j]].length > 0;
  }
  return null;
}

// Antwoord van overlap_detection -> true (overlap), false (vrij) of null
// (niet herkend). Eerst de bekende vormen; daarna: een veld met 'overlap' of
// 'conflict' in de naam, of een object dat alleen uit lijsten bestaat.
export function parseEventOverlap(json) {
  const bekend = parseDetectOverlap(json);
  if (bekend !== null) return bekend;
  if (!json || typeof json !== 'object') return null;
  const keys = Object.keys(json);
  for (let i = 0; i < keys.length; i++) {
    if (!/overlap|conflict/i.test(keys[i])) continue;
    const v = json[keys[i]];
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0;
  }
  const lijsten = keys.filter(function (k) { return Array.isArray(json[k]); });
  if (keys.length && lijsten.length === keys.length) return lijsten.some(function (k) { return json[k].length > 0; });
  return null;
}
