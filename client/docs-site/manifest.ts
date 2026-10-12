/** Where the docs site lives and which repository files feed each page. */

export const SITE_ORIGIN = 'https://deepmark-dun.vercel.app';
export const DOCS_BASE = '/docs';
export const GITHUB_REPO = 'https://github.com/ZephyRoute/deepmark';
export const GITHUB_BLOB = `${GITHUB_REPO}/blob/main`;
export const GITHUB_TREE = `${GITHUB_REPO}/tree/main`;
export const DIAGRAMS_DIR = 'diagrams/out/svg';
export const OG_IMAGE_SOURCE = 'docs/media/poster.jpg';

/** One slice of a repository markdown file, read in place at build time. */
export interface SourcePart {
  /** Path from the repository root. */
  file: string;
  /** Take only the H2 section with this exact title. */
  heading?: string;
  /** Take only the text between the H1 and the first H2. */
  intro?: boolean;
  /** Leave out the section heading itself (the page title replaces it). */
  dropHeading?: boolean;
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  parts: SourcePart[];
  /** The page is generated from the diagram files instead of markdown. */
  generated?: 'diagrams';
}

const README = 'README.md';

export const PAGES: DocPage[] = [
  {
    slug: 'overview',
    title: 'Overview',
    description: 'What Deepmark is, how to play it in a minute, and why the game uses Stellar.',
    parts: [
      { file: README, intro: true },
      { file: README, heading: 'Watch' },
      { file: README, heading: 'Play in one minute' },
      { file: README, heading: 'Why Stellar' },
      { file: README, heading: 'Check it yourself' },
      { file: README, heading: 'Where things are' },
    ],
  },
  {
    slug: 'how-it-works',
    title: 'How it works',
    description: 'What lives on chain, what stays in the browser, and why a run is only two transactions.',
    parts: [{ file: 'docs/architecture/onchain-boundary.md' }],
  },
  {
    slug: 'diagrams',
    title: 'Diagrams',
    description: 'Seven diagrams of the system: context, one run, replay verification, relic trust, client, data and deployment.',
    parts: [],
    generated: 'diagrams',
  },
  {
    slug: 'verify',
    title: 'Verify a run',
    description: 'Replay a finished run yourself in 60 seconds with one read only command and no wallet.',
    parts: [{ file: README, heading: 'Verify a run in 60 seconds', dropHeading: true }],
  },
  {
    slug: 'contracts',
    title: 'Contracts and links',
    description: 'Every testnet contract, asset and setup transaction, each linked to the Stellar explorer.',
    parts: [{ file: README, heading: 'On testnet', dropHeading: true }, { file: 'docs/deployments.md' }],
  },
  {
    slug: 'contract-api',
    title: 'Contract reference',
    description: 'The public contract API, the action encoding, the trust model and the storage layout.',
    parts: [{ file: 'contracts/deepmark-contract/README.md' }],
  },
  {
    slug: 'threat-model',
    title: 'Threat model',
    description: 'The attacks considered, what stops each one, and what is not covered.',
    parts: [{ file: 'docs/threat-model.md' }],
  },
  {
    slug: 'delvers',
    title: 'Delvers and the NFT standard',
    description: 'How delvers compare with the current Stellar standard for non fungible tokens.',
    parts: [{ file: 'docs/architecture/delvers-and-nft-standard.md' }],
  },
  {
    slug: 'costs',
    title: 'Costs',
    description: 'Fees, rent and compute measured from real testnet transactions.',
    parts: [{ file: README, heading: 'Measured costs', dropHeading: true }],
  },
  {
    slug: 'limitations',
    title: 'Limitations',
    description: 'What the project does not do and where its claims stop.',
    parts: [{ file: README, heading: 'Limitations', dropHeading: true }],
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    description: 'How accessibility is checked, what works, and the known gaps.',
    parts: [{ file: 'docs/accessibility.md' }],
  },
  {
    slug: 'performance',
    title: 'Performance',
    description: 'How performance is measured, the results and the budgets the build must keep.',
    parts: [{ file: 'docs/performance.md' }],
  },
  {
    slug: 'roadmap',
    title: 'Roadmap',
    description: 'Where Deepmark is headed, tied to the limits of the game today.',
    parts: [{ file: 'docs/roadmap.md' }],
  },
  {
    slug: 'business-model',
    title: 'Business model',
    description: 'How the game could be funded without a token or anything pay to win.',
    parts: [{ file: 'docs/business-model.md' }],
  },
];

export function pageUrl(slug: string): string {
  return `${DOCS_BASE}/${slug}/`;
}
