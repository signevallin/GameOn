type Props = {
  /** Target cap-height in px (matches the old font-size prop). */
  size?: number;
};

// Rivalry wordmark, rendered inline so the Rajdhani font (loaded in the app
// <head>) applies — external fonts don't load when an SVG is used via <img>.
// The clashing triangles read as a "versus" mark; text is two-tone (RIVA / LRY).
// (Component name kept as GameOnLogo to avoid churn across importers.)
export default function GameOnLogo({ size = 22 }: Props) {
  const height = Math.round((size * 40) / 30); // logo art is 40 tall for a 30px face
  return (
    <svg
      viewBox="0 0 196 40"
      height={height}
      role="img"
      aria-label="Rivalry"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polygon points="2,6 20,20 2,34" fill="#F4F7FA" />
      <polygon points="42,6 24,20 42,34" fill="var(--accent, #7CBDD4)" />
      <text
        x="56"
        y="30"
        style={{ fontFamily: "'Rajdhani','Arial Narrow',sans-serif", fontWeight: 700, fontSize: '30px', letterSpacing: '1.5px' }}
      >
        <tspan fill="#F4F7FA">RIVA</tspan>
        <tspan fill="var(--accent, #7CBDD4)">LRY</tspan>
      </text>
    </svg>
  );
}
