import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO, SERIF } from '../fonts';
import { COLOR } from '../theme';
import { SETTLE, ramp } from '../motion';
import { Embers, Flash, Grain, Vignette } from '../components/Atmosphere';

interface EndCardProps {
  tagline: string;
  note: string;
}

/** The close: the lockup lands on the score's last boom, the question stays on screen. */
export const EndCard: React.FC<EndCardProps> = ({ tagline, note }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const logo = ramp(frame, 0, 40, SETTLE);
  const line = ramp(frame, 26, 62, SETTLE);
  const small = ramp(frame, 44, 70, SETTLE);
  const out = 1 - ramp(frame, durationInFrames - 12, durationInFrames);
  return (
    <AbsoluteFill style={{ background: COLOR.bg, opacity: out }}>
      <AbsoluteFill style={{ opacity: 0.5 }}>
        <Img src={staticFile('art/vault-bg.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(3px) brightness(0.55)' }} />
      </AbsoluteFill>
      <Embers count={40} intensity={0.8} seed="end" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34, flexDirection: 'column' }}>
        <Img
          src={staticFile('art/logo-lockup.webp')}
          style={{
            width: 960,
            opacity: logo,
            scale: 0.94 + 0.06 * logo,
            filter: `blur(${(1 - logo) * 16}px) drop-shadow(0 12px 60px rgba(0,0,0,0.8))`,
          }}
        />
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 64,
            color: COLOR.text,
            opacity: line,
            translate: `0 ${(1 - line) * 14}px`,
            textShadow: '0 4px 40px rgba(0,0,0,0.9)',
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 22,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: COLOR.cyan,
            opacity: small,
          }}
        >
          {note}
        </div>
      </AbsoluteFill>
      <Sequence durationInFrames={10}>
        <Flash color={COLOR.gold} peak={0.35} />
      </Sequence>
      <Vignette strength={0.7} />
      <Grain opacity={0.1} />
    </AbsoluteFill>
  );
};
