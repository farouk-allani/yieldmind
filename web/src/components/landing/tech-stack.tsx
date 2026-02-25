import {
  Layers,
  Landmark,
  MessageSquareText,
  Coins,
  Link2,
  Triangle,
} from 'lucide-react';

const techs = [
  { name: 'Hedera', icon: Layers, description: 'Blockchain' },
  { name: 'Bonzo Finance', icon: Landmark, description: 'DeFi Vaults' },
  { name: 'HCS', icon: MessageSquareText, description: 'Consensus' },
  { name: 'HTS', icon: Coins, description: 'Token Service' },
  { name: 'LangChain', icon: Link2, description: 'AI Framework' },
  { name: 'Next.js', icon: Triangle, description: 'Frontend' },
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
              <div className="w-7 h-7 rounded-[6px] bg-page flex items-center justify-center">
                <tech.icon className="w-3.5 h-3.5 text-text-muted" />
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
