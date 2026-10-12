import { random, useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO } from '../fonts';
import { COLOR } from '../theme';
import { ramp } from '../motion';
import { ActionGlyph } from './Glyphs';

interface ActionStripProps {
  actions: readonly number[];
  columns: number;
  cell?: number;
  /** Seconds between one cell appearing and the next. */
  every?: number;
  /** Seconds before the first cell. */
  start?: number;
  /** Index to light up in cyan, such as the byte the contract is reading. */
  cursor?: number;
}

/** The action log, one cell per byte. Real data: the same inputs the recorded run was played with. */
export const ActionStrip: React.FC<ActionStripProps> = ({ actions, columns, cell = 46, every = 0.07, start = 0, cursor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, ${cell}px)`, gap: 6 }}>
      {actions.map((code, i) => {
        const shown = ramp(t * fps, (start + i * every) * fps, (start + i * every) * fps + 8);
        const hot = cursor !== undefined && i === cursor;
        const jitter = random(`cell-${i}`);
        return (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: 8,
              border: `1px solid ${hot ? COLOR.cyan : 'rgba(232,224,208,0.2)'}`,
              background: hot ? 'rgba(126,240,224,0.16)' : 'rgba(255,255,255,0.03)',
              boxShadow: hot ? '0 0 22px rgba(126,240,224,0.55)' : undefined,
              opacity: shown,
              scale: 0.7 + 0.3 * shown,
              translate: `0 ${(1 - shown) * (6 + jitter * 8)}px`,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActionGlyph code={code} size={cell * 0.52} color={hot ? COLOR.cyan : COLOR.text} />
            <span style={{ position: 'absolute', right: 4, bottom: 2, fontFamily: MONO, fontSize: 11, color: COLOR.muted }}>{code}</span>
          </div>
        );
      })}
    </div>
  );
};
