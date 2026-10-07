import { useEffect, useRef } from 'react';

// Plaatst een bestaand, door content.js gebouwd DOM-element in de React-boom.
// Gebruikt voor drie soorten inhoud die bewust vanilla blijft:
//  1) de duurkeuze (mkDurationPicker/mkValuePicker) — ~250 regels fijn afgestelde
//     logica met drie instelbare stijlen; naschrijven levert niets op;
//  2) beheerbare teksten (mkText) — die halen opmaak/HTML uit het beheerscherm;
//  3) elementen die andere code live bijwerkt (de Indienen-knop), die React
//     bij een volgende render zou overschrijven.
export function VanillaNode({ node }) {
  const ref = useRef(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !node) return undefined;
    host.replaceChildren(node);
    return () => { try { host.replaceChildren(); } catch (e) {} };
  }, [node]);
  if (!node) return null;
  return <div ref={ref} />;
}

// Meerdere vanilla-knopen achter elkaar.
export function VanillaNodes({ nodes }) {
  return (
    <>
      {(nodes || []).map((n, i) => <VanillaNode key={i} node={n} />)}
    </>
  );
}
