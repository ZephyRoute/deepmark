import { isScreenPreview, mountScreenPreview } from './preview/screens';

function isPublicStatsPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/stats';
}

// Design preview of the descent scene, available on a local machine only:
// http://localhost:5173/?preview=descent
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
const previewMode = isLocal ? new URLSearchParams(window.location.search).get('preview') : null;
const previewDescent = previewMode === 'descent';
const previewResult = previewMode === 'result';
const previewBoard = previewMode === 'board';
const previewScreen = isScreenPreview(previewMode) ? previewMode : null;

// The public page is also a real document at /stats/. A dev server that was
// started before that document existed answers /stats with the game shell.
// Mount the metrics here so the All players link still opens them.
if (previewDescent) {
  // Mounted in the real shell's overlay, as the game does.
  const host = document.getElementById('overlay') ?? document.body;
  host.hidden = false;
  void Promise.all([import('./render/descent')]).then(([scene]) => {
    scene.mountDescent(host, {
      art: 'cinder.webp',
      filter: 'none',
      name: 'Brannoch',
      emblem: 1,
      kit: 'Cinder  ·  Reaver Hook  ·  Stone Heart',
    });
    setTimeout(() => scene.setDescentStage('opening'), 2500);
    if (new URLSearchParams(window.location.search).get('dive') === '1') {
      setTimeout(() => scene.setDescentStage('ready'), 7000);
    }
  });
} else if (previewResult) {
  // http://localhost:5173/?preview=result&hero=1 (new delver) or hero=vet (veteran clear) &loss=1
  const params = new URLSearchParams(window.location.search);
  // Mounted in the real shell, so landmarks and styles match the game.
  const host = document.getElementById('overlay') ?? document.body;
  host.hidden = false;
  void Promise.all([import('./render/result')]).then(([scene]) => {
    const lost = params.get('loss') === '1';
    scene.mountResult(host, {
      won: !lost,
      floorReached: lost ? 2 : 3,
      maxFloor: 3,
      relics: lost ? 0 : 2,
      score: lost ? 0 : 4,
      hpLeft: lost ? 0 : 1,
      newBest: !lost,
      bestLine: 'Best floor 3 / 3  ·  Best relics 2',
      delver: { name: 'Brannoch', art: 'cinder.webp', filter: 'none', emblem: 1 },
    });
    scene.updateVerification({ state: 'pending', message: '', rank: null, txUrl: null, heroEarned: false, canRetry: false });
    setTimeout(() => {
      scene.updateVerification({
        state: 'verified',
        message: '',
        rank: 2,
        txUrl: 'https://stellar.expert/explorer/testnet',
        heroEarned: params.get('hero') === '1',
        delverGrew: params.get('hero') === 'vet' ? { clears: 3 } : null,
        canRetry: false,
      });
    }, 4500);
  });
} else if (previewScreen) {
  // http://localhost:5173/?preview=vault or ?preview=leaderboard
  mountScreenPreview(previewScreen);
} else if (previewBoard) {
  // http://localhost:5173/?preview=board shows the three floors with no chain call.
  void Promise.all([import('./render/canvas'), import('./game/state'), import('./game/floor'), import('./game/enemies')]).then(
    ([canvasMod, stateMod, floorMod, enemyMod]) => {
      document.body.style.margin = '0';
      document.body.style.background = '#07080e';
      const host = document.createElement('main');
      host.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;align-items:center';
      document.body.replaceChildren(host);
      for (let floor = 1; floor <= 3; floor += 1) {
        const label = document.createElement('h2');
        label.textContent = `Floor ${floor}`;
        label.style.cssText = 'margin:0;color:#f4efe6;font:16px Palatino,serif';
        const board = document.createElement('canvas');
        board.width = 832;
        board.height = 576;
        board.style.width = 'min(100%, 832px)';
        board.style.height = 'auto';
        host.append(label, board);
        const ctx = board.getContext('2d');
        if (!ctx) continue;
        const run = stateMod.newRun({ base: 0, weapon: 0, charm: 0, rank: 0 }, 1);
        const layout = floorMod.buildFloor(floor);
        run.floorNumber = floor;
        run.layout = layout;
        run.player = { ...layout.playerStart, hp: run.player.maxHp, maxHp: run.player.maxHp };
        run.enemies = layout.enemies.map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          hp: enemyMod.ENEMIES[enemy.kind].maxHp,
          maxHp: enemyMod.ENEMIES[enemy.kind].maxHp,
          alive: true,
          kind: enemy.kind,
        }));
        run.relics = layout.relics.map((relic) => ({ ...relic, collected: false }));
        const paint = () => canvasMod.drawWorld(ctx, run);
        paint();
        const started = performance.now();
        const retry = () => {
          paint();
          if (performance.now() - started < 2000) requestAnimationFrame(retry);
        };
        requestAnimationFrame(retry);
      }
    }
  );
} else if (isPublicStatsPath(window.location.pathname)) {
  document.title = 'Deepmark traction on Stellar testnet';
  const root = document.createElement('div');
  root.id = 'stats-root';
  document.body.replaceChildren(root);
  void import('./stats/main');
} else {
  void import('./game-app');
}
