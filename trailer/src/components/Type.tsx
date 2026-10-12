import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO, SANS, SERIF } from '../fonts';
import { COLOR } from '../theme';
import { ramp, sceneFade } from '../motion';

interface LineProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: 500 | 600;
  tracking?: number;
  italic?: boolean;
}

interface TitleProps extends LineProps {
  /** Distance from the bottom edge, or 'center'. */
  at?: 'center' | 'lower' | 'left';
  /** Frames the line takes to resolve. */
  reveal?: number;
  fadeOut?: number;
  delay?: number;
}

/**
 * A serif line that resolves out of blur. Place it inside a Sequence: its life
 * is the Sequence's duration, so the edit stays the single source of timing.
 */
export const Title: React.FC<TitleProps> = ({
  children,
  size = 84,
  color = COLOR.text,
  weight = 500,
  tracking = 0.01,
  italic = false,
  at = 'center',
  reveal = 26,
  fadeOut = 12,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = ramp(frame, delay, delay + reveal);
  const opacity = Math.min(p, sceneFade(frame, durationInFrames, 0, fadeOut));
  return (
    <AbsoluteFill
      style={{
        justifyContent: at === 'lower' ? 'flex-end' : 'center',
        alignItems: at === 'left' ? 'flex-start' : 'center',
        paddingLeft: at === 'left' ? 150 : 0,
        paddingBottom: at === 'lower' ? 120 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: weight,
          fontStyle: italic ? 'italic' : 'normal',
          fontSize: size,
          lineHeight: 1.1,
          letterSpacing: `${tracking + (1 - p) * 0.08}em`,
          color,
          opacity,
          filter: `blur(${(1 - p) * 14}px)`,
          translate: `0 ${(1 - p) * 18}px`,
          textShadow: '0 4px 40px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.6)',
          textAlign: at === 'left' ? 'left' : 'center',
          maxWidth: at === 'left' ? 640 : 1500,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Small tracked label, mono, in the game's interface voice. */
export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; opacity?: number }> = ({
  children,
  color = COLOR.muted,
  size = 22,
  opacity = 1,
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: size,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color,
      opacity,
    }}
  >
    {children}
  </div>
);

export const Body: React.FC<{ children: React.ReactNode; size?: number; color?: string; width?: number }> = ({
  children,
  size = 34,
  color = COLOR.text,
  width = 900,
}) => (
  <div style={{ fontFamily: SANS, fontSize: size, lineHeight: 1.45, color, maxWidth: width }}>{children}</div>
);
