import { Img, random, staticFile, useCurrentFrame } from 'remotion';
import { MONO, SERIF } from '../../fonts';
import { COLOR } from '../../theme';
import { SETTLE, ramp } from '../../motion';
import { Panel } from '../../components/Panel';
import { Stage } from './Stage';

const INGREDIENTS = ['ledger sequence', 'ledger time', 'run counter', 'your address'] as const;
const DIGITS = 12;

/** Chapter two: `start_run` hands the player a seed derived on chain. */
export const SeedChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const panels = ramp(frame, 16, 48);
  const call = ramp(frame, 60, 90, SETTLE);
  const chips = (i: number): number => ramp(frame, 100 + i * 14, 124 + i * 14);
  const settle = ramp(frame, 190, 230);
  return (
    <Stage
      step="02 · The chain deals the seed"
      heading="You cannot pick a lucky seed."
      body="start_run opens your run, and the contract derives its seed from the ledger, your run counter and your address. The game plays out from that seed and no other."
    >
      <div style={{ position: 'absolute', inset: 0, opacity: panels }}>
        <Panel style={{ position: 'absolute', left: 0, top: 230, width: 300, padding: 26, textAlign: 'center' }}>
          <Img src={staticFile('art/cinder.webp')} style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${COLOR.gold}` }} />
          <div style={{ fontFamily: SERIF, fontSize: 38, marginTop: 14 }}>Brannoch</div>
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.22em', color: COLOR.muted, marginTop: 6, textTransform: 'uppercase' }}>Your browser</div>
        </Panel>

        <Panel style={{ position: 'absolute', right: 0, top: 200, width: 410, padding: 28 }} glow="rgba(231,195,106,0.18)">
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: COLOR.gold, textTransform: 'uppercase' }}>Soroban contract</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            {INGREDIENTS.map((label, i) => (
              <div
                key={label}
                style={{
                  fontFamily: MONO,
                  fontSize: 22,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(232,224,208,0.18)',
                  background: 'rgba(255,255,255,0.03)',
                  opacity: chips(i),
                  translate: `${(1 - chips(i)) * 24}px 0`,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: COLOR.cyan, textTransform: 'uppercase' }}>Seed</div>
          <div style={{ fontFamily: MONO, fontSize: 34, letterSpacing: '0.12em', marginTop: 6, color: COLOR.cyan, minHeight: 44 }}>
            {Array.from({ length: DIGITS }, (_, i) => {
              const locked = settle * DIGITS > i;
              const roll = Math.floor(random(`seed-${i}-${Math.floor(frame / 2)}`) * 16).toString(16);
              const fixed = Math.floor(random(`seed-fixed-${i}`) * 16).toString(16);
              return <span key={i}>{frame < 150 ? '·' : locked ? fixed : roll}</span>;
            })}
          </div>
        </Panel>

        <svg style={{ position: 'absolute', left: 300, top: 300, width: 190, height: 120, overflow: 'visible' }} viewBox="0 0 190 120" fill="none">
          <line x1={0} y1={30} x2={190 * call} y2={30} stroke={COLOR.cyan} strokeWidth={2} strokeDasharray="8 8" strokeDashoffset={-frame * 1.4} />
          <circle cx={190 * call} cy={30} r={7} fill={COLOR.cyan} opacity={call} />
          <line x1={190} y1={92} x2={190 - 190 * ramp(frame, 150, 186, SETTLE)} y2={92} stroke={COLOR.gold} strokeWidth={2} strokeDasharray="8 8" strokeDashoffset={frame * 1.4} />
        </svg>
        <div style={{ position: 'absolute', left: 318, top: 244, fontFamily: MONO, fontSize: 22, color: COLOR.cyan, opacity: call }}>start_run</div>
        <div style={{ position: 'absolute', left: 345, top: 408, fontFamily: MONO, fontSize: 22, color: COLOR.gold, opacity: ramp(frame, 160, 190) }}>seed</div>
        <div style={{ position: 'absolute', left: 0, top: 660, fontFamily: MONO, fontSize: 18, letterSpacing: '0.2em', color: COLOR.muted, textTransform: 'uppercase', opacity: ramp(frame, 230, 262) }}>
          The client never chooses it
        </div>
      </div>
    </Stage>
  );
};
