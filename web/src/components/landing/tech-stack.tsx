import {
  Layers,
  MessageSquareText,
  Coins,
  Link2,
  Triangle,
  Bot,
  Cpu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type TechItem =
  | { name: string; icon: LucideIcon; image?: undefined; description: string }
  | { name: string; image: string; icon?: undefined; description: string };

const techs: TechItem[] = [
  { name: 'Hedera', image: '/hbar.webp', description: 'Blockchain' },
  { name: 'Bonzo Finance', image: '/bonzo.webp', description: 'DeFi Vaults' },
  { name: 'Hedera Agent Kit', icon: Bot, description: 'Autonomous Execution' },
  { name: 'HCS', icon: MessageSquareText, description: 'Consensus Logging' },
  { name: 'LangChain', icon: Link2, description: 'AI Framework' },
  { name: 'Vercel AI SDK', icon: Cpu, description: 'Streaming Chat' },
];

export function TechStack() {
  return (
    <section className="border-y border-border-subtle py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-[13px] font-medium text-text-muted tracking-wide uppercase text-center mb-8">
          Built With
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6">
          {techs.map((tech) => (
            <div
              key={tech.name}
              className="flex items-center gap-2.5 px-4 py-2 rounded-[8px] border border-border-subtle bg-surface/50 hover:bg-surface transition-colors"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-page flex items-center justify-center flex-shrink-0">
                {tech.image ? (
                  <img
                    src={tech.image}
                    alt={tech.name}
                    className="w-7 h-7 object-cover"
                  />
                ) : tech.icon ? (
                  <tech.icon className="w-3.5 h-3.5 text-text-muted" />
                ) : null}
              </div>
              <div>
                <span className="text-[13px] text-text-primary font-medium block leading-tight">
                  {tech.name}
                </span>
                <span className="text-[10px] text-text-muted">
                  {tech.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
