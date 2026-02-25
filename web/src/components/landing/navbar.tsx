'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
          ? 'bg-page/90 backdrop-blur-md border-b border-border-subtle'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo without text.png"
            alt="YieldMind"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-[#F7F6F0]">Yield</span>
            <span className="text-supply">Mind</span>
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="#how-it-works"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors hidden md:block"
          >
            How It Works
          </Link>
          <Link
            href="#agents"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors hidden md:block"
          >
            Agents
          </Link>
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
            className="h-9 px-5 rounded-[8px] bg-supply text-sm font-semibold text-white flex items-center gap-2 hover:bg-supply/90 transition-all"
          >
            Launch App
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
