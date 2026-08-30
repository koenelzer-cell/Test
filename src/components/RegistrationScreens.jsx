import { BackButton } from './BackButton.jsx';
import { VanillaNode, VanillaNodes } from './VanillaNode.jsx';

const Pink = ({ children }) => (
  <span style={{ color: '#cc087d', fontWeight: 700 }}>{children}</span>
);

// "Vul cliënt, datum en begintijd in" — twee beheerbare tekstregels, verder niets.
export function NeedsClientScreen({ nodes }) {
  return <VanillaNodes nodes={nodes} />;
}

// Alleen de Indienen-knop (geen rapportage nodig: geen cliënt gekoppeld).
// completenessNode en submitNode blijven vanilla: die worden elders live
// bijgewerkt (updateRegistrationReportSubmitButton).
export function SubmitOnlyScreen({ completenessNode, submitNode }) {
  return (
    <div>
      <VanillaNode node={completenessNode} />
      <VanillaNode node={submitNode} />
    </div>
  );
}

// "Schrijf nu je rapportage" — de kop is beheerbare tekst (incl. de link naar de
// richtlijn), de groepsnotitie is vaste opmaak.
export function ReportPromptScreen({ msgNode, completenessNode, submitNode, tokens, onBack }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      <VanillaNode node={msgNode} />
      <div style={{ fontSize: 12, color: '#555', margin: '0 0 8px' }}>
        Let in het geval van groepsregistraties ook op de <Pink>algemene rapportage</Pink> en de{' '}
        <Pink>individuele rapportage</Pink>.
      </div>
      <br />
      <VanillaNode node={completenessNode} />
      <VanillaNode node={submitNode} />
    </div>
  );
}

// "Kies zelf de uursoort" — de lijst ontbrekende cliënten wordt elke 600ms
// ververst; die tekst komt als prop binnen i.p.v. dat een timer in de DOM schrijft.
export function ManualUursoortScreen({ missingText, subNode, instructionNode, tokens, onBack }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.35, padding: '4px 0 2px', fontWeight: 700 }}>
        {missingText}
      </div>
      <VanillaNode node={subNode} />
      <VanillaNode node={instructionNode} />
    </div>
  );
}
