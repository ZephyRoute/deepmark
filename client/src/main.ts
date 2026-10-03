function isPublicStatsPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/stats';
}

// Design preview of the descent scene, available on a local machine only:
// http://localhost:5173/?preview=descent
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const previewDescent = isLocal && new URLSearchParams(window.location.search).get('preview') === 'descent';

// The public page is also a real document at /stats/. A dev server that was
// started before that document existed answers /stats with the game shell.
// Mount the metrics here so the All players link still opens them.
if (previewDescent) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;background:#05060b';
  document.body.replaceChildren(host);
  void Promise.all([import('./render/descent'), import('./styles.css')]).then(([scene]) => {
    scene.mountDescent(host, { art: 'cinder.png', filter: 'none', name: 'Brannoch' });
    setTimeout(() => scene.setDescentStage('opening'), 1500);
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
