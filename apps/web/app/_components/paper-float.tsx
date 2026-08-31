/**
 * Keyframes for the floating invoice paper in the hero and the document
 * section. Mounted once by the homepage rather than added to the shared UI
 * stylesheet — nothing else on the platform drifts paper around.
 *
 * Three phases so a stack never moves as one block, and the whole thing stops
 * dead under `prefers-reduced-motion`.
 */
export function PaperFloatKeyframes() {
  return (
    <style>{`
@keyframes paper-float-a { 0%,100% { transform: translate3d(0,0,0) rotate(-2.2deg); } 50% { transform: translate3d(0,-14px,0) rotate(-1.4deg); } }
@keyframes paper-float-b { 0%,100% { transform: translate3d(0,0,0) rotate(3.4deg); } 50% { transform: translate3d(0,-9px,0) rotate(4.1deg); } }
@keyframes paper-float-c { 0%,100% { transform: translate3d(0,0,0) rotate(-6.5deg); } 50% { transform: translate3d(0,-6px,0) rotate(-7.2deg); } }
@media (prefers-reduced-motion: reduce) {
  [class*="paper-float"] { animation: none !important; }
}
`}</style>
  )
}
