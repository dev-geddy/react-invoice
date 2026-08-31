// Low-contrast oversized wordmark accent — mirrors the text-muted-foreground/20
// treatment used elsewhere in the app.
export function WordmarkBand() {
  return (
    <section aria-hidden="true" className="overflow-hidden pt-12 pb-8">
      <div className="text-center text-[clamp(4.5rem,17vw,16.25rem)] leading-[0.9] font-bold tracking-tight whitespace-nowrap text-muted-foreground/20 select-none">
        Backflip
      </div>
    </section>
  )
}
