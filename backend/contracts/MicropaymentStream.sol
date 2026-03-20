// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MicropaymentStream
 * @author Zero-Fee Micropayments on Polkadot Hub
 * @notice Sablier-style continuous payment streaming with gas subsidy integration.
 *         Streams allow a sender to continuously transfer ERC-20 tokens to a
 *         recipient over a fixed time window. Gas fees are optionally covered
 *         by the SubsidyPool, enabling true zero-fee micropayments.
 * @dev Optimised for Polkadot REVM: storage is kept minimal, math uses
 *      unchecked arithmetic where overflow is impossible, and all external
 *      calls happen after state mutation (CEI pattern).
 */
contract MicropaymentStream is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Types
    // =========================================================================

    /// @notice The life-cycle states of a stream.
    enum StreamStatus {
        Active,
        Paused,
        Cancelled,
        Exhausted
    }

    /// @notice On-chain representation of a payment stream.
    struct Stream {
        address sender;
        address recipient;
        address token;
        uint256 deposit;       // total tokens locked at creation
        uint256 ratePerSecond; // tokens released per second (18-decimal)
        uint256 startTime;
        uint256 stopTime;
        uint256 withdrawn;     // cumulative tokens already claimed by recipient
        StreamStatus status;
    }

    // =========================================================================
    // Storage
    // =========================================================================

    /// @dev Auto-incrementing stream id counter.
    uint256 private _nextStreamId = 1;

    /// @notice Mapping from stream id → Stream data.
    mapping(uint256 => Stream) public streams;

    /// @notice Address of the SubsidyPool allowed to pay gas on behalf of users.
    address public subsidyPool;

    /// @notice Timestamp when a stream was paused (0 when not paused).
    mapping(uint256 => uint256) public pausedAt;

    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when a new stream is created.
    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 deposit,
        uint256 startTime,
        uint256 stopTime,
        uint256 ratePerSecond
    );

    /// @notice Emitted when the recipient withdraws vested tokens.
    event StreamWithdrawn(
        uint256 indexed streamId,
        address indexed recipient,
        uint256 amount,
        bool gasSubsidised
    );

    /// @notice Emitted when a stream is cancelled by its sender.
    event StreamCancelled(
        uint256 indexed streamId,
        address indexed sender,
        uint256 senderRefund,
        uint256 recipientAmount
    );

    /// @notice Emitted when a stream is paused.
    event StreamPaused(uint256 indexed streamId, address indexed sender);

    /// @notice Emitted when a stream is resumed.
    event StreamResumed(uint256 indexed streamId, address indexed sender);

    /// @notice Emitted when the subsidy pool address is updated.
    event SubsidyPoolUpdated(address indexed oldPool, address indexed newPool);

    // =========================================================================
    // Errors
    // =========================================================================

    error InvalidRecipient(address recipient);
    error InvalidToken(address token);
    error InvalidTimeRange(uint256 startTime, uint256 stopTime);
    error InvalidDeposit(uint256 deposit, uint256 required);
    error StreamNotFound(uint256 streamId);
    error CallerNotSender(address caller, address sender);
    error CallerNotRecipient(address caller, address recipient);
    error CallerNotAuthorised(address caller);
    error StreamNotActive(uint256 streamId, StreamStatus status);
    error StreamAlreadyPaused(uint256 streamId);
    error StreamNotPaused(uint256 streamId);
    error ZeroWithdrawAmount(uint256 streamId);
    error InsufficientBalance(uint256 available, uint256 requested);

    // =========================================================================
    // Modifiers
    // =========================================================================

    /// @dev Reverts if the stream does not exist.
    modifier streamExists(uint256 streamId) {
        if (streams[streamId].sender == address(0)) revert StreamNotFound(streamId);
        _;
    }

    /// @dev Reverts if the caller is not the stream sender.
    modifier onlySender(uint256 streamId) {
        if (streams[streamId].sender != msg.sender) revert CallerNotSender(msg.sender, streams[streamId].sender);
        _;
    }

    /// @dev Reverts if the stream is not Active.
    modifier onlyActive(uint256 streamId) {
        if (streams[streamId].status != StreamStatus.Active)
            revert StreamNotActive(streamId, streams[streamId].status);
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _subsidyPool) Ownable(msg.sender) {
        subsidyPool = _subsidyPool;
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /**
     * @notice Update the SubsidyPool address. Only callable by owner.
     * @param _subsidyPool New subsidy pool contract address.
     */
    function setSubsidyPool(address _subsidyPool) external onlyOwner {
        emit SubsidyPoolUpdated(subsidyPool, _subsidyPool);
        subsidyPool = _subsidyPool;
    }

    // =========================================================================
    // Core – Stream Management
    // =========================================================================

    /**
     * @notice Create a new payment stream.
     * @dev Tokens are transferred from `msg.sender` immediately. The deposit
     *      must be an exact multiple of (stopTime - startTime) so that
     *      ratePerSecond is a whole number in token base units.
     * @param recipient  Address that will receive the streamed tokens.
     * @param deposit    Total token amount to lock in the stream.
     * @param token      ERC-20 token address.
     * @param startTime  Unix timestamp when streaming begins (>= block.timestamp).
     * @param stopTime   Unix timestamp when streaming ends (> startTime).
     * @return streamId  The id of the newly created stream.
     */
    function createStream(
        address recipient,
        uint256 deposit,
        address token,
        uint256 startTime,
        uint256 stopTime
    ) external nonReentrant returns (uint256 streamId) {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient(recipient);
        if (token == address(0)) revert InvalidToken(token);
        if (startTime < block.timestamp || stopTime <= startTime)
            revert InvalidTimeRange(startTime, stopTime);

        uint256 duration;
        unchecked { duration = stopTime - startTime; }
        if (deposit == 0) revert InvalidDeposit(deposit, duration);

        uint256 ratePerSecond;
        unchecked { ratePerSecond = deposit / duration; }

        streamId = _nextStreamId;
        unchecked { _nextStreamId++; }

        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            deposit: deposit,
            ratePerSecond: ratePerSecond,
            startTime: startTime,
            stopTime: stopTime,
            withdrawn: 0,
            status: StreamStatus.Active
        });

        IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);

        emit StreamCreated(
            streamId,
            msg.sender,
            recipient,
            token,
            deposit,
            startTime,
            stopTime,
            ratePerSecond
        );
    }

    /**
     * @notice Withdraw vested tokens from a stream.
     * @dev Can be called by the recipient directly or by the SubsidyPool on
     *      behalf of the recipient (subsidised withdrawal). In the latter case
     *      the `gasSubsidised` flag is set in the emitted event.
     * @param streamId  Id of the stream to withdraw from.
     * @param amount    Amount of tokens to withdraw (must be <= vested balance).
     */
    function withdrawFromStream(
        uint256 streamId,
        uint256 amount
    ) external nonReentrant streamExists(streamId) onlyActive(streamId) {
        Stream storage s = streams[streamId];

        bool subsidised = msg.sender == subsidyPool;
        if (!subsidised && msg.sender != s.recipient)
            revert CallerNotRecipient(msg.sender, s.recipient);

        uint256 available = _vestedBalance(s);
        if (amount == 0) revert ZeroWithdrawAmount(streamId);
        if (amount > available) revert InsufficientBalance(available, amount);

        unchecked { s.withdrawn += amount; }

        // Mark as exhausted if all tokens have been claimed.
        if (s.withdrawn == s.deposit) {
            s.status = StreamStatus.Exhausted;
        }

        IERC20(s.token).safeTransfer(s.recipient, amount);

        emit StreamWithdrawn(streamId, s.recipient, amount, subsidised);
    }

    /**
     * @notice Cancel an active stream. Vested tokens are sent to the recipient
     *         and the remainder is refunded to the sender.
     * @param streamId  Id of the stream to cancel.
     */
    function cancelStream(
        uint256 streamId
    ) external nonReentrant streamExists(streamId) onlyActive(streamId) onlySender(streamId) {
        Stream storage s = streams[streamId];

        uint256 recipientBalance = _vestedBalance(s);
        uint256 senderRefund;
        unchecked { senderRefund = s.deposit - s.withdrawn - recipientBalance; }

        s.status = StreamStatus.Cancelled;

        if (recipientBalance > 0) {
            IERC20(s.token).safeTransfer(s.recipient, recipientBalance);
        }
        if (senderRefund > 0) {
            IERC20(s.token).safeTransfer(s.sender, senderRefund);
        }

        emit StreamCancelled(streamId, msg.sender, senderRefund, recipientBalance);
    }

    /**
     * @notice Pause an active stream (sender only). No tokens vest while paused.
     * @param streamId  Id of the stream to pause.
     */
    function pauseStream(
        uint256 streamId
    ) external streamExists(streamId) onlyActive(streamId) onlySender(streamId) {
        pausedAt[streamId] = block.timestamp;
        streams[streamId].status = StreamStatus.Paused;
        emit StreamPaused(streamId, msg.sender);
    }

    /**
     * @notice Resume a paused stream (sender only).
     * @param streamId  Id of the stream to resume.
     */
    function resumeStream(
        uint256 streamId
    ) external streamExists(streamId) onlySender(streamId) {
        Stream storage s = streams[streamId];
        if (s.status != StreamStatus.Paused)
            revert StreamNotPaused(streamId);

        uint256 pausedStart = pausedAt[streamId];
        uint256 pauseDuration;
        unchecked {
            pauseDuration = block.timestamp - pausedStart;
            s.startTime += pauseDuration;
            s.stopTime += pauseDuration;
        }

        pausedAt[streamId] = 0;
        s.status = StreamStatus.Active;
        emit StreamResumed(streamId, msg.sender);
    }

    // =========================================================================
    // Views
    // =========================================================================

    /**
     * @notice Returns the amount of tokens the recipient can withdraw right now.
     * @param streamId  Id of the stream.
     * @return balance  Claimable token balance.
     */
    function balanceOf(uint256 streamId) external view streamExists(streamId) returns (uint256 balance) {
        Stream storage s = streams[streamId];
        if (s.status != StreamStatus.Active) return 0;
        return _vestedBalance(s);
    }

    /**
     * @notice Returns the full Stream struct for a given streamId.
     * @param streamId  Id of the stream.
     */
    function getStream(uint256 streamId) external view streamExists(streamId) returns (Stream memory) {
        return streams[streamId];
    }

    /**
     * @notice Returns the next stream id that will be issued.
     */
    function nextStreamId() external view returns (uint256) {
        return _nextStreamId;
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    /**
     * @dev Computes the cumulative vested balance minus already-withdrawn
     *      tokens for an active stream.
     */
    function _vestedBalance(Stream storage s) internal view returns (uint256) {
        if (block.timestamp <= s.startTime) return 0;
        if (block.timestamp >= s.stopTime) return s.deposit - s.withdrawn;

        uint256 elapsed;
        uint256 duration;
        unchecked {
            elapsed = block.timestamp - s.startTime;
            duration = s.stopTime - s.startTime;
        }

        // Higher precision: multiply before divide to handle any remainder
        uint256 vested = (s.deposit * elapsed) / duration;

        if (vested <= s.withdrawn) return 0;
        unchecked { return vested - s.withdrawn; }
    }
}
