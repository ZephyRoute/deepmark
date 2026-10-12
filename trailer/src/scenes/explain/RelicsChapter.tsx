import { Img, staticFile, useCurrentFrame } from 'remotion';
import { MONO } from '../../fonts';
import { COLOR } from '../../theme';
import { SETTLE, ramp } from '../../motion';
import { Lock } from '../../components/Glyphs';
import { Panel } from '../../components/Panel';
import { Stage } from './Stage';

const RELICS = [
  { code: 'DMCOMMON', art: 'art/relic-common.webp', tone: '#cdd2d8' },
  { code: 'DMRARE', art: 'art/relic-rare.webp', tone: COLOR.cyan },
  { code: 'DMCORE', art: 'art/relic-core.webp', tone: COLOR.gold },
] as const;

const FACTS = ['Issuer account locked', 'Only the game contract can mint', 'No sale, no swap, nothing pay to win'] as const;

/** Chapter four: relics are classic Stellar assets that only a verified extraction can mint. */
export const RelicsChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const card = (i: number): number => ramp(frame, 24 + i * 16, 60 + i * 16, SETTLE);
  const fact = (i: number): number => ramp(frame, 120 + i * 22, 150 + i * 22, SETTLE);
  return (
    <Stage
      step="04 · Scarcity you can audit"
      heading="Relics are earned, never sold."
      body="DMCOMMON, DMRARE and DMCORE are classic Stellar assets wrapped by Stellar Asset Contracts. The game contract is their admin, so a verified extraction is the only way one exists."
      plate="art/victory-bg.webp"
    >
      <div style={{ position: 'absolute', left: 0, top: 150, display: 'flex', gap: 24 }}>
        {RELICS.map((relic, i) => (
          <Panel
            key={relic.code}
            style={{ width: 250, padding: '28px 18px 24px', textAlign: 'center', opacity: card(i), translate: `0 ${(1 - card(i)) * 40}px` }}
            glow={`${relic.tone}33`}
          >
            <Img src={staticFile(relic.art)} style={{ width: 170, height: 170, objectFit: 'contain', filter: `drop-shadow(0 0 30px ${relic.tone}88)` }} />
            <div style={{ fontFamily: MONO, fontSize: 25, letterSpacing: '0.1em', color: relic.tone, marginTop: 10 }}>{relic.code}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.2em', color: COLOR.muted, marginTop: 8, textTransform: 'uppercase' }}>Stellar asset</div>
          </Panel>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, top: 560, display: 'grid', gap: 16 }}>
        {FACTS.map((text, i) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: fact(i), translate: `${(1 - fact(i)) * 30}px 0` }}>
            <Lock size={34} />
            <span style={{ fontFamily: MONO, fontSize: 27, color: COLOR.text }}>{text}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
};
