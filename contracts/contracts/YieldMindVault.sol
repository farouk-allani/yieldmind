// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title YieldMindVault
 * @notice Accepts HBAR deposits per strategy, tracks balances per user.
 *         Every deposit is tied to a strategyId (bytes32 hash of strategy name)
 *         so the AI agents can coordinate which vault/strategy the funds belong to.
 *
 * @dev Deployed on Hedera Testnet via JSON-RPC relay (hashio.io).
 *      Uses evmVersion "paris" for Hedera EVM compatibility.
 */
contract YieldMindVault is Ownable, ReentrancyGuard {
    // ── Events ──────────────────────────────────────────────────────────
    event Deposited(
        address indexed user,
        bytes32 indexed strategyId,
        uint256 amount,
        string vaultName
    );

    event Withdrawn(
        address indexed user,
        bytes32 indexed strategyId,
        uint256 amount
    );

    event EmergencyWithdrawn(
        address indexed user,
        uint256 amount
    );

    // ── State ───────────────────────────────────────────────────────────

    /// @notice Per-user, per-strategy deposit balance
    mapping(address => mapping(bytes32 => uint256)) private _deposits;

    /// @notice Total deposited by each user across all strategies
    mapping(address => uint256) public userTotals;

    /// @notice Total value locked in the contract
    uint256 public totalValueLocked;

    // ── Constructor ─────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Deposit ─────────────────────────────────────────────────────────

    /**
     * @notice Deposit HBAR into a specific strategy.
     * @param strategyId  Keccak256 hash identifying the strategy
     * @param vaultName   Human-readable vault/strategy name (for event logs)
     */
    function deposit(
        bytes32 strategyId,
        string calldata vaultName
    ) external payable nonReentrant {
        require(msg.value > 0, "Deposit must be > 0");

        _deposits[msg.sender][strategyId] += msg.value;
        userTotals[msg.sender] += msg.value;
        totalValueLocked += msg.value;

        emit Deposited(msg.sender, strategyId, msg.value, vaultName);
    }

    // ── Withdraw ────────────────────────────────────────────────────────

    /**
     * @notice Withdraw HBAR from a specific strategy.
     * @param strategyId  The strategy to withdraw from
     * @param amount      Amount in wei (tinybars) to withdraw
     */
    function withdraw(
        bytes32 strategyId,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(
            _deposits[msg.sender][strategyId] >= amount,
            "Insufficient strategy balance"
        );

        _deposits[msg.sender][strategyId] -= amount;
        userTotals[msg.sender] -= amount;
        totalValueLocked -= amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "HBAR transfer failed");

        emit Withdrawn(msg.sender, strategyId, amount);
    }

    // ── Emergency Withdraw ──────────────────────────────────────────────

    /**
     * @notice Withdraw ALL funds across all strategies. Use in emergencies.
     *         Resets userTotals but individual strategy mappings remain stale
     *         (acceptable trade-off to avoid unbounded iteration).
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 total = userTotals[msg.sender];
        require(total > 0, "No funds to withdraw");

        userTotals[msg.sender] = 0;
        totalValueLocked -= total;

        (bool sent, ) = payable(msg.sender).call{value: total}("");
        require(sent, "HBAR transfer failed");

        emit EmergencyWithdrawn(msg.sender, total);
    }

    // ── View Functions ──────────────────────────────────────────────────

    /**
     * @notice Get a user's deposit for a specific strategy.
     * @param strategyId  The strategy to query
     * @param user        The user address
     * @return The deposited amount in wei (tinybars)
     */
    function getDeposit(
        bytes32 strategyId,
        address user
    ) external view returns (uint256) {
        return _deposits[user][strategyId];
    }

    // ── Admin ───────────────────────────────────────────────────────────

    /**
     * @notice Owner-only: recover accidentally sent tokens or stuck funds.
     * @param to     Recipient address
     * @param amount Amount to send
     */
    function rescueFunds(
        address payable to,
        uint256 amount
    ) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient contract balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Rescue transfer failed");
    }

    /// @notice Allow contract to receive HBAR directly (fallback)
    receive() external payable {}
}
