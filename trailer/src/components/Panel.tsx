import { COLOR } from '../theme';

/** The game's own panel treatment, so explainer graphics read as part of the product. */
export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: string }> = ({ children, style, glow }) => (
  <div
    style={{
      background: 'rgba(10, 14, 22, 0.86)',
      border: '1px solid rgba(232, 224, 208, 0.16)',
      borderRadius: 20,
      boxShadow: `0 28px 80px rgba(0,0,0,0.55)${glow ? `, 0 0 70px ${glow}` : ''}`,
      color: COLOR.text,
      ...style,
    }}
  >
    {children}
  </div>
);
