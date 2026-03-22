/**
 * HederaToolkit — Wraps the official Hedera Agent Kit for autonomous on-chain execution.
 *
 * Provides:
 * 1. HederaLangchainToolkit with built-in tools (HBAR transfers, HCS topics/messages, queries)
 * 2. Custom Bonzo Finance tools (deposit via WETHGateway, harvest via strategy contracts)
 * 3. Custom YieldMind tools (vault scanning, volatility analysis, sentiment analysis)
 *
 * All tools are LangChain-compatible and ready for use in a ReAct agent.
 */

import {
  HederaLangchainToolkit,
  AgentMode,
  coreAccountPlugin,
  coreConsensusPlugin,
  coreQueriesPlugin,
} from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { KeeperService } from './keeper-service.js';
import type { BonzoVaultClient } from '../bonzo/vault-client.js';
import type { BonzoVaultsClient } from '../bonzo/bonzo-vaults-client.js';
import { BONZO_LEND_MAINNET } from '../config/bonzo-contracts.js';

// ── Types ─────────────────────────────────────────────────────

export interface HederaToolkitConfig {
  /** Mainnet account for autonomous execution on Bonzo */
  mainnetAccountId: string;
  mainnetPrivateKey: string;
  /** Testnet account for HCS logging */
  testnetAccountId?: string;
  testnetPrivateKey?: string;
  /** Services to wrap as tools */
  keeperService: KeeperService;
  bonzoLendClient: BonzoVaultClient;
  bonzoVaultsClient: BonzoVaultsClient;
}

export interface HederaToolkitInstance {
  /** The official Hedera Agent Kit LangChain toolkit */
  langchainToolkit: HederaLangchainToolkit;
  /** All tools (built-in + custom) for the LangChain agent */
  getAllTools: () => ReturnType<HederaLangchainToolkit['getTools']>;
  /** Mainnet Hedera client for direct operations */
  mainnetClient: Client;
}

// ── WETHGateway ABI fragments ─────────────────────────────────

// depositETH(address lendingPool, address onBehalfOf, uint16 referralCode)
const WETH_GATEWAY_DEPOSIT_SELECTOR = '0x474cf53d';

// ── Create Toolkit ────────────────────────────────────────────

