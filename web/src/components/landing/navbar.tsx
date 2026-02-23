'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
        scrolled
          ? 'bg-page/80 backdrop-blur-sm border-b border-border-subtle'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <span className="font-display text-base font-bold text-text-primary">
            YieldMind
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors hidden sm:block"
          >
            GitHub
          </a>
          <Link
            href="/app"
            className="h-9 px-4 rounded-[8px] bg-accent text-sm font-medium text-white flex items-center hover:bg-accent/90 transition-colors"
          >
            Launch App
          </Link>
        </div>
      </div>
    </nav>
  );
}
