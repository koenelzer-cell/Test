// Beheerbare schermteksten (beheerscherm): opmaak, veilige HTML en
// plaatshouders als {clientNaam}.

import { APP_CONFIG } from '../config/app-config.js';
import { findClientEntries, findClientNameText } from '../ons/appointment-form.js';
import { deepQueryAll } from '../ons/dom.js';

// (Het weekoverzicht wordt getoond ín de agendahulp-panel; zie de agenda-module
// hieronder — geen los paneel en geen popup-knop meer.)

function effectiveTextConfig(key) {
  return ((APP_CONFIG.texts || {})[key]) || {};
}
// Bouw een gestileerd tekst-element uit de beheerbare 'texts'-config. `key`
// bepaalt welke instelling geldt; fallbackText/defaultStyle zijn de code-standaard.
export function managedRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','A','MARK','FONT','BR','P','DIV','SPAN','H2','H3','H4','BLOCKQUOTE','PRE','CODE','UL','OL','LI']);
  template.content.querySelectorAll('script,style,iframe,object,embed,img,svg,form,input,button,link,meta,base,template,noscript,math,frame,frameset,marquee,title').forEach((el) => el.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
    const originalHref = el.tagName === 'A' ? String(el.getAttribute('href') || '') : '';
    const originalColor = el.tagName === 'FONT' ? String(el.getAttribute('color') || '') : '';
    const originalStyle = {
      color: el.style.color || originalColor,
      backgroundColor: el.style.backgroundColor,
      fontWeight: el.style.fontWeight,
      fontStyle: el.style.fontStyle,
      textDecoration: el.style.textDecoration
    };
    [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
    if (el.tagName === 'A' && /^(?:https?:\/\/|mailto:|#)/i.test(originalHref)) {
      el.setAttribute('href', originalHref);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    const styleProbe = document.createElement('span').style;
    ['color','backgroundColor','fontWeight','fontStyle','textDecoration'].forEach((prop) => {
      const value = String(originalStyle[prop] || '').trim();
      if (!value) return;
      styleProbe[prop] = '';
      styleProbe[prop] = value;
      if (styleProbe[prop]) el.style[prop] = styleProbe[prop];
    });
    if (el.tagName === 'A') {
      if (!el.style.color) el.style.color = '#cc087d';
      if (!el.style.textDecoration) el.style.textDecoration = 'underline';
    }
  });
  return template.content;
}
function managedTagClientName() {
  try { if (typeof findClientNameText === 'function') { const found=findClientNameText();if(found)return found; } } catch (e) {}
  try { if (typeof findClientEntries === 'function') { const entries=findClientEntries();if(entries&&entries[0]&&entries[0].name)return entries[0].name; } } catch (e) {}
  const selectors='[data-invitee-name],[data-client-name],[data-testid="client-details-name"],[data-testid="client-name"],.client-name';
  const nodes=typeof deepQueryAll==='function'?deepQueryAll(selectors):Array.from(document.querySelectorAll(selectors));
  for(const node of nodes){const raw=(node.getAttribute&&((node.getAttribute('data-invitee-name')||node.getAttribute('data-client-name'))))||node.textContent||'';const name=String(raw).replace(/\s+/g,' ').trim();if(name&&name.length<=100)return name;}
  return '';
}
function managedTagClientAge() {
  const selectors='[data-testid="client-details-birthdate"],[data-date-of-birth],[data-birthdate],[class*="birthdate" i],[class*="geboorte" i]';
  const nodes=typeof deepQueryAll==='function'?deepQueryAll(selectors):Array.from(document.querySelectorAll(selectors));
  for(const node of nodes){const raw=[node.textContent,node.getAttribute&&node.getAttribute('data-date-of-birth'),node.getAttribute&&node.getAttribute('data-birthdate'),node.getAttribute&&node.getAttribute('aria-label'),node.getAttribute&&node.getAttribute('title')].filter(Boolean).join(' ');const direct=raw.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);if(direct){const age=parseInt(direct[1]||direct[2],10);if(age>=0&&age<=125)return age;}const dob=raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);if(dob){const born=new Date(+dob[3],+dob[2]-1,+dob[1]),now=new Date();let age=now.getFullYear()-born.getFullYear();if(now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate()))age--;if(age>=0&&age<=125)return age;}}
  return null;
}
function managedTagValues() { return { clientNaam:managedTagClientName(), clientLeeftijd:managedTagClientAge() }; }
function replaceManagedTagsIn(root) {
  const values=managedTagValues();
  const replace=(text)=>String(text||'').replace(/\{clientNaam\}/gi,values.clientNaam||'{clientNaam}').replace(/\{clientLeeftijd\}/gi,values.clientLeeftijd==null?'{clientLeeftijd}':String(values.clientLeeftijd));
  const walk=(node)=>{if(node.nodeType===3){node.nodeValue=replace(node.nodeValue);return;}Array.from(node.childNodes||[]).forEach(walk);};walk(root);return root;
}
export function mkText(key, fallbackText, defaultStyle) {
  const el = document.createElement('div');
  const c = APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? {} : effectiveTextConfig(key);
  if (c.html) el.appendChild(managedRichHtml(c.html).cloneNode(true));
  else el.textContent = (c.text != null && c.text !== '') ? c.text : fallbackText;
  replaceManagedTagsIn(el);
  el.style.whiteSpace = 'pre-wrap';
  if (defaultStyle) Object.assign(el.style, defaultStyle);
  if (c.color) el.style.color = c.color;
  if (c.bold === true) el.style.fontWeight = '700'; else if (c.bold === false) el.style.fontWeight = '400';
  if (c.italic === true) el.style.fontStyle = 'italic'; else if (c.italic === false) el.style.fontStyle = 'normal';
  if (c.sizePx) el.style.fontSize = (parseInt(c.sizePx, 10) || 13) + 'px';
  return el;
}
export function resolveText(key) { return APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? null : effectiveTextConfig(key); }
