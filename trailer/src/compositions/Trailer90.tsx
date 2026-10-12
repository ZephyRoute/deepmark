import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { COLOR, sec } from '../theme';
import { SHOT90, T90 } from '../timeline';
import { followCamera } from '../camera';
import { Footage, type Rect } from '../components/Footage';
import { Shot } from '../components/Shot';
import { Flash, Grain, Vignette, Embers } from '../components/Atmosphere';
import { Title } from '../components/Type';
import { Hook } from '../scenes/Hook';
import { BossBanner } from '../scenes/BossBanner';
import { ChoiceBeat } from '../scenes/ChoiceBeat';
import { EndCard } from '../scenes/EndCard';
import { PlayChapter } from '../scenes/explain/PlayChapter';
import { SeedChapter } from '../scenes/explain/SeedChapter';
import { ReplayChapter } from '../scenes/explain/ReplayChapter';
import { RelicsChapter } from '../scenes/explain/RelicsChapter';
import { VerifyChapter } from '../scenes/explain/VerifyChapter';

const CAMERA = followCamera(820);
const DESCENT: Rect = { x: 221, y: 90, w: 1477, h: 831 };
const DESCENT_PUSH: Rect = { x: 360, y: 180, w: 1200, h: 675 };
const CARD_WIDE: Rect = { x: 0, y: 90, w: 1500, h: 844 };
const CARD_PUSH: Rect = { x: 70, y: 140, w: 1340, h: 754 };
const VAULT_WIDE: Rect = { x: 0, y: 40, w: 1500, h: 844 };
const VAULT_PUSH: Rect = { x: 50, y: 90, w: 1360, h: 765 };

export const Trailer90: React.FC = () => (
  <AbsoluteFill style={{ background: COLOR.bg }}>
    <Audio src={staticFile('audio/score-90.wav')} />

    <Shot window={T90.hook} fadeOut={sec(0.4)}>
      <Hook />
    </Shot>

    <Shot window={T90.descent} fadeIn={sec(0.4)} fadeOut={sec(0.1)}>
      <Footage src="footage/descent.mp4" from={1.2} rect={DESCENT} rectTo={DESCENT_PUSH} />
      <Embers count={30} intensity={0.7} seed="descent" />
    </Shot>

    <Shot window={T90.fight1}>
      <Footage src="footage/run.mp4" from={SHOT90.fight1.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} />
      </Sequence>
      <Sequence from={sec(0.5)} durationInFrames={sec(2.4)}>
        <Title at="lower" size={60}>A guard on every floor.</Title>
      </Sequence>
    </Shot>

    <Shot window={T90.fight2}>
      <Footage src="footage/run.mp4" from={SHOT90.fight2.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} />
      </Sequence>
    </Shot>

    <Shot window={T90.choice}>
      <Footage src="footage/run.mp4" from={SHOT90.choice.from} camera={CAMERA} />
      <ChoiceBeat />
    </Shot>

    <Shot window={T90.bossBanner}>
      <BossBanner />
    </Shot>

    <Shot window={T90.bossFight}>
      <Footage src="footage/run.mp4" from={SHOT90.bossFight.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} color={COLOR.gold} />
      </Sequence>
      <Sequence from={sec(1.3)} durationInFrames={sec(2.5)}>
        <Title at="lower" size={60} color={COLOR.danger}>One hit point left.</Title>
      </Sequence>
    </Shot>

    <Shot window={T90.extract} fadeOut={sec(0.35)}>
      <Footage src="footage/run.mp4" from={SHOT90.extract.from} camera={CAMERA} />
    </Shot>

    <Shot window={T90.sealed} fadeIn={sec(0.35)} fadeOut={sec(0.3)}>
      <Footage src="footage/sealed.mp4" from={SHOT90.sealed.from} rect={CARD_WIDE} rectTo={CARD_PUSH} />
      <Sequence from={sec(0.4)} durationInFrames={sec(5.0)}>
        <Title at="left" size={76}>That run is now proof.</Title>
      </Sequence>
    </Shot>

    <Shot window={T90.play}>
      <PlayChapter />
    </Shot>
    <Shot window={T90.seed}>
      <SeedChapter />
    </Shot>
    <Shot window={T90.replay}>
      <ReplayChapter />
    </Shot>
    <Shot window={T90.relics}>
      <RelicsChapter />
    </Shot>
    <Shot window={T90.verify}>
      <VerifyChapter />
    </Shot>

    <Shot window={T90.vault} fadeIn={sec(0.3)} fadeOut={sec(0.3)}>
      <Footage src="footage/vault.mp4" from={SHOT90.vault.from} rect={VAULT_WIDE} rectTo={VAULT_PUSH} />
      <Sequence from={sec(0.3)} durationInFrames={sec(3.4)}>
        <Title at="left" size={70}>Clear every floor and the delver is yours.</Title>
      </Sequence>
    </Shot>

    <Shot window={T90.end} fadeIn={sec(0.2)}>
      <EndCard tagline="When do you leave?" note="Live on Stellar testnet" />
    </Shot>

    <Vignette strength={0.4} />
    <Grain opacity={0.06} />
  </AbsoluteFill>
);
