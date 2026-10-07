// Eenvoudig mededelingsscherm: een kop met daaronder een toelichting.
// Vervangt de handmatige DOM-opbouw van showFreeDayInactive en
// showNeedsTeamChoice, die allebei exact deze vorm hadden.
export function InfoScreen({ title, titleStyle, body, bodyStyle }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4, ...titleStyle }}>{title}</div>
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4, ...bodyStyle }}>{body}</div>
    </div>
  );
}
