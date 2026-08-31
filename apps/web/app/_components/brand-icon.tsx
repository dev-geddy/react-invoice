/**
 * The Backflip brand glyph (arc-over-pole), shared by the public wordmark and
 * the admin sidebar logo so the mark stays identical across surfaces. Color
 * comes from `currentColor` — wrap it in a `text-*` class.
 */
export function BrandIcon({
  size = 12,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3v7" />
      <path d="M6 8a7 7 0 1 0 12 0" />
    </svg>
  )
}