export function createHederaToolkit(
  config: HederaToolkitConfig
): HederaToolkitInstance {
  // Initialize mainnet client for Bonzo operations
  // Support both DER-encoded (302e...) and raw hex private keys
  const pk = config.mainnetPrivateKey.startsWith('302')
    ? PrivateKey.fromStringDer(config.mainnetPrivateKey)
    : PrivateKey.fromStringECDSA(config.mainnetPrivateKey);
  const mainnetClient = Client.forMainnet().setOperator(
    config.mainnetAccountId,
    pk
  );

  // Initialize the official Hedera Agent Kit
  const langchainToolkit = new HederaLangchainToolkit({
    client: mainnetClient,
    configuration: {
      tools: [], // empty = load all tools
      plugins: [coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin],
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  // ── Custom Bonzo Finance Tools ──────────────────────────────

  const depositHbarToBonzoTool = new DynamicStructuredTool({
    name: 'deposit_hbar_to_bonzo',
    description:
      'Deposit HBAR into the Bonzo Finance lending pool on Hedera mainnet. ' +
      'This calls the WETHGateway contract which wraps HBAR into WHBAR and deposits into the LendingPool. ' +
      'The agent receives aWHBAR tokens representing the deposit position. ' +
      'Use this when the user wants to earn yield on their HBAR.',
    schema: z.object({
      amountHbar: z
        .number()
        .positive()
        .describe('Amount of HBAR to deposit (e.g., 10 for 10 HBAR)'),
      onBehalfOf: z
        .string()
        .optional()
        .describe(
          'EVM address to receive aTokens. Defaults to the agent operator address.'
        ),
    }),
    func: async (input: { amountHbar: number; onBehalfOf?: string }) => {
      const { amountHbar, onBehalfOf } = input;
      try {
        const rpcUrl = 'https://mainnet.hashio.io/api';
        const lendingPoolAddress = BONZO_LEND_MAINNET.lendingPool.evmAddress;
        const wethGatewayAddress = BONZO_LEND_MAINNET.wethGateway.evmAddress;

        // Get operator EVM address via mirror node
        const operatorEvmAddress =
          onBehalfOf || (await getOperatorEvmAddress(config.mainnetAccountId));

        // Encode depositETH(address lendingPool, address onBehalfOf, uint16 referralCode)
        const paddedLendingPool = lendingPoolAddress
          .replace('0x', '')
          .toLowerCase()
          .padStart(64, '0');
        const paddedOnBehalfOf = operatorEvmAddress
          .replace('0x', '')
          .toLowerCase()
          .padStart(64, '0');
        const paddedReferral = '0'.repeat(64); // referralCode = 0

        const calldata =
          WETH_GATEWAY_DEPOSIT_SELECTOR +
          paddedLendingPool +
          paddedOnBehalfOf +
          paddedReferral;

        // Convert HBAR to tinybars (1 HBAR = 100_000_000 tinybar) then to wei (1 HBAR = 10^18 wei on EVM)
        const amountWei = BigInt(Math.floor(amountHbar * 1e18));
        const valueHex = '0x' + amountWei.toString(16);

        // Send transaction via JSON-RPC using the agent's account
        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendRawTransaction',
            params: [
              {
                to: wethGatewayAddress,
                data: calldata,
                value: valueHex,
              },
            ],
          }),
        });

        const result = (await txResponse.json()) as {
          result?: string;
          error?: { message?: string };
        };

        if (result.error) {
          // Fall back to Hedera SDK ContractExecuteTransaction
          return await executeDepositViaHederaSDK(
            mainnetClient,
            config.mainnetAccountId,
            amountHbar,
            operatorEvmAddress
          );
        }

        const txHash = result.result;
        return JSON.stringify({
          success: true,
          txHash,
          amount: amountHbar,
          token: 'HBAR',
          target: 'Bonzo LendingPool (via WETHGateway)',
          hashscanUrl: `https://hashscan.io/mainnet/transaction/${txHash}`,
          message: `Successfully deposited ${amountHbar} HBAR into Bonzo Finance. You will receive aWHBAR tokens.`,
        });
      } catch (error) {
        // Try Hedera SDK path as fallback
        try {
          const operatorEvmAddress = await getOperatorEvmAddress(
            config.mainnetAccountId
          );
          return await executeDepositViaHederaSDK(
            mainnetClient,
            config.mainnetAccountId,
            amountHbar,
            operatorEvmAddress
          );
        } catch (sdkError) {
          return JSON.stringify({
            success: false,
            error:
              sdkError instanceof Error ? sdkError.message : String(sdkError),
            message: `Failed to deposit HBAR into Bonzo: ${sdkError instanceof Error ? sdkError.message : String(sdkError)}`,
          });
        }
      }
    },
  });

  const harvestBonzoVaultTool = new DynamicStructuredTool({
    name: 'harvest_bonzo_vault',
    description:
      'Call harvest() on a Bonzo Vault strategy contract to collect accrued rewards, ' +
      'swap them to vault underlying assets, and re-deposit them (auto-compounding). ' +
      'This increases pricePerShare for all vault depositors. ' +
      'Use this when market analysis indicates harvesting is optimal.',
    schema: z.object({
      strategyAddress: z
        .string()
        .describe('EVM address of the Bonzo Vault strategy contract (0x...)'),
      vaultName: z.string().describe('Name of the vault being harvested'),
      reasoning: z
        .string()
        .describe(
          'Human-readable explanation of why harvesting now is optimal'
        ),
    }),
    func: async (input: { strategyAddress: string; vaultName: string; reasoning: string }) => {
      const { strategyAddress, vaultName, reasoning } = input;
      try {
        // Get agent's EVM address for the call fee recipient
        const agentEvmAddress = await getOperatorEvmAddress(config.mainnetAccountId);

        // harvest(address callerAddress) — selector 0x0e5c011e
        // The caller receives a small callFee as incentive for triggering the harvest.
        // This is the standard Beefy-style keeper pattern used by Bonzo Vaults.
        const paddedCaller = agentEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
        const harvestCalldata = '0x0e5c011e' + paddedCaller;

        // Pre-flight check: eth_call to verify rewards are ready before spending gas
        const rpcUrl = 'https://mainnet.hashio.io/api';
        const simResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [
              { to: strategyAddress, data: harvestCalldata, from: agentEvmAddress },
              'latest',
            ],
          }),
        });

        const simResult = (await simResponse.json()) as {
          result?: string;
          error?: { message?: string; data?: string };
        };

        if (simResult.error) {
          // Check for "IMF" = Insufficient Management Fee (not enough rewards yet)
          const errData = simResult.error.data || simResult.error.message || '';
          const isIMF = errData.includes('494d46') || errData.includes('IMF');

          if (isIMF) {
            return JSON.stringify({
              success: false,
              reason: 'insufficient_rewards',
              vault: vaultName,
              strategy: strategyAddress,
              reasoning,
              message: `Harvest decision made for "${vaultName}" but insufficient rewards accumulated since last harvest. ` +
                `The keeper will retry when enough fees have accrued. Decision: ${reasoning}`,
            });
          }

          return JSON.stringify({
            success: false,
            reason: 'preflight_failed',
            vault: vaultName,
            strategy: strategyAddress,
            reasoning,
            error: simResult.error.message,
            message: `Harvest pre-flight failed for "${vaultName}": ${simResult.error.message}. Decision logged: ${reasoning}`,
          });
        }

        // Pre-flight passed — rewards are ready! Execute real harvest on-chain via Hedera SDK
        try {
          const txResult = await executeHarvestViaHederaSDK(
            mainnetClient,
            strategyAddress,
            agentEvmAddress
          );
          return JSON.stringify({
            success: true,
            vault: vaultName,
            strategy: strategyAddress,
            reasoning,
            txHash: txResult.txHash,
            hashscanUrl: txResult.hashscanUrl,
            callFeeRecipient: agentEvmAddress,
            message: `Successfully harvested vault "${vaultName}". Rewards compounded for all depositors. ${reasoning}`,
          });
        } catch (execErr) {
          return JSON.stringify({
            success: false,
            reason: 'execution_failed',
            vault: vaultName,
            strategy: strategyAddress,
            reasoning,
            error: execErr instanceof Error ? execErr.message : String(execErr),
            message: `Harvest pre-flight passed but on-chain execution failed for "${vaultName}". Decision logged: ${reasoning}`,
          });
        }
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          vault: vaultName,
          reasoning,
          message: `Harvest attempt failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });

  // ── Custom Analysis Tools (wrapping existing services) ──────

  const analyzeVolatilityTool = new DynamicStructuredTool({
    name: 'analyze_token_volatility',
    description:
      'Analyze realized volatility for a token using CoinGecko price history. ' +
      'Returns annualized volatility (24h and 7d), price change, and high-volatility flag. ' +
      'Use this to decide whether to harvest (high vol = harvest now) or delay (low vol = compound).',
    schema: z.object({
      token: z
        .string()
        .describe(
          'Token symbol to analyze (e.g., HBAR, USDC, SAUCE, BONZO)'
        ),
    }),
    func: async (input: { token: string }) => {
      const vol = await config.keeperService.getVolatility(input.token);
      if (!vol)
        return JSON.stringify({
          error: `No volatility data available for ${input.token}`,
        });
      return JSON.stringify(vol);
    },
  });

  const analyzeSentimentTool = new DynamicStructuredTool({
    name: 'analyze_token_sentiment',
    description:
      'RAG-powered sentiment analysis for a token. Retrieves data from CoinGecko (market stats), ' +
      'CryptoPanic (news headlines), and trending data, then uses an LLM to analyze market sentiment. ' +
      'Returns bullish/bearish/neutral with confidence score and reasoning. ' +
      'Use this to decide harvest timing: bearish = harvest now, bullish = delay.',
    schema: z.object({
      token: z
        .string()
        .describe('Token symbol to analyze (e.g., HBAR, SAUCE, BONZO)'),
    }),
    func: async (input: { token: string }) => {
      const sentiment = await config.keeperService.getSentiment(input.token);
      if (!sentiment)
        return JSON.stringify({
          error: `No sentiment data available for ${input.token}`,
        });
      return JSON.stringify(sentiment);
    },
  });

  const scanBonzoVaultsTool = new DynamicStructuredTool({
    name: 'scan_bonzo_vaults',
    description:
      'Scan available Bonzo Finance vaults (Bonzo Lend reserves + single-asset Bonzo Vaults). ' +
      'Returns vault names, APYs, TVL, risk levels, deposit tokens, and strategy addresses. ' +
      'Only returns vaults where the user can deposit with a SINGLE token. ' +
      'Use this to find the best vault for a deposit based on user preferences.',
    schema: z.object({
      riskTolerance: z
        .enum(['conservative', 'moderate', 'aggressive'])
        .optional()
        .describe('Filter by risk level'),
      tokenSymbol: z
        .string()
        .optional()
        .describe(
          'Filter by deposit token (e.g., HBAR, USDC). If omitted, returns all.'
        ),
    }),
    func: async (input: { riskTolerance?: string; tokenSymbol?: string }) => {
      const { riskTolerance, tokenSymbol } = input;
      const [lendReserves, vaults] = await Promise.all([
        config.bonzoLendClient.getVaults().catch(() => []),
        config.bonzoVaultsClient.getVaults().catch(() => []),
      ]);

      const filteredLend = lendReserves.filter((v) => {
        if (
          riskTolerance &&
          v.riskLevel !== riskTolerance
        )
          return false;
        if (tokenSymbol) {
          const normalized =
            tokenSymbol.toUpperCase() === 'HBAR'
              ? 'WHBAR'
              : tokenSymbol.toUpperCase();
          if (v.symbol !== normalized) return false;
        }
        return true;
      });

      const filteredVaults = vaults.filter((v) => {
        if (riskTolerance && v.riskLevel !== riskTolerance) return false;
        // Exclude dual-asset vaults when filtering by single token —
        // user can't deposit just HBAR into a USDC-HBAR vault
        if (tokenSymbol && v.type === 'dual-asset-dex') return false;
        if (tokenSymbol) {
          const normalized =
            tokenSymbol.toUpperCase() === 'HBAR'
              ? 'WHBAR'
              : tokenSymbol.toUpperCase();
          if (!v.depositToken.includes(normalized)) return false;
        }
        return true;
      });

      return JSON.stringify({
        bonzoLend: filteredLend.map((v) => ({
          name: v.name,
          symbol: v.symbol,
          apy: v.apy,
          tvl: v.tvl,
          riskLevel: v.riskLevel,
          evmAddress: v.evmAddress,
        })),
        bonzoVaults: filteredVaults.map((v) => ({
          name: v.name,
          depositToken: v.depositToken,
          type: v.type,
          apy: v.apy,
          tvl: v.tvl,
          riskLevel: v.riskLevel,
          vaultAddress: v.vaultAddress,
          strategyAddress: v.strategyAddress,
        })),
        totalOptions: filteredLend.length + filteredVaults.length,
      });
    },
  });

  const getKeeperAnalysisTool = new DynamicStructuredTool({
    name: 'get_keeper_analysis',
    description:
      'Run the full intelligent keeper analysis on all Bonzo Vaults. ' +
      'Combines volatility monitoring + RAG sentiment analysis to make harvest/rebalance decisions. ' +
      'Returns per-vault decisions: harvest-now, harvest-delay, monitor, or alert.',
    schema: z.object({}),
    func: async () => {
      const decisions = await config.keeperService.analyzeVaults();
      return JSON.stringify(
        decisions.map((d) => ({
          vault: d.vault.name,
          action: d.action,
          reasoning: d.reasoning,
          confidence: d.confidence,
          volatility: d.data.volatility
            ? {
                vol24h: d.data.volatility.realizedVol24h,
                priceChange24h: d.data.volatility.priceChange24h,
                isHighVol: d.data.volatility.isHighVolatility,
              }
            : null,
          sentiment: d.data.sentiment
            ? {
                direction: d.data.sentiment.sentiment,
                confidence: d.data.sentiment.confidence,
              }
            : null,
          strategyAddress: d.vault.strategyAddress,
        }))
      );
    },
  });

  // ── Combine all tools ───────────────────────────────────────

  const getAllTools = () => {
    const builtInTools = langchainToolkit.getTools();
    const customTools = [
      depositHbarToBonzoTool,
      harvestBonzoVaultTool,
      analyzeVolatilityTool,
      analyzeSentimentTool,
      scanBonzoVaultsTool,
      getKeeperAnalysisTool,
    ];
    return [...builtInTools, ...customTools] as ReturnType<
      HederaLangchainToolkit['getTools']
    >;
  };

  return {
    langchainToolkit,
    getAllTools,
    mainnetClient,
  };
}

// ── Helper: Execute deposit via Hedera SDK ────────────────────

async function executeDepositViaHederaSDK(
  client: Client,
  operatorAccountId: string,
  amountHbar: number,
  onBehalfOfEvm: string
): Promise<string> {
  const { ContractExecuteTransaction, Hbar, ContractId } = await import(
    '@hashgraph/sdk'
  );

  // WETHGateway Hedera contract ID (mainnet)
  const wethGatewayContractId = ContractId.fromString('0.0.7308485');
  const lendingPoolAddress = BONZO_LEND_MAINNET.lendingPool.evmAddress;

  // Encode depositETH(address, address, uint16)
  const paddedLP = lendingPoolAddress
    .replace('0x', '')
    .toLowerCase()
    .padStart(64, '0');
  const paddedUser = onBehalfOfEvm
    .replace('0x', '')
    .toLowerCase()
    .padStart(64, '0');
  const paddedRef = '0'.repeat(64);

  const calldataHex =
    WETH_GATEWAY_DEPOSIT_SELECTOR + paddedLP + paddedUser + paddedRef;
  const functionParams = Buffer.from(calldataHex.replace('0x', ''), 'hex');

  const tx = new ContractExecuteTransaction()
    .setContractId(wethGatewayContractId)
    .setGas(300_000)
    .setPayableAmount(new Hbar(amountHbar))
    .setFunctionParameters(functionParams);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();

  return JSON.stringify({
    success: receipt.status.toString() === 'SUCCESS',
    txHash: txId,
    amount: amountHbar,
    token: 'HBAR',
    target: 'Bonzo LendingPool (via WETHGateway)',
    hashscanUrl: `https://hashscan.io/mainnet/transaction/${txId}`,
    message: `Deposited ${amountHbar} HBAR into Bonzo Finance via Hedera SDK. Status: ${receipt.status}`,
  });
}

