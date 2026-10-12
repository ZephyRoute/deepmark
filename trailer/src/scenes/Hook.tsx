import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';
import { SETTLE, ramp } from '../motion';
import { Embers, Grain, Vignette } from '../components/Atmosphere';

/** Where the delver's lantern sits in title-key-art.webp, as a fraction of the frame. */
const LANTERN = { x: 0.617, y: 0.705 } as const;

/**
 * The opening five seconds: no logo, no text. The camera pushes toward the
 * lantern while the painting breathes, and the first thing the viewer feels is
 * the weight of the shaft, not a brand.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / (durationInFrames - 1);
  const scale = 1.02 + 0.2 * (1 - (1 - p) ** 2.2);
  const rise = ramp(frame, 0, 48, SETTLE);
  const flicker = 0.62 + 0.2 * Math.sin(frame * 0.31) + 0.12 * Math.sin(frame * 0.83 + 1.7) + 0.06 * Math.sin(frame * 2.1);
  return (
    <AbsoluteFill style={{ background: COLOR.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${LANTERN.x * 100}% ${LANTERN.y * 100}%`,
          scale,
          opacity: rise,
        }}
      >
        <Img src={staticFile('art/title-key-art.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div
          style={{
            position: 'absolute',
            left: `${LANTERN.x * 100}%`,
            top: `${LANTERN.y * 100}%`,
            width: 520,
            height: 520,
            marginLeft: -260,
            marginTop: -260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,196,110,0.55) 0%, rgba(255,160,70,0.18) 34%, rgba(255,140,60,0) 70%)',
            mixBlendMode: 'screen',
            opacity: flicker,
          }}
        />
      </AbsoluteFill>
      <Embers count={54} intensity={0.9 * rise} seed="hook" />
      <Vignette strength={0.78} />
      <Grain opacity={0.12} />
    </AbsoluteFill>
  );
};
