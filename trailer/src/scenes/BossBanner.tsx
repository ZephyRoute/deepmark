import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { MONO, SERIF } from '../fonts';
import { COLOR } from '../theme';
import { SETTLE, ramp } from '../motion';
import { Embers, Flash, Grain, PaintedPlate, Vignette } from '../components/Atmosphere';

/** The guardian of the last floor, from the game's own painted intro, with the name struck over it. */
export const BossBanner: React.FC = () => {
  const frame = useCurrentFrame();
  const name = ramp(frame, 6, 30, SETTLE);
  const rule = ramp(frame, 12, 40, SETTLE);
  const label = ramp(frame, 20, 42, SETTLE);
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <PaintedPlate src="art/boss-intro.webp" from={1.04} to={1.2} drift={[-30, 10]} />
      <Embers count={34} intensity={0.9} seed="boss" />
      <AbsoluteFill style={{ background: 'linear-gradient(0deg, rgba(4,5,10,0.85) 0%, rgba(4,5,10,0) 42%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 110, flexDirection: 'column', gap: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '0.34em', color: COLOR.gold, opacity: label, textTransform: 'uppercase' }}>
          Floor 3 &nbsp;·&nbsp; The Obsidian Crypt
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 118,
            letterSpacing: `${0.14 + (1 - name) * 0.2}em`,
            color: COLOR.text,
            opacity: name,
            filter: `blur(${(1 - name) * 16}px)`,
            textTransform: 'uppercase',
            textShadow: '0 6px 50px rgba(0,0,0,0.9)',
          }}
        >
          Warden Prime
        </div>
        <div style={{ height: 2, width: 640 * rule, background: `linear-gradient(90deg, transparent, ${COLOR.cyan}, transparent)` }} />
      </AbsoluteFill>
      <Sequence durationInFrames={9}>
        <Flash color="#b9a2ff" peak={0.5} />
      </Sequence>
      <Vignette strength={0.7} />
      <Grain opacity={0.1} />
    </AbsoluteFill>
  );
};
