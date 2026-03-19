import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { LiveYields } from '@/components/landing/live-yields';
import { WhyYieldMind } from '@/components/landing/why-yieldmind';
import { HowItWorks } from '@/components/landing/how-it-works';
import { AgentNetwork } from '@/components/landing/agent-network';
import { TransparentAI } from '@/components/landing/transparent-ai';
import { TechStack } from '@/components/landing/tech-stack';
import { CTA, Footer } from '@/components/landing/cta-footer';

export default function LandingPage() {
  return (
    <div className="bg-page min-h-screen">
      <Navbar />
      <Hero />
      <LiveYields />
      <WhyYieldMind />
      <HowItWorks />
      <AgentNetwork />
      <TransparentAI />
      <TechStack />
      <CTA />
      <Footer />
    </div>
  );
}
