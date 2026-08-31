// Low-contrast oversized wordmark accent, tinted with the page's brand red —
// the last thing on the page, and the only place the name is set this large.
export function WordmarkBand() {
  return (
    <section aria-hidden="true" className="overflow-hidden pt-24 pb-20">
      <div className="text-center text-[clamp(2.25rem,8.5vw,8.125rem)] leading-[0.9] font-bold tracking-tight whitespace-nowrap text-[color-mix(in_oklab,var(--brand)_14%,transparent)] select-none">
        Backflip Invoice
      </div>
    </section>
  )
}
