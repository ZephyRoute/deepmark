function isPublicStatsPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/stats';
}

// Design preview of the descent scene, available on a local machine only:
// http://localhost:5173/?preview=descent
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const previewMode = isLocal ? new URLSearchParams(window.location.search).get('preview') : null;
const previewDescent = previewMode === 'descent';
const previewResult = previewMode === 'result';

// The public page is also a real document at /stats/. A dev server that was
// started before that document existed answers /stats with the game shell.
// Mount the metrics here so the All players link still opens them.
if (previewDescent) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;background:#05060b';
  document.body.replaceChildren(host);
  void Promise.all([import('./render/descent'), import('./styles.css')]).then(([scene]) => {
    scene.mountDescent(host, {
      art: 'cinder.png',
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
  // http://localhost:5173/?preview=result&hero=1&loss=1
  const params = new URLSearchParams(window.location.search);
  const host = document.createElement('div');
  host.id = 'overlay';
  host.className = 'overlay';
  document.body.replaceChildren(host);
  void Promise.all([import('./render/result'), import('./styles.css')]).then(([scene]) => {
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
      delver: { name: 'Brannoch', art: 'cinder.png', filter: 'none', emblem: 1 },
    });
    scene.updateVerification({ state: 'pending', message: '', rank: null, txUrl: null, heroEarned: false, canRetry: false });
    setTimeout(() => {
      scene.updateVerification({
        state: 'verified',
        message: '',
        rank: 2,
        txUrl: 'https://stellar.expert/explorer/testnet',
        heroEarned: params.get('hero') === '1',
        canRetry: false,
      });
    }, 4500);
  });
} else if (isPublicStatsPath(window.location.pathname)) {
  document.title = 'Deepmark traction on Stellar testnet';
  const root = document.createElement('div');
  root.id = 'stats-root';
  document.body.replaceChildren(root);
  void import('./stats/main');
} else {
  void import('./game-app');
}
