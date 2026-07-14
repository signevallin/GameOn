type Props = {
  /** Base font size for the wordmark in px. */
  size?: number;
};

// Rivalry wordmark: "Rival" in the text colour + "ry" in the accent colour.
// (Component name kept as GameOnLogo to avoid churn across importers.)
export default function GameOnLogo({ size = 22 }: Props) {
  const common = {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 800,
    fontSize: `${size}px`,
    letterSpacing: '-1px',
  } as const;
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1 }}>
      <span style={{ ...common, color: '#e0e7f3' }}>Rival</span>
      <span style={{ ...common, color: 'var(--accent)' }}>ry</span>
    </span>
  );
}
