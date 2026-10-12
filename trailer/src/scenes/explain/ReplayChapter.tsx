import { useCurrentFrame, useVideoConfig } from 'remotion';
import plan from '../../generated/run-plan.json';
import { RUN_CUES } from '../../footage-map';
import { MONO } from '../../fonts';
import { COLOR } from '../../theme';
import { SETTLE, ramp } from '../../motion';
import { ActionStrip } from '../../components/ActionStrip';
import { Seal } from '../../components/Glyphs';
import { Panel } from '../../components/Panel';
import { Typed } from '../../components/Typed';
import { Stage } from './Stage';

const READ_FROM = 3.0;
const READ_EVERY = 0.07;
/** Seconds into the chapter when the log has been fully read and the final lines begin. */
const FINAL_AT = 7.2;

/** Lines that only exist once the whole log has been read. */
const FINAL_LINES: readonly [string, string][] = [
  ['score', String(plan.score)],
  ['result', 'extracted'],
];

/** Chapter three: `finish_run` replays the log and derives the result itself. */
export const ReplayChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cursor = Math.min(plan.actions.length - 1, Math.max(0, Math.floor((t - READ_FROM) / READ_EVERY)));
  const reading = t >= READ_FROM && t < READ_FROM + plan.actions.length * READ_EVERY + 0.2;
  const panel = ramp(frame, 16, 48);
  const sealIn = ramp(frame, 9.0 * fps, 10.0 * fps, SETTLE);
  const state = RUN_CUES[Math.min(cursor, RUN_CUES.length - 1)];
  const started = t >= READ_FROM;
  const liveRows: readonly [string, string][] = started && state
    ? [
        ['step', `${cursor + 1} / ${plan.actions.length}`],
        ['floor', `${state.floor} / 3`],
        ['relics', String(state.relics)],
        ['hp left', `${state.hp} / ${plan.maxHp}`],
      ]
    : [['step', 'waiting for the log']];
  return (
    <Stage
      step="03 · The contract replays it"
      heading="It replays your run."
      body="finish_run feeds your log through a bit-exact Rust copy of the game. The contract derives floor, relics and score itself. It never reads a result from you."
    >
      <div style={{ position: 'absolute', inset: 0, opacity: panel }}>
        <Panel style={{ position: 'absolute', left: 0, top: 120, width: 800, padding: '22px 22px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: COLOR.muted, textTransform: 'uppercase', paddingBottom: 14 }}>
            actions · what you send
          </div>
          <ActionStrip actions={plan.actions} columns={15} cell={46} every={0} start={0} cursor={reading ? cursor : undefined} />
        </Panel>

        <Panel style={{ position: 'absolute', left: 0, top: 520, width: 800, padding: '26px 30px' }} glow={sealIn > 0.1 ? `rgba(126,240,224,${0.25 * sealIn})` : undefined}>
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: COLOR.gold, textTransform: 'uppercase', paddingBottom: 16 }}>sim.rs · what the contract derives</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {liveRows.map(([key, value]) => (
                <div key={key} style={{ display: 'flex', gap: 18, fontFamily: MONO, fontSize: 30, minHeight: 40 }}>
                  <span style={{ width: 170, color: COLOR.muted }}>{key}</span>
                  <span>{value}</span>
                </div>
              ))}
              {FINAL_LINES.map(([key, value], i) => {
                const at = FINAL_AT + i * 0.5;
                return (
                  <div key={key} style={{ display: 'flex', gap: 18, fontFamily: MONO, fontSize: 30, minHeight: 40 }}>
                    <span style={{ width: 170, color: COLOR.muted }}>{ramp(t, at, at + 0.1) > 0 ? key : ''}</span>
                    <Typed text={value} start={at} cps={22} color={key === 'result' ? COLOR.cyan : COLOR.text} size={30} />
                  </div>
                );
              })}
            </div>
            <div style={{ justifySelf: 'center', opacity: sealIn, scale: 0.6 + 0.4 * sealIn, filter: `drop-shadow(0 0 ${24 * sealIn}px rgba(231,195,106,0.7))` }}>
              <Seal size={130} />
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.22em', color: COLOR.cyan, textTransform: 'uppercase', marginTop: 22, opacity: sealIn }}>
            Ranked · relics minted
          </div>
        </Panel>
      </div>
    </Stage>
  );
};
