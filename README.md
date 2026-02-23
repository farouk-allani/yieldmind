# 🧠 YieldMind Protocol

**Autonomous DeFi Coordination Layer for Hedera**

> Tell our AI agents what you want in plain English. They think, coordinate, and execute — every decision logged transparently on Hedera Consensus Service. No black boxes.

## 🎯 What is YieldMind?

YieldMind is a network of specialized AI agents that collaboratively manage DeFi yield strategies on Hedera. Users express their yield intent in natural language, and 4 autonomous agents work together to find optimal Bonzo Vault strategies, execute on-chain transactions, and monitor positions — all with transparent, auditable decision-making on HCS.

### The 4 Agents

| Agent | Role | What It Does |
|-------|------|-------------|
| 🔍 **Scout** | Discovery | Scans Bonzo Vaults, evaluates APY/risk/liquidity, scores opportunities |
| 🧠 **Strategist** | Decision-Making | Interprets user intent, builds multi-vault allocation strategy |
| ⚡ **Executor** | On-Chain Actions | Deposits, harvests, rebalances via Hedera Agent Kit |
| 🛡️ **Sentinel** | Monitoring | Watches market conditions, triggers alerts and emergency exits |

### Transparent AI on Hedera

Every agent decision is published to Hedera Consensus Service with:
- Human-readable reasoning explaining *why* the decision was made
- Confidence scores
- Timestamps with Hedera consensus proof

**No black boxes. Every AI decision is auditable on-chain.**

## 🏗️ Tech Stack

- **Agents:** TypeScript, LangChain.js, Hedera Agent Kit
- **Blockchain:** Hedera Testnet (HCS, HTS, EVM Smart Contracts)
- **DeFi:** Bonzo Vault contracts
- **Frontend:** Next.js 14, Tailwind CSS, Framer Motion
- **LLM:** Claude API (Anthropic) for agent reasoning

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Hedera Testnet account ([Get one here](https://portal.hedera.com/faucet))

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/yieldmind.git
cd yieldmind

# Install dependencies
cd agents && npm install
cd ../web && npm install

# Configure environment
cp .env.example .env
# Edit .env with your Hedera testnet credentials

# Start the agent runtime
cd agents && npm run dev

# In another terminal, start the dashboard
cd web && npm run dev
```

### Testing

```bash
cd agents && npm test
```

## 📐 Architecture

```
User Intent (natural language)
       │
       ▼
┌──────────────────────────────────┐
│        Agent Coordinator         │
│  (orchestrates the 4 agents)     │
└──────┬───────┬──────┬───────┬────┘
       │       │      │       │
       ▼       ▼      ▼       ▼
   ┌──────┐ ┌─────┐ ┌─────┐ ┌────────┐
   │Scout │ │Strat│ │Exec │ │Sentinel│
   └──┬───┘ └──┬──┘ └──┬──┘ └───┬────┘
      │        │       │        │
      └────────┴───┬───┴────────┘
                   │
          ┌────────▼────────┐
          │  Hedera Network │
          │  HCS │ HTS │ EVM│
          └─────────────────┘
```

All agents publish decisions to HCS → permanent audit trail

## 📋 Hackathon Info

- **Track:** AI & Agents (Main Track)
- **Bounty:** Bonzo ($8,000)
- **Event:** Hedera Hello Future Apex Hackathon 2026

## 📄 License

MIT
