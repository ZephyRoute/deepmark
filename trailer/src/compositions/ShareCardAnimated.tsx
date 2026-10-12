import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import plan from '../generated/run-plan.json';
import { MONO, SERIF } from '../fonts';
import { COLOR } from '../theme';
import { SETTLE, ramp } from '../motion';
import { Embers, Grain, Vignette } from '../components/Atmosphere';
import { Seal } from '../components/Glyphs';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARD_FRAMES = 150;

const TEXT_X = 500;

/** Counts up to `value`, so a stat reads as earned rather than printed. */
function count(frame: number, from: number, to: number, value: number): number {
  return Math.round(interpolate(frame, [from, to], [0, value], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE }));
}

const Stat: React.FC<{ x: number; value: string; label: string; at: number }> = ({ x, value, label, at }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 22, SETTLE);
  return (
    <div style={{ position: 'absolute', left: x, top: 336, opacity: p, translate: `0 ${(1 - p) * 14}px` }}>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 40, color: COLOR.text }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em', color: COLOR.muted, marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
};

/**
 * The shareable result card, in motion. Same layout as the still card the game
 * draws (`client/src/render/shareCard.ts`), so the animated post and the saved
 * image are recognisably one object.
 */
export const ShareCardAnimated: React.FC = () => {
  const frame = useCurrentFrame();
  const bg = 1.02 + 0.05 * (frame / CARD_FRAMES);
  const logo = ramp(frame, 0, 24, SETTLE);
  const portrait = ramp(frame, 8, 44, SETTLE);
  const eyebrow = ramp(frame, 22, 40, SETTLE);
  const name = ramp(frame, 28, 58, SETTLE);
  const kit = ramp(frame, 44, 70, SETTLE);
  const seal = ramp(frame, 96, 120, SETTLE);
  const verified = ramp(frame, 104, 130, SETTLE);
  return (
    <AbsoluteFill style={{ background: COLOR.bg, overflow: 'hidden' }}>
      <Img src={staticFile('art/share-card-bg.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', scale: bg }} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(5,7,12,0.7) 28%, rgba(5,7,12,0.3) 100%), linear-gradient(0deg, rgba(5,7,12,0.75) 0%, rgba(5,7,12,0) 45%)' }} />
      <Embers count={22} intensity={0.8} seed="card" />

      <Img src={staticFile('art/logo-lockup.webp')} style={{ position: 'absolute', left: 56, top: 46, width: 170, opacity: logo }} />

      <div style={{ position: 'absolute', left: 90, top: 150, width: 360, height: 360, opacity: portrait, scale: 0.92 + 0.08 * portrait }}>
        <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', background: 'radial-gradient(circle, rgba(231,195,106,0.28), rgba(231,195,106,0) 66%)' }} />
        <Img src={staticFile('art/cinder.webp')} style={{ position: 'relative', width: 360, height: 360, filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.6))' }} />
      </div>

      <div style={{ position: 'absolute', left: TEXT_X, top: 166, fontFamily: MONO, fontWeight: 500, fontSize: 15, letterSpacing: '0.2em', color: COLOR.muted, opacity: eyebrow }}>EXTRACTED</div>
      <div
        style={{
          position: 'absolute',
          left: TEXT_X,
          top: 196,
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 70,
          color: '#f7e9c0',
          opacity: name,
          filter: `blur(${(1 - name) * 10}px)`,
          letterSpacing: `${(1 - name) * 0.06}em`,
        }}
      >
        {plan.name}
      </div>
      <div style={{ position: 'absolute', left: TEXT_X, top: 282, display: 'flex', alignItems: 'center', gap: 12, opacity: kit, fontFamily: MONO, fontSize: 16, color: COLOR.text }}>
        <Img src={staticFile('art/reaver-hook.webp')} style={{ width: 34, height: 34 }} />
        <span>Reaver Hook</span>
        <span style={{ width: 18 }} />
        <Img src={staticFile('art/stone-heart.webp')} style={{ width: 34, height: 34 }} />
        <span>Stone Heart</span>
      </div>

      <Stat x={TEXT_X} value={`${count(frame, 60, 90, plan.floor)} / 3`} label="Floor" at={60} />
      <Stat x={TEXT_X + 150} value={String(count(frame, 68, 100, plan.score))} label="Score" at={68} />
      <Stat x={TEXT_X + 280} value={String(count(frame, 76, 104, plan.relics))} label="Relics" at={76} />
      <Stat x={TEXT_X + 410} value="#2" label="Rank" at={84} />

      <div style={{ position: 'absolute', left: TEXT_X, top: 468, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ opacity: seal, scale: 0.55 + 0.45 * seal, filter: `drop-shadow(0 0 ${18 * seal}px rgba(231,195,106,0.75))` }}>
          <Seal size={64} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.16em', color: COLOR.cyan, opacity: verified, textTransform: 'uppercase' }}>Sealed on Stellar</div>
      </div>
      <Vignette strength={0.5} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
};
