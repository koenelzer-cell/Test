import { InfoScreen } from './InfoScreen.jsx';
import { ChoicesScreen } from './ChoicesScreen.jsx';
import { PickListScreen } from './PickListScreen.jsx';
import { NeedsPrereqsScreen } from './NeedsPrereqsScreen.jsx';
import { MessageScreen } from './MessageScreen.jsx';
import { DurationScreen } from './DurationScreen.jsx';
import { PromptScreen } from './PromptScreen.jsx';
import { CategoryScreen } from './CategoryScreen.jsx';
import { PortionQuestionScreen } from './PortionQuestionScreen.jsx';
import { ReadyToSaveScreen } from './ReadyToSaveScreen.jsx';
import {
  NeedsClientScreen, SubmitOnlyScreen, ReportPromptScreen, ManualUursoortScreen,
} from './RegistrationScreens.jsx';
import { NavButton } from './NavButton.jsx';
export { PreviewList } from './PreviewList.jsx';

// Eén ingang voor alle wizardschermen: content.js zegt wélk scherm het is
// (dezelfde namen als markScreen gebruikt) en levert de gegevens; hier wordt
// dat naar het bijbehorende component vertaald. Zo groeit de migratie
// scherm-voor-scherm zonder dat content.js van componentbestanden hoeft te weten.
export function WizardScreen({ name, props }) {
  const p = props || {};
  switch (name) {
    case 'infoScreen':
      return <InfoScreen {...p} />;
    case 'messageScreen':
      return <MessageScreen {...p} />;
    case 'choices':
      return (
        <ChoicesScreen
          {...p}
          extra={p.showSaveNav ? <div style={{ marginTop: 6 }}><NavButton label="Naar opslaan" onClick={p.onSaveNav} tokens={p.tokens} /></div> : null}
        />
      );
    case 'pickList':
      return <PickListScreen {...p} />;
    case 'needsPrereqs':
      return <NeedsPrereqsScreen {...p} />;
    case 'duration':
      return <DurationScreen {...p} />;
    case 'prompt':
      return <PromptScreen {...p} />;
    case 'category':
      return <CategoryScreen {...p} />;
    case 'portionQuestion':
      return <PortionQuestionScreen {...p} />;
    case 'readyToSave':
      return <ReadyToSaveScreen {...p} />;
    case 'needsClient':
      return <NeedsClientScreen {...p} />;
    case 'submitOnly':
      return <SubmitOnlyScreen {...p} />;
    case 'reportPrompt':
      return <ReportPromptScreen {...p} />;
    case 'manualUursoort':
      return <ManualUursoortScreen {...p} />;
    default:
      return null;
  }
}
