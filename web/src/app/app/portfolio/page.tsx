'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Shield,
  TrendingUp,
  Vault,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  ArrowDownToLine,
  LogOut,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@/lib/wallet-context';
import { useVault } from '@/lib/use-vault';
import { ConnectWalletButton } from '@/components/wallet/connect-button';
import { NetworkToggle } from '@/components/wallet/network-toggle';
import { getVaultAddress } from '@/lib/vault-abi';
import { getNetworkConfig, hashscanContractUrl, hashscanAccountUrl, hashscanTxUrl } from '@/lib/network-config';

export default function PortfolioPage() {
  const wallet = useWallet();
  const vault = useVault();
  const vaultAddress = getVaultAddress();

  const [userTotal, setUserTotal] = useState<string>('0');
  const [tvl, setTvl] = useState<string>('0');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!wallet.isConnected) return;
    setIsRefreshing(true);
    try {
      const [total, totalLocked] = await Promise.all([
        vault.getUserTotal(),
        vault.getTVL(),
      ]);
      setUserTotal(total);
      setTvl(totalLocked);
    } catch {
      // silently handle
    } finally {
      setIsRefreshing(false);
    }
  }, [wallet.isConnected, vault]);

  useEffect(() => {
    if (mounted && wallet.isConnected) {
      refresh();
    }
  }, [mounted, wallet.isConnected, refresh]);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyContractAddress = () => {
    if (!vaultAddress) return;
    navigator.clipboard.writeText(vaultAddress);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const userDeposited = parseFloat(userTotal);
  const protocolTvl = parseFloat(tvl);
  const walletBalance = wallet.balance ? parseFloat(wallet.balance) : 0;
  const shareOfTvl =
    protocolTvl > 0 ? ((userDeposited / protocolTvl) * 100).toFixed(1) : '0';

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Enter a valid amount');
      return;
    }
    if (amount > userDeposited) {
      setWithdrawError(`Maximum available: ${userDeposited.toFixed(2)} HBAR`);
      return;
    }

    setWithdrawError(null);
    // Use a default strategy ID — in a full implementation this would be per-strategy
    const result = await vault.withdraw('default-strategy', amount);

    if (result.status === 'confirmed' && result.txHash) {
      setWithdrawTxHash(result.txHash);
      refresh();
      wallet.refreshBalance();
    } else if (result.error) {
      setWithdrawError(result.error);
    }
  };

  const handleEmergencyWithdraw = async () => {
    setWithdrawError(null);
    const result = await vault.emergencyWithdraw();

    if (result.status === 'confirmed' && result.txHash) {
      setWithdrawTxHash(result.txHash);
      setShowWithdrawModal(false);
      refresh();
      wallet.refreshBalance();
    } else if (result.error) {
      setWithdrawError(result.error);
    }
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setWithdrawError(null);
    setWithdrawTxHash(null);
    vault.resetStatus();
  };

  if (!mounted) return null;

  const isMainnet = getNetworkConfig().network === 'mainnet';

  return (
    <main className="min-h-screen bg-page">
      {/* Top nav */}
      <header className="border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] hover:bg-surface transition-colors text-text-muted"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Chat</span>
            </Link>
            <div className="w-px h-5 bg-border-subtle" />
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo without text.png"
                alt="YieldMind"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-[#F7F6F0]">Yield</span>
                <span className="text-supply">Mind</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Portfolio</h1>
            <p className="text-sm text-text-muted mt-1">
              Your positions, balances, and on-chain proof
            </p>
          </div>
          {wallet.isConnected && (
            <div className="flex items-center gap-3">
              {userDeposited > 0 && vaultAddress && (
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="flex items-center gap-2 px-3 h-9 rounded-[8px] bg-borrow/10 border border-borrow/20 text-sm text-borrow font-medium hover:bg-borrow/20 transition-colors"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Withdraw
                </button>
              )}
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 h-9 rounded-[8px] bg-surface border border-border-subtle text-sm text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
          )}
        </div>

        {!wallet.isConnected ? (
          <NotConnectedState />
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <OverviewCard
                icon={Vault}
                iconColor="text-supply"
                iconBg="bg-badge-supply"
                label="Your Deposits"
                value={vaultAddress ? `${userDeposited.toFixed(2)} HBAR` : 'N/A'}
                subtext={
                  !vaultAddress
                    ? 'Deposits go directly to Bonzo on mainnet'
                    : userDeposited > 0
                    ? `${shareOfTvl}% of protocol TVL`
                    : 'No active deposits'
                }
                delay={0}
              />
              <OverviewCard
                icon={TrendingUp}
                iconColor="text-accent"
                iconBg="bg-badge-accent"
                label="Protocol TVL"
                value={vaultAddress ? `${protocolTvl.toFixed(2)} HBAR` : 'N/A'}
                subtext={vaultAddress ? 'Total value locked in vault' : 'Bonzo LendingPool handles TVL on mainnet'}
                delay={0.05}
              />
              <OverviewCard
                icon={Shield}
                iconColor="text-danger"
                iconBg="bg-badge-danger"
                label="Sentinel Monitoring"
                value={userDeposited > 0 ? 'Active' : 'Inactive'}
                subtext={
                  userDeposited > 0
                    ? 'Watching prices, volatility & liquidity'
                    : 'Deposit to activate monitoring'
                }
                delay={0.1}
                valueColor={
                  userDeposited > 0 ? 'text-supply' : 'text-text-muted'
                }
              />
              <OverviewCard
                icon={Clock}
                iconColor="text-borrow"
                iconBg="bg-badge-borrow"
                label="Wallet Balance"
                value={`${walletBalance.toFixed(2)} HBAR`}
                subtext="Available to deposit"
                delay={0.15}
              />
            </div>

            {/* Where Are Your Funds — testnet vault section */}
            {vaultAddress && userDeposited > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card overflow-hidden mb-8"
              >
                <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Where Are Your Funds
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Complete breakdown of your deposit flow and current position
                    </p>
                  </div>
                  <a
                    href={hashscanContractUrl(vaultAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Verify on HashScan
                  </a>
                </div>

                {/* Fund Flow Visualization */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row items-stretch gap-4">
                    {/* Step 1: Your Wallet */}
                    <FlowStep
                      icon={<img src="/hbar.webp" alt="HBAR" className="w-5 h-5 rounded-full" />}
                      title="Your Wallet"
                      subtitle={wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : ''}
                      detail={`${walletBalance.toFixed(2)} HBAR available`}
                      color="border-accent/30"
                    />

                    <FlowArrow />

                    {/* Step 2: YieldMindVault Contract */}
                    <FlowStep
                      icon={<Shield className="w-4 h-4 text-supply" />}
                      title="YieldMindVault Contract"
                      subtitle={`${vaultAddress.slice(0, 8)}...${vaultAddress.slice(-6)}`}
                      detail={`${userDeposited.toFixed(2)} HBAR deposited`}
                      color="border-supply/30"
                      highlight
                    />

                    <FlowArrow />

                    {/* Step 3: Bonzo Strategy */}
                    <FlowStep
                      icon={<img src="/bonzo.webp" alt="Bonzo" className="w-5 h-5 rounded-full" />}
                      title="Bonzo Lending Pools"
                      subtitle="Mainnet — coming soon"
                      detail="Strategy powered by live Bonzo data"
                      color="border-points/30"
                      dimmed
                    />
                  </div>

                  {/* Explanation */}
                  <div className="mt-5 space-y-3">
                    <div className="px-4 py-3 rounded-[8px] bg-surface">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        <strong className="text-text-primary">Testnet:</strong>{' '}
                        Your HBAR is held in the{' '}
                        <span className="text-supply font-medium">YieldMindVault</span>{' '}
                        smart contract on {getNetworkConfig().chainName}. The AI agents use live data from{' '}
                        <span className="text-points font-medium">Bonzo Finance</span>{' '}
                        (APY rates, risk metrics, reserve data) to build optimal strategies.
                        The vault is secured with OpenZeppelin ReentrancyGuard and fully
                        auditable on HashScan. Withdraw at any time.
                      </p>
                    </div>
                    <div className="px-4 py-3 rounded-[8px] bg-accent/5 border border-accent/10">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        <strong className="text-accent">Mainnet:</strong>{' '}
                        On mainnet deployment, the vault contract routes funds directly into{' '}
                        <span className="text-points font-medium">Bonzo lending pools</span>{' '}
                        to earn real yield. The same AI agent pipeline selects and manages
                        positions autonomously. Bonzo lending pools are mainnet-only — testnet
                        demonstrates the full pipeline without live yield.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Mainnet: Bonzo Direct deposit flow */}
            {isMainnet && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card overflow-hidden mb-8"
              >
                <div className="px-5 py-4 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Deposit Flow
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    On mainnet, deposits go directly into Bonzo lending pools
                  </p>
                </div>
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row items-stretch gap-4">
                    <FlowStep
                      icon={<img src="/hbar.webp" alt="HBAR" className="w-5 h-5 rounded-full" />}
                      title="Your Wallet"
                      subtitle={wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : ''}
                      detail={`${walletBalance.toFixed(2)} HBAR available`}
                      color="border-accent/30"
                    />
                    <FlowArrow />
                    <FlowStep
                      icon={<img src="/bonzo.webp" alt="Bonzo" className="w-5 h-5 rounded-full" />}
                      title="Bonzo Lending Pools"
                      subtitle="Direct deposit via LendingPool"
                      detail="HBAR via WETHGateway, ERC-20 via approve + deposit"
                      color="border-supply/30"
                      highlight
                    />
                    <FlowArrow />
                    <FlowStep
                      icon={<TrendingUp className="w-4 h-4 text-points" />}
                      title="Earn Real Yield"
                      subtitle="Live APY from Bonzo reserves"
                      detail="AI agents monitor and manage your position"
                      color="border-points/30"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Position breakdown table — only when vault exists */}
            {vaultAddress && userDeposited > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card overflow-hidden mb-8"
              >
                <div className="px-5 py-4 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Position Breakdown
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Your active deposits in the YieldMindVault contract
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3">
                          Asset
                        </th>
                        <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3">
                          Deposited
                        </th>
                        <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3">
                          Share of TVL
                        </th>
                        <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3">
                          Contract
                        </th>
                        <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border-subtle hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img src="/hbar.webp" alt="HBAR" className="w-8 h-8 rounded-full" />
                            <div>
                              <div className="font-medium text-text-primary">
                                HBAR
                              </div>
                              <div className="text-[11px] text-text-muted">
                                Hedera
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="font-bold text-text-primary">
                            {userDeposited.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-text-muted">HBAR</div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-text-secondary">
                            {shareOfTvl}%
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <a
                            href={hashscanContractUrl(vaultAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent/80 transition-colors font-mono text-[11px]"
                          >
                            {vaultAddress.slice(0, 8)}...
                          </a>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-supply/10 text-supply text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-supply animate-pulse" />
                            Active
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Wallet & Contract details row */}
            <div className={`grid grid-cols-1 ${vaultAddress ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 mb-8`}>
              {/* Wallet card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-5"
              >
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
                  Wallet Details
                </h3>
                <div className="space-y-3">
                  <DetailRow label="Address">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-text-primary">
                        {wallet.address?.slice(0, 10)}...
                        {wallet.address?.slice(-8)}
                      </span>
                      <button
                        onClick={copyAddress}
                        className="p-1 rounded hover:bg-surface transition-colors"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-supply" />
                        ) : (
                          <Copy className="w-3 h-3 text-text-muted" />
                        )}
                      </button>
                    </div>
                  </DetailRow>
                  <DetailRow label="Network">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${isMainnet ? 'bg-supply' : 'bg-borrow'}`} />
                      <span className="text-sm text-text-primary">
                        {getNetworkConfig().chainName}
                      </span>
                    </div>
                  </DetailRow>
                  <DetailRow label="Chain ID">
                    <span className="text-sm text-text-primary">{getNetworkConfig().chainId}</span>
                  </DetailRow>
                  <div className="pt-2">
                    <a
                      href={hashscanAccountUrl(wallet.address!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on HashScan
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Contract card — only when vault exists (testnet) */}
              {vaultAddress && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass-card p-5"
                >
                  <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
                    Vault Contract
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Contract">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-text-primary">
                          {vaultAddress.slice(0, 10)}...{vaultAddress.slice(-8)}
                        </span>
                        <button
                          onClick={copyContractAddress}
                          className="p-1 rounded hover:bg-surface transition-colors"
                        >
                          {copiedContract ? (
                            <Check className="w-3 h-3 text-supply" />
                          ) : (
                            <Copy className="w-3 h-3 text-text-muted" />
                          )}
                        </button>
                      </div>
                    </DetailRow>
                    <DetailRow label="Type">
                      <span className="text-sm text-text-primary">
                        YieldMindVault
                      </span>
                    </DetailRow>
                    <DetailRow label="Security">
                      <span className="text-sm text-text-primary">
                        ReentrancyGuard + Ownable
                      </span>
                    </DetailRow>
                    <DetailRow label="Actions">
                      <span className="text-sm text-text-primary">
                        Deposit, Withdraw, Emergency Exit
                      </span>
                    </DetailRow>
                    <div className="pt-2">
                      <a
                        href={hashscanContractUrl(vaultAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Verify contract on HashScan
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Sentinel Agent card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-5"
              >
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
                  Sentinel Agent
                </h3>
                <div className="space-y-3">
                  <DetailRow label="Status">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${userDeposited > 0 ? 'bg-supply animate-pulse' : 'bg-text-muted'}`} />
                      <span className={`text-sm ${userDeposited > 0 ? 'text-supply' : 'text-text-muted'}`}>
                        {userDeposited > 0 ? 'Monitoring' : 'Idle'}
                      </span>
                    </div>
                  </DetailRow>
                  <DetailRow label="Watches">
                    <span className="text-sm text-text-primary">
                      Token prices & volatility
                    </span>
                  </DetailRow>
                  <DetailRow label="Alerts">
                    <span className="text-sm text-text-primary">
                      &gt;8% warning, &gt;15% critical
                    </span>
                  </DetailRow>
                  <DetailRow label="Action">
                    <span className="text-sm text-text-primary">
                      Emergency exit on critical
                    </span>
                  </DetailRow>
                  <div className="pt-2 text-[11px] text-text-muted">
                    The Sentinel agent monitors real-time token prices via CoinGecko.
                    If it detects &gt;15% price drops, it recommends emergency exits.
                    All alerts are logged to HCS for transparency. View alerts in the
                    Decision Trail on the main chat page.
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Agent Network — How Your Strategy Was Built */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="glass-card p-5 mb-8"
            >
              <div className="flex items-center gap-3 mb-5">
                <Image
                  src="/logo without text.png"
                  alt="YieldMind"
                  width={20}
                  height={20}
                  className="h-auto w-9 "
                />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Agent Network — How Your Strategy Was Built
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    4 specialized AI agents coordinate via Hedera Consensus Service
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AgentCard
                  iconSrc="/scout.png"
                  name="Scout"
                  color="text-supply"
                  role="Data Discovery"
                  description="Scans Bonzo Finance lending reserves in real-time. Fetches APY rates, TVL, and risk metrics from live mainnet data."
                />
                <AgentCard
                  iconSrc="/strategist.png"
                  name="Strategist"
                  color="text-accent"
                  role="Strategy Design"
                  description="Analyzes your risk tolerance and maps it to optimal Bonzo vault allocations using Claude AI reasoning."
                />
                <AgentCard
                  iconSrc="/execute.png"
                  name="Executor"
                  color="text-borrow"
                  role="On-Chain Execution"
                  description={isMainnet
                    ? "Handles deposits directly into Bonzo lending pools. Verifies transactions via Mirror Node and publishes proof to HCS."
                    : "Handles the deposit into YieldMindVault. Verifies transactions via Mirror Node and publishes proof to HCS."
                  }
                />
                <AgentCard
                  iconSrc="/sentinel.png"
                  name="Sentinel"
                  color="text-danger"
                  role="Position Monitoring"
                  description="Monitors token prices and market volatility 24/7. Triggers alerts and emergency exits when thresholds are breached."
                />
              </div>
            </motion.div>

            {/* On-chain transparency */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden">
                  <img src="/sentinel.png" alt="On-chain" className="w-5 h-5 object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    On-Chain Transparency
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Every AI decision is auditable on Hedera Consensus Service
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="px-4 py-3 rounded-[8px] bg-surface">
                  <div className="text-[11px] text-text-muted mb-1">
                    Deposit Proof
                  </div>
                  <div className="text-sm text-text-primary font-medium">
                    Verifiable on HashScan
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    {isMainnet
                      ? 'FROM: your wallet → TO: Bonzo LendingPool'
                      : 'FROM: your wallet → TO: YieldMindVault'}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-[8px] bg-surface">
                  <div className="text-[11px] text-text-muted mb-1">
                    Agent Decisions
                  </div>
                  <div className="text-sm text-text-primary font-medium">
                    Published to HCS Topic
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    Scout → Strategist → Executor → Sentinel
                  </div>
                </div>
                <div className="px-4 py-3 rounded-[8px] bg-surface">
                  <div className="flex items-center gap-2 mb-1">
                    <img src="/bonzo.webp" alt="Bonzo" className="w-4 h-4 rounded-full" />
                    <span className="text-[11px] text-text-muted">Bonzo Integration</span>
                  </div>
                  <div className="text-sm text-text-primary font-medium">
                    {isMainnet ? 'Live Mainnet Data + Direct Deposits' : 'Live Data (Testnet)'}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    APY rates & risk metrics from Bonzo Finance
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Withdraw Modal — only when vault exists */}
      <AnimatePresence>
        {showWithdrawModal && vaultAddress && (
          <WithdrawModal
            userDeposited={userDeposited}
            withdrawAmount={withdrawAmount}
            setWithdrawAmount={setWithdrawAmount}
            withdrawStatus={vault.withdrawStatus}
            withdrawError={withdrawError}
            withdrawTxHash={withdrawTxHash}
            onWithdraw={handleWithdraw}
            onEmergencyWithdraw={handleEmergencyWithdraw}
            onClose={closeWithdrawModal}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
        <Vault className="w-8 h-8 text-text-muted" />
      </div>
      <h2 className="text-lg font-bold text-text-primary mb-2">
        Connect Your Wallet
      </h2>
      <p className="text-sm text-text-muted text-center max-w-md mb-6">
        Connect your MetaMask wallet to view your positions, deposits, and
        strategy performance on the YieldMind protocol.
      </p>
      <ConnectWalletButton />
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subtext,
  delay,
  valueColor,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  subtext: string;
  delay: number;
  valueColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-full ${iconBg} p-2`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={`text-xl font-bold ${valueColor || 'text-text-primary'}`}>
        {value}
      </div>
      <div className="text-[11px] text-text-muted mt-1">{subtext}</div>
    </motion.div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-muted uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

function FlowStep({
  icon,
  title,
  subtitle,
  detail,
  color,
  highlight,
  dimmed,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
  highlight?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-[8px] border ${color} ${
        highlight ? 'bg-supply/5' : 'bg-surface'
      } ${dimmed ? 'opacity-60' : ''} px-4 py-3`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-text-primary">{title}</span>
        {dimmed && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-points/10 text-points font-medium">
            FUTURE
          </span>
        )}
      </div>
      <div className="text-[11px] font-mono text-text-muted">{subtitle}</div>
      <div className="text-[11px] text-text-secondary mt-1">{detail}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center lg:px-0 py-1 lg:py-0">
      <div className="hidden lg:block text-text-muted">→</div>
      <div className="lg:hidden text-text-muted">↓</div>
    </div>
  );
}

function AgentCard({
  iconSrc,
  name,
  color,
  role,
  description,
}: {
  iconSrc: string;
  name: string;
  color: string;
  role: string;
  description: string;
}) {
  return (
    <div className="px-4 py-3 rounded-[8px] bg-surface">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src={iconSrc} alt={name} className="w-5 h-5 object-contain" />
        </div>
        <div>
          <div className={`text-sm font-medium ${color}`}>{name}</div>
          <div className="text-[10px] text-text-muted">{role}</div>
        </div>
      </div>
      <p className="text-[11px] text-text-secondary leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function WithdrawModal({
  userDeposited,
  withdrawAmount,
  setWithdrawAmount,
  withdrawStatus,
  withdrawError,
  withdrawTxHash,
  onWithdraw,
  onEmergencyWithdraw,
  onClose,
}: {
  userDeposited: number;
  withdrawAmount: string;
  setWithdrawAmount: (v: string) => void;
  withdrawStatus: string;
  withdrawError: string | null;
  withdrawTxHash: string | null;
  onWithdraw: () => void;
  onEmergencyWithdraw: () => void;
  onClose: () => void;
}) {
  const isProcessing = withdrawStatus === 'signing' || withdrawStatus === 'confirming';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md bg-[#141726] border border-border-subtle rounded-[12px] shadow-2xl">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-base font-bold text-text-primary">
              Withdraw Funds
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Withdraw HBAR from the YieldMindVault contract
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Success state */}
            {withdrawTxHash ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-supply">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">Withdrawal Confirmed</span>
                </div>
                <a
                  href={hashscanTxUrl(withdrawTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View transaction on HashScan
                </a>
                <button
                  onClick={onClose}
                  className="w-full h-10 rounded-[8px] bg-surface border border-border-subtle text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Balance info */}
                <div className="px-4 py-3 rounded-[8px] bg-surface">
                  <div className="text-[11px] text-text-muted mb-1">
                    Available to Withdraw
                  </div>
                  <div className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <img src="/hbar.webp" alt="HBAR" className="w-5 h-5 rounded-full" />
                    {userDeposited.toFixed(2)} HBAR
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1.5">
                    Withdraw Amount (HBAR)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isProcessing}
                      className="flex-1 bg-surface border border-border-subtle rounded-[8px] px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={() => setWithdrawAmount(userDeposited.toString())}
                      disabled={isProcessing}
                      className="px-3 py-2 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-accent font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Processing state */}
                {isProcessing && (
                  <div className="flex items-center gap-2 py-2 px-3 rounded-[8px] bg-accent/10 text-sm text-accent">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {withdrawStatus === 'signing'
                      ? 'Waiting for MetaMask signature...'
                      : 'Confirming on Hedera...'}
                  </div>
                )}

                {/* Error */}
                {withdrawError && (
                  <div className="flex items-center gap-2 py-2 px-3 rounded-[8px] bg-danger/10 text-sm text-danger">
                    <AlertTriangle className="w-4 h-4" />
                    {withdrawError}
                  </div>
                )}

                {/* Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={onWithdraw}
                    disabled={isProcessing || !withdrawAmount}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    {isProcessing ? 'Processing...' : 'Withdraw'}
                  </button>

                  <button
                    onClick={onEmergencyWithdraw}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-danger/10 border border-danger/20 text-danger text-sm font-medium hover:bg-danger/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <LogOut className="w-4 h-4" />
                    Emergency Withdraw All
                  </button>
                </div>

                <p className="text-[10px] text-text-muted text-center">
                  Emergency withdraw returns ALL deposited HBAR across all strategies.
                  Regular withdraw lets you specify an amount.
                </p>

                {/* Cancel */}
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="w-full h-9 rounded-[8px] text-sm text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
