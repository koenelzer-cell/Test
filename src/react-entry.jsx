import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AgendaWeekPanel } from './components/AgendaWeekPanel.jsx';
import { BreakdownModalBody } from './components/BreakdownModalBody.jsx';
import { CalcModalBody } from './components/CalcModalBody.jsx';
import { WizardScreen } from './components/WizardScreen.jsx';

// Bridge tussen content.js (vanilla, blijft eigenaar van alle domeinlogica)
// en deze React-bundle (puur presentatie). Beide content scripts draaien in
// dezelfde isolated world, dus objecten/functies gaan by-reference over —
// geen serialisatie nodig.
//
// Eén root per container: een tweede aanroep met dezelfde container doet
// root.render(...) opnieuw (React reconciliation) i.p.v. de container leeg te
// maken en opnieuw te vullen.
const roots = new WeakMap();

function getRoot(container) {
  let root = roots.get(container);
  if (!root) {
    // createRoot verwacht een container die het exclusief beheert; als
    // content.js er buiten de bridge om (tijdelijke tekst, foutmelding) in
    // heeft geschreven, eerst leegmaken zodat React's interne boekhouding
    // klopt met de echte DOM.
    container.replaceChildren();
    root = createRoot(container);
    roots.set(container, root);
  }
  return root;
}

window.__onsahReact = {
  renderWeekPanel(container, summary, opts, tokens, clientRows, overigRows, fmtMin, callbacks) {
    getRoot(container).render(
      createElement(AgendaWeekPanel, {
        summary, opts, tokens, clientRows, overigRows, fmtMin,
        onOpenBreakdown: callbacks && callbacks.onOpenBreakdown,
        onOpenCalc: callbacks && callbacks.onOpenCalc,
      })
    );
  },
  renderBreakdownBody(container, summary, opts, fmtMin) {
    getRoot(container).render(createElement(BreakdownModalBody, { summary, opts, fmtMin }));
  },
  renderCalcBody(container, rows, nonClientMarker, fmtMin) {
    getRoot(container).render(createElement(CalcModalBody, { rows, nonClientMarker, fmtMin }));
  },
  // Wizardscherm op naam tekenen (namen komen overeen met markScreen in
  // content.js). Eén root per container, dus opeenvolgende schermen zijn een
  // gewone re-render i.p.v. de body slopen en opnieuw opbouwen.
  renderWizardScreen(container, name, props) {
    getRoot(container).render(createElement(WizardScreen, { name: name, props: props }));
  },
  // Aanroepen voordat vanilla code een container die eerder aan render*
  // is gegeven zelf leegmaakt (bv. een foutmelding of "laden…"-tekst),
  // anders raakt React's interne boekhouding los van de echte DOM.
  unmount(container) {
    const root = roots.get(container);
    if (root) {
      root.unmount();
      roots.delete(container);
    }
  },
};
