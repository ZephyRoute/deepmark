import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { MONO, SERIF } from '../fonts';
import { COLOR } from '../theme';
import { SETTLE, ramp } from '../motion';

const OPTIONS = [
  { key: 'Descend', note: 'push deeper', tone: COLOR.cyan },
  { key: 'Extract', note: 'leave with what you hold', tone: COLOR.gold },
] as const;

/** The bank-or-push choice that ends every floor, drawn in the game's own button language. */
export const ChoiceBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const head = ramp(frame, 10, 40, SETTLE);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 96, gap: 30, flexDirection: 'column' }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 72,
          fontWeight: 500,
          color: COLOR.text,
          opacity: head,
          filter: `blur(${(1 - head) * 12}px)`,
          textShadow: '0 4px 40px rgba(0,0,0,0.9)',
        }}
      >
        Push on, or leave with it.
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {OPTIONS.map((option, i) => {
          const p = ramp(frame, 34 + i * 12, 62 + i * 12, SETTLE);
          return (
            <div
              key={option.key}
              style={{
                padding: '18px 34px',
                borderRadius: 999,
                border: `1px solid ${option.tone}`,
                background: 'rgba(10,16,24,0.82)',
                boxShadow: `0 0 36px ${option.tone}33`,
                opacity: p,
                translate: `0 ${(1 - p) * 26}px`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: SERIF, fontSize: 40, color: option.tone }}>{option.key}</div>
              <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.2em', color: COLOR.muted, textTransform: 'uppercase', marginTop: 4 }}>{option.note}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
