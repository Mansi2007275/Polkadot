// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal interface for the MicropaymentStream contract.
interface IMicropaymentStream {
    function withdrawFromStream(uint256 streamId, uint256 amount) external;
    function balanceOf(uint256 streamId) external view returns (uint256);
}

/**
 * @title SubsidyPool
 * @author Zero-Fee Micropayments on Polkadot Hub
 * @notice Aggregates yield from protocol revenue, ad-slot fees, and (simulated)
 *         DOT staking rewards to cover the gas costs of stream withdrawals.
 *
 *         Flow:
 *         1. Participants deposit stablecoins (e.g. USDT) and/or DOT-equivalent
 *            tokens to earn a share of the subsidy pool.
 *         2. Advertisers pay DOT-denominated slot fees, which are converted to
 *            protocol revenue and routed here.
 *         3. The pool tracks accrued yield per depositor using a share-based
 *            accounting model (like Compound's cToken pattern).
 *         4. When a recipient wants a gas-free withdrawal, any authorised
 *            relayer calls `subsidisedWithdraw`; the pool pays the gas.
 *
 * @dev Gas optimised for Polkadot REVM. No SafeMath needed above Solidity 0.8.
 */
contract SubsidyPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Fallback annual yield rate in basis points (100 = 1%) when no live staking data.
    uint256 public constant BASE_YIELD_BPS = 500; // 5% APY fallback
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // =========================================================================
    // Types
    // =========================================================================

    struct Depositor {
        uint256 amount;           // tokens deposited
        uint256 shares;           // pool shares
        uint256 rewardDebt;       // used for reward accounting (MasterChef-style)
        uint256 depositTimestamp;
    }

    // =========================================================================
    // Storage
    // =========================================================================

    /// @notice The yield-bearing base token (e.g. USDT or a DOT-wrapper).
    IERC20 public immutable baseToken;

    /// @notice Address of the MicropaymentStream contract.
    address public streamContract;

    /// @notice Total base-token deposits in the pool.
    uint256 public totalDeposited;

    /// @notice Total shares outstanding.
    uint256 public totalShares;

    /// @notice Accumulated yield per share (scaled by 1e18).
    uint256 public accYieldPerShare;

    /// @notice Last timestamp when `accYieldPerShare` was updated.
    uint256 public lastYieldUpdate;

    /// @notice Depositor data keyed by address.
    mapping(address => Depositor) public depositors;

    /// @notice Authorised relayers that can trigger subsidised withdrawals.
    mapping(address => bool) public authorisedRelayers;

    /// @notice Running count of subsidised transactions.
    uint256 public totalSubsidisedTxns;

    /// @notice Total gas cost covered by the pool (in native token wei equiv.).
    uint256 public totalGasCovered;

    /// @notice Address of the StablecoinBridge that sweeps staking yield.
    address public bridgeContract;

    /// @notice Real yield swept from staking precompile (cumulative).
    uint256 public realYieldReceived;

    /// @notice Dynamic APY in basis points, updated on each yield sweep.
    uint256 public dynamicApyBps;

    // =========================================================================
    // Events
    // =========================================================================

    event Deposited(address indexed depositor, uint256 amount, uint256 shares);
    event Withdrawn(address indexed depositor, uint256 amount, uint256 shares);
    event YieldClaimed(address indexed depositor, uint256 yieldAmount);
    event SubsidisedWithdrawal(
        uint256 indexed streamId,
        address indexed relayer,
        uint256 amount,
        uint256 gasUsed,
        uint256 reimbursement
    );
    event AdRevenueReceived(address indexed payer, uint256 amount);
    event RelayerUpdated(address indexed relayer, bool authorised);
    event StreamContractUpdated(address indexed oldContract, address indexed newContract);
    event YieldAccrued(uint256 newAccYieldPerShare, uint256 timestamp);
    event RealYieldReceived(address indexed from, uint256 amount, uint256 newDynamicApy);
    event BridgeContractUpdated(address indexed oldBridge, address indexed newBridge);

    // =========================================================================
    // Errors
    // =========================================================================

    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares(uint256 have, uint256 requested);
    error InsufficientPoolBalance(uint256 have, uint256 requested);
    error NotAuthorised(address caller);
    error InvalidAddress(address addr);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _baseToken       The ERC-20 token used for deposits and yield.
     * @param _streamContract  Address of the deployed MicropaymentStream.
     */
    constructor(address _baseToken, address _streamContract) Ownable(msg.sender) {
        if (_baseToken == address(0)) revert InvalidAddress(_baseToken);
        baseToken = IERC20(_baseToken);
        streamContract = _streamContract;
        lastYieldUpdate = block.timestamp;
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /**
     * @notice Set or revoke an authorised relayer.
     * @param relayer    Address of the relayer.
     * @param authorised True to authorise, false to revoke.
     */
    function setRelayer(address relayer, bool authorised) external onlyOwner {
        if (relayer == address(0)) revert InvalidAddress(relayer);
        authorisedRelayers[relayer] = authorised;
        emit RelayerUpdated(relayer, authorised);
    }

    /**
     * @notice Update the stream contract address.
     * @param _streamContract New address.
     */
    function setStreamContract(address _streamContract) external onlyOwner {
        if (_streamContract == address(0)) revert InvalidAddress(_streamContract);
        emit StreamContractUpdated(streamContract, _streamContract);
        streamContract = _streamContract;
    }

    /**
     * @notice Set the bridge contract that can sweep yield.
     * @param _bridgeContract Address of StablecoinBridge.
     */
    function setBridgeContract(address _bridgeContract) external onlyOwner {
        if (_bridgeContract == address(0)) revert InvalidAddress(_bridgeContract);
        emit BridgeContractUpdated(bridgeContract, _bridgeContract);
        bridgeContract = _bridgeContract;
    }

    // =========================================================================
    // Deposit / Withdraw
    // =========================================================================

    /**
     * @notice Deposit base tokens into the subsidy pool.
     * @param amount  Amount of baseToken to deposit.
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _updateYield();

        Depositor storage dep = depositors[msg.sender];

        // Harvest pending yield before changing share balance.
        if (dep.shares > 0) {
            uint256 pending = _pendingYield(dep);
            if (pending > 0) {
                _safeYieldTransfer(msg.sender, pending);
                emit YieldClaimed(msg.sender, pending);
            }
        }

        baseToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 newShares;
        if (totalShares == 0 || totalDeposited == 0) {
            newShares = amount;
        } else {
            newShares = (amount * totalShares) / totalDeposited;
        }

        if (newShares == 0) revert ZeroShares();

        dep.amount += amount;
        dep.shares += newShares;
        dep.depositTimestamp = block.timestamp;
        dep.rewardDebt = (dep.shares * accYieldPerShare) / 1e18;

        totalShares += newShares;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, newShares);
    }

    /**
     * @notice Withdraw base tokens from the subsidy pool.
     * @param shares  Number of pool shares to redeem.
     */
    function withdraw(uint256 shares) external nonReentrant {
        if (shares == 0) revert ZeroShares();

        Depositor storage dep = depositors[msg.sender];
        if (dep.shares < shares) revert InsufficientShares(dep.shares, shares);

        _updateYield();

        // Harvest pending yield.
        uint256 pending = _pendingYield(dep);
        if (pending > 0) {
            _safeYieldTransfer(msg.sender, pending);
            emit YieldClaimed(msg.sender, pending);
        }

        uint256 amountOut = (shares * totalDeposited) / totalShares;
        // Cap amountOut at actual contract balance to absorb virtual-yield rounding drift.
        uint256 available = baseToken.balanceOf(address(this));
        if (amountOut > available) amountOut = available;

        dep.shares -= shares;
        dep.amount = dep.shares == 0 ? 0 : (dep.amount * dep.shares) / (dep.shares + shares);
        dep.rewardDebt = (dep.shares * accYieldPerShare) / 1e18;

        totalShares -= shares;
        totalDeposited -= amountOut;

        baseToken.safeTransfer(msg.sender, amountOut);

        emit Withdrawn(msg.sender, amountOut, shares);
    }

    /**
     * @notice Claim pending yield without withdrawing principal.
     */
    function claimYield() external nonReentrant {
        _updateYield();
        Depositor storage dep = depositors[msg.sender];
        uint256 pending = _pendingYield(dep);
        if (pending == 0) revert ZeroAmount();

        dep.rewardDebt = (dep.shares * accYieldPerShare) / 1e18;
        _safeYieldTransfer(msg.sender, pending);
        emit YieldClaimed(msg.sender, pending);
    }

    // =========================================================================
    // Subsidy Operations
    // =========================================================================

    /**
     * @notice Execute a subsidised withdrawal from a MicropaymentStream on
     *         behalf of the recipient. The pool covers the transaction gas.
     * @dev Only callable by an authorised relayer. This contract must be set as
     *      the `subsidyPool` on the MicropaymentStream contract.
     * @param streamId  Id of the stream to withdraw from.
     * @param amount    Amount to withdraw.
     */
    function subsidisedWithdraw(
        uint256 streamId,
        uint256 amount
    ) external nonReentrant {
        if (!authorisedRelayers[msg.sender] && msg.sender != owner())
            revert NotAuthorised(msg.sender);

        uint256 gasBefore = gasleft();

        IMicropaymentStream(streamContract).withdrawFromStream(streamId, amount);

        uint256 gasUsed = gasBefore - gasleft();
        uint256 reimbursement = gasUsed * tx.gasprice;

        // Reimburse relayer in native tokens (DOT) if pool has enough balance.
        // This directly utilizes staking rewards to fund the relayer network.
        if (address(this).balance >= reimbursement) {
            (bool success, ) = payable(msg.sender).call{value: reimbursement}("");
            // We don't revert if reimbursement fails to ensure stream integrity,
            // but the relayer can check the event.
        }

        unchecked {
            totalSubsidisedTxns++;
            totalGasCovered += gasUsed;
        }

        emit SubsidisedWithdrawal(streamId, msg.sender, amount, gasUsed, reimbursement);
    }

    /**
     * @notice Accept ad revenue contributions (anyone can send yield to the pool).
     * @param amount  Amount of baseToken to add as yield to depositors.
     */
    function receiveAdRevenue(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        baseToken.safeTransferFrom(msg.sender, address(this), amount);

        if (totalShares > 0) {
            accYieldPerShare += (amount * 1e18) / totalShares;
        }

        emit AdRevenueReceived(msg.sender, amount);
    }

    /**
     * @notice Receive real staking yield swept from the StablecoinBridge.
     * @dev    Called by the bridge after calling syncRealTimeYield().
     *         Distributes the yield to all depositors via share accounting
     *         and updates the dynamic APY estimate.
     * @param amount Amount of baseToken swept as yield.
     */
    function receiveYieldSweep(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        baseToken.safeTransferFrom(msg.sender, address(this), amount);
        _accountRealYield(amount);
    }

    /**
     * @dev Internal logic to distribute swept yield and update metrics.
     */
    function _accountRealYield(uint256 amount) internal {
        unchecked {
            realYieldReceived += amount;
        }

        if (totalShares > 0) {
            accYieldPerShare += (amount * 1e18) / totalShares;
        }

        if (totalDeposited > 0) {
            // Simplified APY calculation based on current sweep.
            dynamicApyBps = (amount * BPS_DENOMINATOR * SECONDS_PER_YEAR) /
                (totalDeposited * (block.timestamp - lastYieldUpdate + 1));
        }

        lastYieldUpdate = block.timestamp;
        emit RealYieldReceived(msg.sender, amount, dynamicApyBps);
    }

    /// @notice Accept native DOT for gas subsidy operations. 
    /// @dev Native DOT is used to reimburse relayers for gas costs, 
    ///      closing the loop on staking rewards usage.
    receive() external payable {
        // Only log arrival, don't account as USDT yield to avoid logic bugs.
    }

    // =========================================================================
    // Views
    // =========================================================================

    /**
     * @notice Returns the pending yield for a depositor.
     * @param depositor  Address of the depositor.
     * @return pending   Claimable yield amount.
     */
    function pendingYield(address depositor) external view returns (uint256 pending) {
        Depositor storage dep = depositors[depositor];
        if (dep.shares == 0) return 0;

        // Simulate what _updateYield() would compute.
        uint256 simAccYPS = accYieldPerShare;
        if (totalShares > 0 && block.timestamp > lastYieldUpdate) {
            uint256 elapsed = block.timestamp - lastYieldUpdate;
            uint256 yieldAmount = (totalDeposited * BASE_YIELD_BPS * elapsed) /
                (BPS_DENOMINATOR * SECONDS_PER_YEAR);
            simAccYPS += (yieldAmount * 1e18) / totalShares;
        }

        return (dep.shares * simAccYPS) / 1e18 - dep.rewardDebt;
    }

    /**
     * @notice Returns the total token balance held by the pool.
     */
    function poolBalance() external view returns (uint256) {
        return baseToken.balanceOf(address(this));
    }

    /**
     * @notice Returns depositor share percentage (basis points, 10000 = 100%).
     */
    function depositorShareBps(address depositor) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (depositors[depositor].shares * BPS_DENOMINATOR) / totalShares;
    }

    /**
     * @notice Returns the effective APY: dynamic from staking if available, else fallback.
     */
    function currentApyBps() external view returns (uint256) {
        return dynamicApyBps > 0 ? dynamicApyBps : BASE_YIELD_BPS;
    }

    /**
     * @notice Returns the total real yield received from staking.
     */
    function totalRealYield() external view returns (uint256) {
        return realYieldReceived;
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /**
     * @dev Accrue time-based yield (simulates staking/ad revenue returns).
     */
    function _updateYield() internal {
        if (block.timestamp <= lastYieldUpdate || totalShares == 0) {
            lastYieldUpdate = block.timestamp;
            return;
        }

        uint256 elapsed;
        unchecked { elapsed = block.timestamp - lastYieldUpdate; }

        uint256 yieldAmount = (totalDeposited * BASE_YIELD_BPS * elapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);

        if (yieldAmount > 0) {
            accYieldPerShare += (yieldAmount * 1e18) / totalShares;
            emit YieldAccrued(accYieldPerShare, block.timestamp);
        }

        lastYieldUpdate = block.timestamp;
    }

    /**
     * @dev Compute pending yield for a depositor given current accYieldPerShare.
     */
    function _pendingYield(Depositor storage dep) internal view returns (uint256) {
        return (dep.shares * accYieldPerShare) / 1e18 - dep.rewardDebt;
    }

    /**
     * @dev Transfer yield, capped at available pool balance to prevent revert.
     */
    function _safeYieldTransfer(address to, uint256 amount) internal {
        uint256 bal = baseToken.balanceOf(address(this));
        uint256 transfer = amount > bal ? bal : amount;
        if (transfer > 0) baseToken.safeTransfer(to, transfer);
    }
}
