import { useEffect, useRef, useState } from 'react';

// Het element dat écht focus heeft. ONS bouwt met web components, dus
// document.activeElement geeft daar de host terug en niet het invoerveld
// erbinnen; zonder deze afdaling zou de hulp toetsen afvangen terwijl iemand
// in een ONS-veld typt.
function diepActiefElement() {
  let el = null;
  try { el = document.activeElement; } catch (e) { return null; }
  for (let i = 0; i < 20 && el && el.shadowRoot && el.shadowRoot.activeElement; i++) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

// Typt de gebruiker ergens? Dan blijven we overal vanaf.
function isInvoerveld(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  // Een combobox is geen <input> maar gedraagt zich wel zo.
  const rol = (el.getAttribute && el.getAttribute('role')) || '';
  return rol === 'combobox' || rol === 'textbox' || rol === 'searchbox';
}

// Sneltoetsen voor een keuzelijst: 1-9 kiest direct, pijltjes verplaatsen de
// aanwijzing, Enter bevestigt. Geeft de index terug die is aangewezen (-1 = geen),
// zodat het scherm die kan markeren.
//
// Bewust op de bubble-fase en niet op capture: ONS mag zijn eigen toetsen eerst
// afhandelen. De hulp grijpt alleen in als er nergens getypt wordt.
export function useListKeyboard({ count, onSelect, enabled = true }) {
  const [aangewezen, setAangewezen] = useState(-1);
  const aangewezenRef = useRef(-1);
  const laatste = useRef({ count, onSelect });

  useEffect(() => { laatste.current = { count, onSelect }; }, [count, onSelect]);

  // Wisselt het scherm (ander aantal opties), dan begint de aanwijzing opnieuw.
  useEffect(() => {
    aangewezenRef.current = -1;
    setAangewezen(-1);
  }, [count]);

  useEffect(() => {
    if (!enabled || !count) return undefined;
    const zet = (i) => { aangewezenRef.current = i; setAangewezen(i); };

    function opToets(e) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (e.defaultPrevented) return;
      if (isInvoerveld(diepActiefElement())) return;

      const n = laatste.current.count;
      const kies = laatste.current.onSelect;
      if (!n || typeof kies !== 'function') return;

      if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1;
        if (i < n) { e.preventDefault(); zet(i); kies(i); }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        zet(aangewezenRef.current + 1 >= n ? 0 : aangewezenRef.current + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        zet(aangewezenRef.current <= 0 ? n - 1 : aangewezenRef.current - 1);
        return;
      }
      if (e.key === 'Enter') {
        const i = aangewezenRef.current;
        if (i >= 0 && i < n) { e.preventDefault(); kies(i); }
      }
    }

    window.addEventListener('keydown', opToets);
    return () => window.removeEventListener('keydown', opToets);
  }, [enabled, count]);

  return aangewezen;
}
