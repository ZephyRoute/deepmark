import { loadTraction } from '../stellar/traction';
import { renderError, renderLoading, renderSummary } from './render';
import './stats.css';

const root = document.getElementById('stats-root');
if (!root) throw new Error('Stats root is missing');
const page: HTMLElement = root;

async function load(): Promise<void> {
  renderLoading(page);
  try {
    const summary = await loadTraction();
    renderSummary(page, summary);
  } catch (err) {
    console.warn('Deepmark: could not read traction', err);
    renderError(page, () => {
      void load();
    });
  }
}

void load();
