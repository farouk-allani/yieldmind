import {
  Layers,
  Landmark,
  MessageSquareText,
  Coins,
  Link2,
  Triangle,
} from 'lucide-react';

const techs = [
  { name: 'Hedera', icon: Layers, color: '#F7F6F0' },
  { name: 'Bonzo Finance', icon: Landmark, color: '#F7F6F0' },
  { name: 'HCS', icon: MessageSquareText, color: '#F7F6F0' },
  { name: 'HTS', icon: Coins, color: '#F7F6F0' },
  { name: 'LangChain', icon: Link2, color: '#F7F6F0' },
  { name: 'Next.js', icon: Triangle, color: '#F7F6F0' },
];

export function TechStack() {
  return (
    <section className="border-y border-border-subtle py-10 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <p className="text-[13px] font-medium text-text-muted tracking-wide uppercase text-center mb-8">
          Built With
        </p>

        {/* Tech row */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {techs.map((tech) => (
            <div
              key={tech.name}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-9 h-9 rounded-[8px] bg-surface flex items-center justify-center">
                <tech.icon className="w-[18px] h-[18px] text-text-muted" />
              </div>
              <span className="text-[12px] text-text-secondary">
                {tech.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
