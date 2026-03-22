<p align="center">
  <img src="web/public/logo without text.png" alt="YieldMind" width="200" />
</p>

<h1 align="center">YieldMind Protocol</h1>

<p align="center">
  <strong>Autonomous DeFi Coordination Layer for Hedera</strong>
</p>

<p align="center">
  <em>Tell our AI agents what you want in plain English. They think, coordinate, and execute — every decision logged transparently on Hedera Consensus Service. No black boxes.</em>
</p>

<p align="center">
  <a href="#hackathon">Hedera Hello Future Apex Hackathon 2026</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#demo">Demo</a>
</p>

---

## Hackathon

| | |
|---|---|
| **Event** | Hedera Hello Future Apex Hackathon 2026 |
| **Track** | AI & Agents (Main Track) |
| **Bounty** | Bonzo Finance ($8K pool) — Intelligent Keeper Agent with Hedera Agent Kit |


### Project Description

YieldMind is an autonomous DeFi coordination layer where 4 specialized AI agents (Scout, Strategist, Executor, Sentinel) collaborate to manage yield strategies on Bonzo Finance. Users express intent in natural language — "I want safe yield on my HBAR" — and the agents scan vaults, build strategies, execute deposits, and harvest rewards autonomously via Hedera Agent Kit. An intelligent keeper loop analyzes volatility and sentiment data to optimize harvest timing. Every agent decision is logged to Hedera Consensus Service with human-readable reasoning, creating a fully auditable on-chain AI decision trail. No black boxes — every AI thought is verifiable on HashScan.

---

## What Makes YieldMind Different

| Feature | Traditional DeFi | Rule-Based Keepers | YieldMind |
|---------|-----------------|-------------------|-----------|
| Decision Making | Manual by user | if/else rules | AI reasoning with confidence scores |
| Transparency | Tx hash only | No logs | Full reasoning on HCS |
| Harvest Timing | Fixed interval | Fixed interval | Volatility + sentiment analysis |
| User Experience | Complex DeFi UI | N/A | Natural language chat |
| Audit Trail | None | None | Every decision on-chain via HCS |

---

## Architecture

### System Overview

