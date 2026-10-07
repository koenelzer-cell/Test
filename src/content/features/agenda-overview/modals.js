// Dialogen met de opbouw van de weekcijfers (React-inhoud).

import { _agFmtMin } from '../../core/datetime.js';
import { _nonClientMarker } from '../../domain/registrations.js';
import { _isClientUursoortName } from '../../domain/hour-types.js';
import { mkModalShell } from '../../ui/modal-shell.js';
import { onsahReact, renderBundleMissing } from '../../ui/react-bridge.js';

// Modal met de tijd-OPBOUW (geopend door op de Cliënttijd-kaart te klikken).
// Body is React (src/components/BreakdownModalBody.jsx); de schil
// (overlay/kop/sluitknop/Esc) blijft mkModalShell.
export function showAgendaBreakdownModal(s, opts) {
  opts = opts || {}; s = s || {};
  var shell = mkModalShell('onsAgendaBreakdownModal', 'Waar de tijd uit bestaat' + (opts.week ? ', week ' + opts.week : ''));
  var _b1 = onsahReact();
  if (!_b1) { renderBundleMissing(shell.body); return; }
  _b1.renderBreakdownBody(shell.body, s, opts, _agFmtMin);
}
// Apart scherm (overlay) dat laat zien HOE de cijfers zijn opgebouwd — met de
// daadwerkelijke minuten. Puur getallen/labels uit de summary; geen cliënt-PII.
// Body is React (src/components/CalcModalBody.jsx); de cliëntgebonden-filter
// (_isClientUursoortName) blijft hier staan als domeinlogica.
export function showAgendaCalcModal(s, opts) {
  opts = opts || {}; s = s || {};
  var shell = mkModalShell('onsAgendaCalcModal', 'Verhouding per uursoort' + (opts.week ? ', week ' + opts.week : ''), { maxWidth: '460px' });
  var rows = (s.byType || []).filter(function (r) { return r && r.type && _isClientUursoortName(r.type); });
  var _b2 = onsahReact();
  if (!_b2) { renderBundleMissing(shell.body); return; }
  _b2.renderCalcBody(shell.body, rows, _nonClientMarker(), _agFmtMin);
}
