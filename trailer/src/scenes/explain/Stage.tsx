import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO, SANS, SERIF } from '../../fonts';
import { COLOR } from '../../theme';
import { SETTLE, ramp, sceneFade } from '../../motion';
import { Embers, Grain, Vignette } from '../../components/Atmosphere';

interface StageProps {
  step: string;
  heading: string;
  body: string;
  /** Painted backdrop under the diagram, darkened. */
  plate?: string;
  children: React.ReactNode;
}

/**
 * The frame every explainer chapter shares: a darkened painting, the step label
 * and heading on the left, the diagram on the right. One layout, so five
 * chapters read as one system and the eye knows where to look.
 */
export const Stage: React.FC<StageProps> = ({ step, heading, body, plate = 'art/vault-bg.webp', children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const kicker = ramp(frame, 4, 24, SETTLE);
  const title = ramp(frame, 10, 40, SETTLE);
  const text = ramp(frame, 26, 56, SETTLE);
  return (
    <AbsoluteFill style={{ background: COLOR.bg, opacity: sceneFade(frame, durationInFrames, 12, 12) }}>
      <AbsoluteFill style={{ opacity: 0.7 }}>
        <Img src={staticFile(plate)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(4px) brightness(0.7) saturate(1)' }} />
      </AbsoluteFill>
      <Embers count={26} intensity={0.55} seed={`stage-${step}`} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(5,7,12,0.9) 0%, rgba(5,7,12,0.62) 44%, rgba(5,7,12,0.18) 100%)' }} />
      <div style={{ position: 'absolute', left: 130, top: 0, bottom: 0, width: 720, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '0.3em', textTransform: 'uppercase', color: COLOR.cyan, opacity: kicker }}>{step}</div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 92,
            lineHeight: 1.04,
            color: COLOR.text,
            opacity: title,
            filter: `blur(${(1 - title) * 12}px)`,
            translate: `0 ${(1 - title) * 16}px`,
            textShadow: '0 4px 40px rgba(0,0,0,0.8)',
          }}
        >
          {heading}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 31, lineHeight: 1.5, color: '#d8d0c3', opacity: text, translate: `0 ${(1 - text) * 10}px`, maxWidth: 650 }}>{body}</div>
      </div>
      <div style={{ position: 'absolute', left: 900, top: 0, width: 800, bottom: 0, scale: 1.1, transformOrigin: '0 0' }}>{children}</div>
      <Vignette strength={0.6} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
};
