// Écran provisoire des modules non encore construits.
export function PagePlaceholder({ titre }: { titre: string }) {
  return (
    <>
      <h1>{titre}</h1>
      <p>à venir</p>
    </>
  )
}
