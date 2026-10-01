function isPublicStatsPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/stats';
}

// The public page is also a real document at /stats/. A dev server that was
// started before that document existed answers /stats with the game shell.
// Mount the metrics here so the All players link still opens them.
if (isPublicStatsPath(window.location.pathname)) {
  document.title = 'Deepmark traction on Stellar testnet';
  const root = document.createElement('div');
  root.id = 'stats-root';
  document.body.replaceChildren(root);
  void import('./stats/main');
} else {
  void import('./game-app');
}
