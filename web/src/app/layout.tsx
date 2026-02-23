import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YieldMind — Autonomous DeFi Intelligence',
  description:
    'AI-powered yield optimization on Hedera. Express your intent, let agents coordinate.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Scanline overlay */}
        <div className="fixed inset-0 scanline z-50 pointer-events-none" />
        {/* Grid background */}
        <div className="fixed inset-0 bg-grid-pattern bg-grid -z-10" />
        {children}
      </body>
    </html>
  );
}
