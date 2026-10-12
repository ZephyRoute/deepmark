import { useCurrentFrame, useVideoConfig } from 'remotion';
import plan from '../../generated/run-plan.json';
import { MONO } from '../../fonts';
import { COLOR } from '../../theme';
import { SETTLE, ramp } from '../../motion';
import { Panel } from '../../components/Panel';
import { Typed } from '../../components/Typed';
import { Stage } from './Stage';

const FACTS = [
  ['16 KB', 'contract'],
  ['3.6M / 400M', 'CPU, worst case run'],
  ['2 transactions', 'per run'],
] as const;

/** Chapter five: anyone can replay any run, and the cost of doing so is small. */
export const VerifyChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const out = ramp(t, 3.4, 4.2, SETTLE);
  const chip = (i: number): number => ramp(t, 4.6 + i * 0.35, 5.2 + i * 0.35, SETTLE);
  return (
    <Stage
      step="05 · Nobody has to trust us"
      heading="Anyone can check."
      body="verify_run replays any run without writing anything, from the log in its event. A forged log either fails the replay or turns out to be a run the game could really produce."
    >
      <Panel style={{ position: 'absolute', left: 0, top: 150, width: 800, padding: '30px 34px' }} glow="rgba(126,240,224,0.14)">
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: COLOR.muted, textTransform: 'uppercase', paddingBottom: 18 }}>read only · free</div>
        <div style={{ minHeight: 44 }}>
          <Typed text="verify_run(delver, seed, actions)" start={0.7} cps={26} color={COLOR.cyan} size={32} />
        </div>
        <div style={{ marginTop: 22, display: 'grid', gap: 8, opacity: out, translate: `0 ${(1 - out) * 12}px`, fontFamily: MONO, fontSize: 30 }}>
          <div style={{ color: COLOR.muted }}>{'→ replayed '}{plan.actions.length}{' inputs'}</div>
          <div>{'floor '}{plan.floor}{' · relics '}{plan.relics}{' · score '}{plan.score}</div>
          <div style={{ color: COLOR.gold }}>nothing written</div>
        </div>
      </Panel>
      <div style={{ position: 'absolute', left: 0, top: 590, display: 'flex', gap: 18 }}>
        {FACTS.map(([value, label], i) => (
          <Panel key={label} style={{ padding: '22px 24px', opacity: chip(i), translate: `0 ${(1 - chip(i)) * 24}px` }}>
            <div style={{ fontFamily: MONO, fontSize: 32, color: COLOR.text }}>{value}</div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.2em', color: COLOR.muted, textTransform: 'uppercase', marginTop: 8 }}>{label}</div>
          </Panel>
        ))}
      </div>
    </Stage>
  );
};
