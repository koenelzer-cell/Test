import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';

// Terugknop + kop + toelichting + één actieknop. Gebruikt door
// showNonClientNoUursoort; bewust generiek gehouden zodat de resterende
// meldingsschermen er straks ook op kunnen.
export function MessageScreen({
  title, titleStyle, body, bodyStyle, actionLabel, tokens, onBack, onAction,
  actionAccent, actionAccentWash, actionChevron = true,
}) {
  return (
    <div>
      {onBack ? (
        <div style={{ marginBottom: 8 }}>
          <BackButton label="Terug" onClick={onBack} tokens={tokens} />
        </div>
      ) : null}
      <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0', ...titleStyle }}>{title}</div>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4, margin: '0 0 8px', ...bodyStyle }}>{body}</div>
      {actionLabel ? (
        <TileButton
          label={actionLabel}
          onClick={onAction}
          tokens={tokens}
          accent={actionAccent}
          accentWash={actionAccentWash}
          chevron={actionChevron}
        />
      ) : null}
    </div>
  );
}
