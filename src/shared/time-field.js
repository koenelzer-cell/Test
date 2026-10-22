// Tijdveld in Nederlandse notatie: 24 uur, uu:mm (09:00, 17:00). De
// tijdkiezer van de browser (<input type="time">) volgt de taal van het
// systeem en toont dan AM/PM; dit is een gewoon tekstveld dat de invoer omzet.

// '9' -> '09:00', '930' en '0930' -> '09:30', '9:30' en '9.30' -> '09:30',
// '17' -> '17:00'; geen geldige tijd -> null.
export function normalizeTime(text) {
  const s = String(text == null ? '' : text).trim().replace(/[.,]/g, ':');
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s) || /^(\d{1,2})(\d{2})$/.exec(s);
  if (!m) return null;
  const hours = +m[1], minutes = m[2] == null ? 0 : +m[2];
  if (hours > 23 || minutes > 59) return null;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

// Een tekstveld dat bij het verlaten de tijd netjes zet ('930' wordt '09:30').
// Opmaak doet de aanroeper.
export function createTimeField(value, label) {
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.maxLength = 5;
  input.placeholder = 'uu:mm';
  input.value = value || '';
  input.setAttribute('aria-label', label);
  input.addEventListener('blur', () => {
    const time = normalizeTime(input.value);
    if (time) input.value = time;
    input.setAttribute('aria-invalid', time || !input.value ? 'false' : 'true');
  });
  return input;
}
