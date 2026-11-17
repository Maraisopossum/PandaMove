// Seuls pictogrammes fonctionnels du module (flèches du sélecteur de jour) : trait de 1,75, extrémités rondes.
// Tout le reste du module est illustré par les dessins du panda (public/panda/nutri-*, générés avec Gemini : voir scripts/build-images.mjs).
export function Chevron({ sens }: { sens: 'precedent' | 'suivant' }) {
  return (
    <svg className="nutri__chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={sens === 'precedent' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
