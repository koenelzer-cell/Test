import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { WizardScreen } from './components/WizardScreen.jsx';

// Brug tussen het content-script (vanilla, eigenaar van alle domeinlogica) en
// deze React-bundel (de wizardschermen, puur presentatie). Aan de andere kant:
// src/content/ui/react-bridge.js. De bundel draait in dezelfde wereld als het
// content-script (isolated world), dus objecten en functies gaan
// by-reference over, zonder serialisatie. Het zijpaneel heeft zijn eigen
// React-bundel (src/sidepanel/, dist/sidepanel.js).
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