// ── Helper: Execute harvest via Hedera SDK ────────────────────

async function executeHarvestViaHederaSDK(
  client: Client,
  strategyAddress: string,
  callerEvmAddress: string
): Promise<{ txHash: string; hashscanUrl: string }> {
  const { ContractExecuteTransaction, ContractId } = await import(
    '@hashgraph/sdk'
  );

  // Resolve strategy EVM address to Hedera contract ID
  const STRATEGY_CONTRACT_IDS: Record<string, string> = {
    // Dual-asset DEX strategies (from Bonzo Vaults API)
    '0x157EB9ba35d70560D44394206D4a03885C33c6d5': '0.0.10164472',  // USDC-HBAR
    '0x3Dab58797e057878d3cD8f78F28C6967104FcD0c': '0.0.10164552',  // BONZO-XBONZO
    '0xE9Ab1D3C3d086A8efA0f153f107B096BEaBDee6f': '0.0.10164571',  // SAUCE-XSAUCE
    '0xDC74aC010A60357A89008d5eBDBaF144Cf5BD8C6': '0.0.10164768',  // USDC-SAUCE
    // Single-asset DEX strategies (on-chain, not in API)
    '0x7AbF45908d733a60799d1B4B04E373366770EEcC': '0.0.10031148',  // JAM/HBAR
    '0x1787Cd1DFAd83e85c2D4713F7032521592FA807B': '0.0.10031149',  // HBAR/JAM
    '0x3cE3A64669d1E3ab4789235Fc3e019234C4be9B7': '0.0.10031112',  // PACK/HBAR
    '0xC260c60b3e974F54A73c0a6F540ee5eC979fDc00': '0.0.10031113',  // HBAR/PACK
    '0xC2343277CAE1090052c770dEf66Cb5911fAF4f05': '0.0.10031116',  // BONZO/HBAR
    '0x5dAE71d8a6F980f88F6586dF1A528E53456b8C97': '0.0.10031119',  // USDC/HBAR
    '0xB8021f6a7BE89DFd0F66B89CE4cae76De33A90A2': '0.0.9707529',   // HBAR/USDC
    '0xA1ffF8A98edb1c314cf6a64b47b842A2954304a1': '0.0.10031122',  // DOVU/HBAR
    '0xDAd5F1F4094451Ffd8DDD65dD48A99e7E277FbC9': '0.0.10031123',  // HBAR/DOVU
    '0x5241E22Feb810C50F32Bf16a0edD4105E47Be165': '0.0.10031115',  // SAUCE/HBAR
    '0x9271898ceF0d44d1704245C2232D56C05150cdAf': '0.0.10031116',  // HBAR/SAUCE
    '0x4e1bc1184Df76e897BA5eaD761f75B01F6197726': '0.0.10031154',  // HBAR/BONZO
    // Leveraged LST
    '0xE7f31dD688Ce850e44902b2c55D703BC2d91a84e': '0.0.10031157',  // HBARX LST
  };

  let contractId = STRATEGY_CONTRACT_IDS[strategyAddress];
  if (!contractId) {
    try {
      const res = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/contracts/${strategyAddress}`);
      if (res.ok) {
        const data = (await res.json()) as { contract_id?: string };
        if (data.contract_id) contractId = data.contract_id;
      }
    } catch { /* fall through */ }
    if (!contractId) {
      throw new Error(`Unknown strategy contract: ${strategyAddress}. Cannot resolve Hedera contract ID.`);
    }
  }

  // harvest(address callerAddress) — selector 0x0e5c011e
  // Bonzo's own keeper uses this selector. The caller receives a callFee as incentive.
  const paddedCaller = callerEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
  const functionParams = Buffer.from('0e5c011e' + paddedCaller, 'hex');

  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(1_500_000) // Bonzo harvests use ~1M gas
    .setFunctionParameters(functionParams);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();

  if (receipt.status.toString() !== 'SUCCESS') {
    throw new Error(`Harvest transaction failed: ${receipt.status}`);
  }

  console.log(`[HederaToolkit] Harvest SUCCESS on ${contractId} — tx: ${txId}`);

  return {
    txHash: txId,
    hashscanUrl: `https://hashscan.io/mainnet/transaction/${txId}`,
  };
}

// ── Helper: Get EVM address for Hedera account ────────────────

async function getOperatorEvmAddress(accountId: string): Promise<string> {
  const mirrorUrl = 'https://mainnet.mirrornode.hedera.com';
  const response = await fetch(
    `${mirrorUrl}/api/v1/accounts/${accountId}?transactiontype=ETHEREUMTRANSACTION`
  );

  if (!response.ok) {
    // Fallback: derive from account ID
    const parts = accountId.split('.');
    const num = parseInt(parts[2], 10);
    return '0x' + num.toString(16).padStart(40, '0');
  }

  const data = (await response.json()) as { evm_address?: string };
  return data.evm_address || '0x' + accountId.split('.')[2].padStart(40, '0');
}
