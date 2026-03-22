import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'YieldMind — Autonomous DeFi Intelligence',
  description:
    'AI-powered yield optimization on Hedera. 4 specialized agents collaborate to manage Bonzo Finance strategies — every decision logged transparently on HCS.',
  icons: {
    icon: [
      { url: '/logo without text.png', type: 'image/png' },
    ],
    apple: '/logo without text.png',
  },
  openGraph: {
    title: 'YieldMind Protocol',
    description:
      'Autonomous DeFi coordination layer for Hedera. AI agents that think, execute, and prove every decision on-chain.',
    type: 'website',
    siteName: 'YieldMind',
  },
  twitter: {
    card: 'summary',
    title: 'YieldMind Protocol',
    description:
      'Autonomous DeFi coordination layer for Hedera. AI agents that think, execute, and prove every decision on-chain.',
  },
  keywords: [
    'Hedera',
    'DeFi',
    'AI Agents',
    'Bonzo Finance',
    'HCS',
    'Yield Optimization',
    'Autonomous',
    'Keeper Agent',
    'Hedera Agent Kit',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
