/* ============================================================================
   surveyImport.js  —  Parser voor ONS-vragenlijstexports (XML).
   Wordt geladen door het beheerscherm (beheer_u.html). Zo kun je bij
   "Vragenlijsten" een ONS-XML importeren i.p.v. de vragen handmatig over te
   typen: de vraagteksten rollen als tabelrijen in de editor, waar je vervolgens
   per vraag de regel/voorwaarde instelt.

   Geen UI hier — alleen het (pure, testbare) parseren. Beschikbaar op
   window.OnsSurveyImport.
   ========================================================================== */
(function () {
  'use strict';

  function childEls(el, tag) {
    var out = [];
    if (!el || !el.children) return out;
    for (var i = 0; i < el.children.length; i++) if (el.children[i].tagName === tag) out.push(el.children[i]);
    return out;
  }
  function childText(el, tag) { var c = childEls(el, tag)[0]; return c ? (c.textContent || '').trim() : ''; }

  // Volledige structuur: { title, groups: [{ description, questions: [{ text, answerType, active, required, options }] }] }
  function parseSurveyXml(xmlString) {
    var doc = new DOMParser().parseFromString(String(xmlString || ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length || (doc.documentElement && doc.documentElement.tagName === 'parsererror')) {
      throw new Error('Dit is geen geldig XML-bestand.');
    }
    var survey = doc.documentElement && doc.documentElement.tagName === 'survey' ? doc.documentElement : doc.getElementsByTagName('survey')[0];
    if (!survey) throw new Error('Geen <survey> gevonden — is dit een ONS-vragenlijstexport?');

    var groups = [];
    childEls(survey, 'categories').forEach(function (cat) {
      childEls(cat, 'category').forEach(function (c) {
        childEls(c, 'groups').forEach(function (gs) {
          childEls(gs, 'group').forEach(function (g) {
            var questions = [];
            childEls(g, 'questions').forEach(function (qws) {
              childEls(qws, 'question').forEach(function (q) {
                var options = [];
                childEls(q, 'answerDefinitionGroup').forEach(function (adg) {
                  childEls(adg, 'answerDefinitions').forEach(function (ads) {
                    childEls(ads, 'answerDefinition').forEach(function (a) {
                      if (childText(a, 'active') !== 'false') options.push({ definition: childText(a, 'definition'), seq: parseInt(childText(a, 'sequenceNumber') || '0', 10) });
                    });
                  });
                });
                options.sort(function (x, y) { return x.seq - y.seq; });
                questions.push({
                  text: childText(q, 'text'),
                  answerType: parseInt(childText(q, 'answerType') || '0', 10),
                  required: childText(q, 'required') === 'true',
                  active: childText(q, 'active') === 'true',
                  info: childText(q, 'additionalInfo'),
                  seq: parseInt(childText(q, 'sequenceNumber') || '0', 10),
                  options: options,
                });
              });
            });
            questions.sort(function (x, y) { return x.seq - y.seq; });
            groups.push({ description: childText(g, 'description'), questions: questions });
          });
        });
      });
    });
    return { title: childText(survey, 'title') || childText(survey, 'description') || 'Vragenlijst', groups: groups };
  }

  // Vorm die de beheer-editor kan inladen: { name, questions: [{ question }] }.
  // Optioneel alleen de actieve vragen (standaard: ja), en dubbele vraagteksten
  // worden overgeslagen.
  function parseSurveyToConfig(xmlString, opts) {
    opts = opts || {};
    var includeInactive = !!opts.includeInactive;
    var survey = parseSurveyXml(xmlString);
    var questions = [];
    var seen = {};
    survey.groups.forEach(function (g) {
      g.questions.forEach(function (q) {
        if (!q.text) return;
        if (!includeInactive && !q.active) return;
        var key = q.text.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        questions.push({ question: q.text });
      });
    });
    return { name: survey.title, questions: questions };
  }

  var api = { parseSurveyXml: parseSurveyXml, parseSurveyToConfig: parseSurveyToConfig };
  try { if (typeof window !== 'undefined') window.OnsSurveyImport = api; } catch (e) {}
  try { if (typeof module !== 'undefined' && module.exports) module.exports = api; } catch (e) {}
})();