> **[View Interactive Diagram on Excalidraw](https://excalidraw.com/#json=3GNpf7E1I_dY3crHPiE3H,ug9zbrqP_D2hKb8GkriTxw)**

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Layer (Next.js + Vercel AI SDK)                       │
│  ┌──────────────┐   ┌─────────────────────┐   ┌─────────────┐  │
│  │ User Intent   │──▶│ Chat Interface      │──▶│ Dashboard   │  │
│  │ (plain text)  │   │ (streaming + tools) │   │ + Portfolio  │  │
│  └──────────────┘   └─────────────────────┘   └─────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Agent Layer (LangChain)                                     │
│                  ┌───────────────────┐                          │
│                  │ Agent Coordinator │                          │
│                  └──┬───┬───┬───┬───┘                          │
│           ┌─────────┘   │   │   └─────────┐                    │
│           ▼             ▼   ▼             ▼                    │
│  ┌──────────┐  ┌───────────┐  ┌─────────┐  ┌──────────┐       │
│  │  Scout   │  │Strategist │  │Executor │  │ Sentinel │       │
│  │Discovery │  │ Planning  │  │ Actions │  │  Alerts  │       │
│  └──────────┘  └───────────┘  └─────────┘  └──────────┘       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Blockchain & DeFi Layer (Hedera)                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ Keeper Loop    │─▶│ Hedera Agent   │─▶│ Bonzo Finance    │  │
│  │ (autonomous)   │  │ Kit (on-chain) │  │ (Lend + Vaults)  │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│                      ┌────────────────┐                        │
│                      │ HCS Decision   │ ◀── all agents log     │
│                      │ Trail (audit)  │     decisions here     │
│                      └────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### The 4 Agents

| Agent | Color | Role | What It Does |
|-------|-------|------|-------------|
| **Scout** | 🟢 | Discovery & Analysis | Scans Bonzo Lend pools and Vaults live. Evaluates APY, TVL, liquidity, and risk. Scores opportunities for user's risk profile. |
| **Strategist** | 🔵 | Strategy & Allocation | Interprets user intent into risk parameters. Builds allocation strategies across Bonzo Lend and Vaults. Explains trade-offs honestly (e.g., single-token limits). |
| **Executor** | 🟠 | On-Chain Execution | Deposits into Bonzo Lend & Vaults on mainnet. Executes autonomous harvests via Hedera Agent Kit. Manages the intelligent keeper loop. |
| **Sentinel** | 🔴 | Monitoring & Protection | Watches market conditions and price feeds. Analyzes volatility and sentiment data. Triggers alerts when thresholds are breached. |

### Keeper Agent — Autonomous Decision Flow

> **[View Interactive Diagram on Excalidraw](https://excalidraw.com/#json=xL4Fj1IXiG0ERAVJ9pO38,HvQ60L3YY-x1ly0j_AZO5Q)**

```
              ┌──────────────────┐
              │ Keeper Loop Start│
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │ Scan Bonzo Vaults│  ← 4 vaults: APY, TVL, strategy
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │Analyze Volatility│  ← 24h + 7d realized vol
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │Analyze Sentiment │  ← RAG pipeline, news headlines
              └────────┬─────────┘
                       ▼
                 ╔═══════════╗
                 ║ AI Decision║
                 ║  Harvest?  ║
                 ╚═════╤═════╝
              YES ┌────┴────┐ NO
                  ▼         ▼
        ┌──────────────┐  ┌──────────────┐
        │Execute Harvest│  │Monitor/Delay │
        │via Agent Kit  │  │Log reasoning │
        └──────┬───────┘  └──────┬───────┘
               ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Log to HCS   │  │ Log to HCS   │
        │harvest-exec  │  │harvest-delay │
        └──────┬───────┘  └──────┬───────┘
               └────────┬────────┘
                        ▼
              ┌──────────────────┐
              │ Wait 5 min, loop │ ──→ back to start
              └──────────────────┘
```

The keeper agent doesn't harvest on a fixed schedule — it uses **AI-driven timing**:
- **Volatility** > threshold → delay harvest (wait for stability)
- **Bearish sentiment** + high vol → delay (protect against dumps)
- **Low volatility** + neutral/bullish → harvest now (compound rewards)
- **Pre-flight check** via `eth_call` before spending gas (avoids wasted txs)

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Agent Framework** | Hedera Agent Kit + LangChain.js (ReAct agent with 26 tools) |
| **Blockchain** | Hedera (HCS for consensus logging, EVM for smart contracts) |
| **DeFi Protocol** | Bonzo Finance (Lend pools + Vaults on mainnet) |
| **LLM** | OpenRouter (free tier, multi-model fallback chain) |
| **Frontend** | Next.js 14 (App Router) + Vercel AI SDK (streaming) |
| **Styling** | Tailwind CSS + Framer Motion |
| **Wallets** | MetaMask (EVM) + HashPack/Kabila (WalletConnect) |
| **Database** | Supabase (chat sessions, HCS topic persistence) |
| **Language** | TypeScript (strict mode, entire stack) |

### Bonzo Finance Integration

YieldMind integrates with Bonzo Finance on **Hedera mainnet**:

- **Bonzo Lend** — Supply pools (HBAR, USDC, SAUCE, etc.) with variable APY
- **Bonzo Vaults** — Auto-compounding concentrated liquidity strategies on SaucerSwap V2:
  - HBAR-USDC Single Asset Vault
  - HBAR-USDC Dual Asset Vault
  - USDC-USDC[hts] Vault
  - HBAR-HBARX Leveraged LST Vault

### Hedera Agent Kit Usage

The keeper agent uses Hedera Agent Kit in **AUTONOMOUS mode** to:
1. **Scan vaults** — Custom `scan_bonzo_vaults` tool wrapping BonzoVaultsClient
2. **Analyze markets** — Custom `analyze_volatility` and `analyze_sentiment` tools
3. **Execute harvests** — `ContractExecuteTransaction` calling `harvest(address)` on strategy contracts
4. **Deposit HBAR** — `ContractExecuteTransaction` calling WETHGateway `depositETH()`
5. **Log to HCS** — `TopicMessageSubmitTransaction` with full decision reasoning

The agent signs transactions with a server-side Hedera account — no user wallet needed for keeper operations.

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Hedera Testnet Account** — [Get one free](https://portal.hedera.com/faucet)
- **Hedera Mainnet Account** — For autonomous keeper operations (fund with ~20 HBAR)
- **OpenRouter API Key** — [Free tier](https://openrouter.ai) (no credit card needed)

### Setup

```bash
# Clone the repo
git clone https://github.com/farouk-allani/yieldmind.git
cd yieldmind

# Install dependencies
npm install        # root (installs workspaces)
cd agents && npm install
cd ../web && npm install
cd ..

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see below)

# Start the app (agents + frontend in one process)
cd web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEDERA_NETWORK` | Yes | `testnet` for HCS, `mainnet` for Bonzo |
| `HEDERA_ACCOUNT_ID` | Yes | Testnet account for HCS topics |
| `HEDERA_PRIVATE_KEY` | Yes | Testnet private key (DER-encoded) |
| `HEDERA_MAINNET_ACCOUNT_ID` | For keeper | Mainnet account for autonomous execution |
| `HEDERA_MAINNET_PRIVATE_KEY` | For keeper | Mainnet private key for Agent Kit |
| `OPENROUTER_API_KEY` | Yes | Free LLM API key from OpenRouter |
| `LLM_MODEL` | No | Default: `qwen/qwen3-next-80b-a3b-instruct:free` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | For HashPack | From [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `KEEPER_INTERVAL_MS` | No | Keeper loop interval (default: 300000 = 5 min) |

### Supabase Setup (Optional — for chat persistence)

Create a Supabase project and add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env`. Run the schema from `supabase-schema.sql`.

---

## Demo

### How to Use

1. **Open the app** — Clean dark dashboard with chat interface
2. **Connect wallet** — MetaMask or HashPack via WalletConnect
3. **State your intent** — Type: *"I want safe yield on 10 HBAR"*
4. **Watch agents work** — Scout scans → Strategist picks → Executor proposes
5. **Approve & deposit** — Sign the transaction in your wallet
6. **View transparency** — Every decision logged to HCS, verifiable on HashScan

### Autonomous Keeper Mode

1. **Toggle "Autonomous"** in the chat header
2. **Start the keeper loop** from the Keeper dashboard page
3. **Watch it analyze** — Scans vaults, checks volatility, reads sentiment
4. **See decisions** — "harvest-now", "harvest-delay", "monitoring" with full reasoning
5. **Verify on-chain** — Click HCS topic link to see decisions on HashScan

### Key Pages

| Page | Description |
|------|-------------|
| `/app` | Main chat interface + agent activity sidebar |
| `/app/portfolio` | Wallet positions, Bonzo deposits, harvest controls, withdraw |
| `/app/keeper` | Full keeper dashboard — stats, controls, decision history, HCS links |
| `/app/business` | Business model, pricing tiers, expansion roadmap |
| `/hcs` | HCS Decision Trail viewer — browse all agent decisions by session |

---

## Project Structure

```
yieldmind/
├── agents/                         # Agent backend (TypeScript)
│   └── src/
│       ├── agents/                 # Scout, Strategist, Executor, Sentinel
│       ├── bonzo/                  # Bonzo Lend + Vaults clients
│       ├── config/                 # Bonzo contract addresses, network config
│       ├── core/                   # Agent coordinator, keeper agent, LLM client
│       │   ├── agent-coordinator.ts    # Orchestrates 4-agent pipeline
│       │   ├── keeper-agent.ts         # LangChain ReAct agent (26 tools)
│       │   ├── hedera-toolkit.ts       # Hedera Agent Kit wrapper
│       │   └── keeper-service.ts       # Volatility + sentiment analysis
│       ├── hedera/                 # HCS service, Hedera client
│       └── types/                  # Shared TypeScript types
├── web/                            # Next.js 14 frontend
│   └── src/
│       ├── app/
│       │   ├── app/                # Main app, portfolio, keeper, business pages
│       │   ├── api/                # API routes (chat, keeper, HCS, decisions)
│       │   └── hcs/               # HCS decision trail viewer
│       ├── components/
│       │   ├── chat/              # Chat interface with streaming
│       │   ├── dashboard/         # Agent status, decision log, keeper panel
│       │   ├── landing/           # Landing page sections
│       │   └── wallet/            # Connect button, network toggle
│       └── lib/                   # API client, types, wallet context, vault hooks
├── contracts/                      # Solidity (Hardhat) — YieldMindVault
├── .env.example                    # Environment template
└── README.md                       # This file
```

---

## Transparent AI — HCS Decision Trail

Every agent decision is published to Hedera Consensus Service as a `DecisionLog`:

```json
{
  "agentId": "yieldmind-strategist",
  "agentRole": "strategist",
  "action": "strategy-proposed",
  "reasoning": "User wants safe yield on HBAR. Allocating 100% to HBAR Supply Pool (Bonzo Lend) at 0.68% APY. Conservative — single token, no impermanent loss risk. For higher returns, user would need a second token for dual-asset Bonzo Vaults.",
  "confidence": 0.85,
  "timestamp": "2026-03-22T14:30:00.000Z",
  "sessionId": "abc-123",
  "data": { "strategy": { "totalExpectedApy": 0.68, "overallRisk": "conservative" } }
}
```

Every decision includes:
- **Who** decided (agent ID + role)
- **What** they decided (action)
- **Why** they decided it (human-readable reasoning)
- **How confident** they are (0-1 score)
- **When** (Hedera consensus timestamp)
- **Supporting data** (vault metrics, strategy details)

Verify any decision on [HashScan](https://hashscan.io) by clicking the HCS topic link in the app.

---

## Business Model

YieldMind is designed to scale beyond the hackathon:

### Revenue Streams

1. **Performance Fees** (5-10% of harvested yield) — Only charged when value is created
2. **Keeper Incentives** — Bonzo Vault contracts pay `callFee` to harvest callers
3. **Premium Subscriptions** — Advanced features for power users and institutions

### Expansion Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Bonzo Finance (Lend + Vaults) | Current |
| **Phase 2** | All Hedera DeFi (SaucerSwap, HeliSwap, Stader) | Planned |
| **Phase 3** | Cross-chain (Ethereum, Arbitrum, Base) | Future |
| **Phase 4** | Agent Marketplace (third-party strategy agents) | Vision |

See the full business model at `/app/business` in the live app.

---

## Bounty Checklist — Bonzo Finance

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Hedera Agent Kit | ✅ | `hedera-agent-kit@3.8.1` — autonomous mode, 26 tools |
| Intelligent Keeper | ✅ | AI-driven harvest timing (volatility + sentiment) |
| Bonzo Vault Integration | ✅ | 4 vaults + all Lend pools, live mainnet data |
| Autonomous Execution | ✅ | Server-side account signs via Agent Kit |
| On-Chain Logging | ✅ | Every decision → HCS with full reasoning |
| LangChain | ✅ | ReAct agent with custom + Agent Kit tools |
| Vercel AI SDK | ✅ | Streaming chat responses |
| Multi-Wallet Support | ✅ | MetaMask + HashPack + Kabila |

---

## Team

Built by **Farouk Allani** for the Hedera Hello Future Apex Hackathon 2026.

---

## License

MIT

---

<p align="center">
  <em>Every AI decision, auditable on-chain. No black boxes.</em>
</p>
