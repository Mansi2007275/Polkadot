// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// =============================================================================
// Polkadot Hub XCM Precompile Interfaces
// Addresses are fixed on Polkadot Hub (Paseo testnet):
//   XCM:           0x0000000000000000000000000000000000000800
//   Staking:       0x0000000000000000000000000000000000000801
//   Assets:        0x0000000000000000000000000000000000000802
//   Author Mapping:0x0000000000000000000000000000000000000807
// =============================================================================

/**
 * @title IXcmPrecompile
 * @notice Interface for the Polkadot Hub XCM precompile (0x800).
 *         Allows EVM contracts to send XCM messages to other parachains.
 */
interface IXcmPrecompile {
    /**
     * @notice Send XCM to transfer assets between parachains.
     * @param dest         SCALE-encoded multilocation of the destination.
     * @param beneficiary  SCALE-encoded multilocation of the recipient on dest.
     * @param assets       SCALE-encoded VersionedMultiAssets to transfer.
     * @param feeAssetItem Index of the asset inside `assets` used to pay XCM fees.
     * @param weightLimit  Optional weight limit (0 = unlimited).
     */
    function xcmSend(
        bytes memory dest,
        bytes memory beneficiary,
        bytes memory assets,
        uint32 feeAssetItem,
        uint64 weightLimit
    ) external returns (bool success);

    /**
     * @notice Execute a local XCM message.
     * @param message SCALE-encoded VersionedXcm.
     * @param maxWeight Maximum weight the message may consume.
     */
    function xcmExecute(
        bytes memory message,
        uint64 maxWeight
    ) external returns (bool success);
}

/**
 * @title IStakingPrecompile
 * @notice Interface for the Polkadot Hub staking precompile (0x801).
 */
interface IStakingPrecompile {
    /// @notice Bond tokens for staking.
    function bond(uint256 value, address payable controller) external returns (bool);
    /// @notice Unbond tokens from staking.
    function unbond(uint256 value) external returns (bool);
    /// @notice Withdraw unbonded tokens after the unbonding period.
    function withdrawUnbonded(uint32 numSlashingSpans) external returns (bool);
    /// @notice Nominate a set of validators.
    function nominate(address[] calldata targets) external returns (bool);
}

/**
 * @title IAssetsPrecompile
 * @notice Interface for the Polkadot Hub Assets pallet precompile (0x802).
 *         Provides ERC-20-like access to Substrate assets.
 */
interface IAssetsPrecompile {
    function totalSupply(uint128 assetId) external view returns (uint256);
    function balanceOf(uint128 assetId, address who) external view returns (uint256);
    function allowance(uint128 assetId, address owner, address spender) external view returns (uint256);
    function approve(uint128 assetId, address spender, uint256 value) external returns (bool);
    function transfer(uint128 assetId, address to, uint256 value) external returns (bool);
    function transferFrom(uint128 assetId, address from, address to, uint256 value) external returns (bool);
    function mint(uint128 assetId, address beneficiary, uint256 amount) external returns (bool);
    function burn(uint128 assetId, address who, uint256 amount) external returns (bool);
}

/**
 * @title StablecoinBridge
 * @author Zero-Fee Micropayments on Polkadot Hub
 * @notice Bridges stablecoins (USDT, USDC) between Polkadot Hub and other
 *         parachains (e.g. Acala, Hydration) using XCM precompiles.
 *
 *         Supported operations:
 *         1. `bridgeToParachain` – lock ERC-20 on Hub, send XCM to mint on para.
 *         2. `bridgeFromParachain` – receive XCM notification, release ERC-20.
 *         3. `stakeDotForYield` – stake DOT via staking precompile to generate
 *            yield that flows into the SubsidyPool.
 *         4. `withdrawStakingYield` – claim staking rewards into SubsidyPool.
 *
 * @dev    All XCM multilocation bytes are SCALE-encoded off-chain and passed in.
 *         For the hackathon demo the encodeXXX() helper functions output example
 *         valid SCALE encodings for the Paseo test environment.
 */
contract StablecoinBridge is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Precompile addresses (Polkadot Hub / Paseo)
    // =========================================================================

    IXcmPrecompile public constant XCM_PRECOMPILE =
        IXcmPrecompile(0x0000000000000000000000000000000000000800);

    IStakingPrecompile public constant STAKING_PRECOMPILE =
        IStakingPrecompile(0x0000000000000000000000000000000000000801);

    IAssetsPrecompile public constant ASSETS_PRECOMPILE =
        IAssetsPrecompile(0x0000000000000000000000000000000000000802);

    // =========================================================================
    // Supported asset IDs (Polkadot Hub Asset Pallet)
    // =========================================================================

    /// @notice Polkadot Hub asset id for USDT bridged from Statemint / AssetHub.
    uint128 public constant USDT_ASSET_ID = 1984;
    /// @notice Polkadot Hub asset id for USDC.
    uint128 public constant USDC_ASSET_ID = 1337;

    // =========================================================================
    // Storage
    // =========================================================================

    /// @notice ERC-20 wrapper token for USDT on Hub (if deployed).
    IERC20 public usdtToken;

    /// @notice ERC-20 wrapper token for USDC on Hub (if deployed).
    IERC20 public usdcToken;

    /// @notice Address of the SubsidyPool that receives staking yield.
    address public subsidyPool;

    /// @notice Running total of tokens bridged out.
    mapping(address => uint256) public totalBridgedOut;

    /// @notice Running total of tokens bridged in.
    mapping(address => uint256) public totalBridgedIn;

    /// @notice Authorised XCM message senders (relay chain sovereign accounts).
    mapping(address => bool) public trustedOrigins;

    // =========================================================================
    // Events
    // =========================================================================

    event BridgeOutInitiated(
        address indexed token,
        address indexed sender,
        uint32 destParaId,
        bytes32 indexed beneficiary,
        uint256 amount
    );
    event BridgeInCompleted(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint32 sourceParaId
    );
    event DotStaked(uint256 amount, address indexed controller);
    event DotUnstaked(uint256 amount);
    event StakingYieldWithdrawn(uint256 amount, address indexed subsidyPool);
    event TrustedOriginUpdated(address indexed origin, bool trusted);

    // =========================================================================
    // Errors
    // =========================================================================

    error UnsupportedToken(address token);
    error ZeroAmount();
    error XcmFailed();
    error StakingFailed();
    error InvalidOrigin(address origin);
    error InvalidAddress(address addr);
    error AlreadyBridged(bytes32 nonce);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _usdtToken    ERC-20 wrapper for USDT (address(0) to use pallet directly).
     * @param _usdcToken    ERC-20 wrapper for USDC.
     * @param _subsidyPool  Address of the SubsidyPool.
     */
    constructor(
        address _usdtToken,
        address _usdcToken,
        address _subsidyPool
    ) Ownable(msg.sender) {
        usdtToken = IERC20(_usdtToken);
        usdcToken = IERC20(_usdcToken);
        subsidyPool = _subsidyPool;
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /// @notice Add or remove a trusted XCM origin.
    function setTrustedOrigin(address origin, bool trusted) external onlyOwner {
        if (origin == address(0)) revert InvalidAddress(origin);
        trustedOrigins[origin] = trusted;
        emit TrustedOriginUpdated(origin, trusted);
    }

    /// @notice Update the subsidy pool address.
    function setSubsidyPool(address _subsidyPool) external onlyOwner {
        if (_subsidyPool == address(0)) revert InvalidAddress(_subsidyPool);
        subsidyPool = _subsidyPool;
    }

    // =========================================================================
    // Bridge Out (Hub → Parachain)
    // =========================================================================

    /**
     * @notice Bridge ERC-20 stablecoins from Polkadot Hub to a parachain.
     * @dev Locks `amount` of `token` in this contract and dispatches an XCM
     *      `ReserveTransferAssets` message to `destParaId`.
     *
     * Example XCM multilocation for Acala (paraId 2000):
     *   dest:        { parents: 1, interior: { X1: [Parachain(2000)] } }
     *   beneficiary: { parents: 0, interior: { X1: [AccountId32{id: recipientBytes}] } }
     *
     * @param token        ERC-20 token address on Hub.
     * @param amount       Amount of tokens to bridge.
     * @param destParaId   Parachain ID of the destination.
     * @param beneficiary  32-byte account id on the destination chain.
     */
    function bridgeToParachain(
        address token,
        uint256 amount,
        uint32 destParaId,
        bytes32 beneficiary
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (token != address(usdtToken) && token != address(usdcToken))
            revert UnsupportedToken(token);

        // Lock tokens.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalBridgedOut[token] += amount;

        // Build SCALE-encoded XCM multilocation bytes.
        bytes memory dest = _encodeParachainDest(destParaId);
        bytes memory beneficiaryEncoded = _encodeAccountId32Beneficiary(beneficiary);
        bytes memory assets = _encodeErc20Asset(token, amount);

        bool ok = XCM_PRECOMPILE.xcmSend(dest, beneficiaryEncoded, assets, 0, 0);
        if (!ok) revert XcmFailed();

        emit BridgeOutInitiated(token, msg.sender, destParaId, beneficiary, amount);
    }

    /**
     * @notice Bridge using the Substrate Assets pallet directly (no ERC-20 wrapper).
     * @dev Useful when the stablecoin lives purely as a Substrate asset (e.g. USDT
     *      with assetId 1984 on AssetHub). Uses the Assets precompile instead of
     *      safeTransferFrom.
     * @param assetId    Substrate asset id.
     * @param amount     Amount in the asset's smallest unit.
     * @param destParaId Destination parachain id.
     * @param beneficiary 32-byte destination account.
     */
    function bridgeAssetToParachain(
        uint128 assetId,
        uint256 amount,
        uint32 destParaId,
        bytes32 beneficiary
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (assetId != USDT_ASSET_ID && assetId != USDC_ASSET_ID)
            revert UnsupportedToken(address(0));

        // Transfer Substrate asset to this contract via asset precompile.
        bool ok = ASSETS_PRECOMPILE.transferFrom(assetId, msg.sender, address(this), amount);
        if (!ok) revert XcmFailed();

        bytes memory dest = _encodeParachainDest(destParaId);
        bytes memory beneficiaryEncoded = _encodeAccountId32Beneficiary(beneficiary);
        bytes memory assets = _encodeSubstrateAsset(assetId, amount);

        ok = XCM_PRECOMPILE.xcmSend(dest, beneficiaryEncoded, assets, 0, 0);
        if (!ok) revert XcmFailed();

        emit BridgeOutInitiated(address(0), msg.sender, destParaId, beneficiary, amount);
    }

    // =========================================================================
    // Bridge In (Parachain → Hub) – called via XCM Transact
    // =========================================================================

    /**
     * @notice Release tokens to a recipient after an inbound XCM message.
     * @dev Must be called via XCM Transact from a trusted origin (the sovereign
     *      account of the source parachain). On Paseo this is mocked by an
     *      authorised trusted origin address.
     * @param token       ERC-20 token to release.
     * @param recipient   Hub address to release tokens to.
     * @param amount      Amount to release.
     * @param sourceParaId Source parachain id (for bookkeeping).
     */
    function bridgeIn(
        address token,
        address recipient,
        uint256 amount,
        uint32 sourceParaId
    ) external nonReentrant {
        if (!trustedOrigins[msg.sender]) revert InvalidOrigin(msg.sender);
        if (amount == 0) revert ZeroAmount();

        totalBridgedIn[token] += amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit BridgeInCompleted(token, recipient, amount, sourceParaId);
    }

    // =========================================================================
    // DOT Staking for Yield
    // =========================================================================

    /**
     * @notice Stake DOT via the staking precompile to generate yield.
     * @dev The yield accrues to this contract and is periodically forwarded to
     *      the SubsidyPool via `withdrawStakingYield`.
     * @param amount     Amount of DOT (in wei-equivalent) to stake.
     * @param controller Controller account address.
     */
    function stakeDotForYield(uint256 amount, address payable controller) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        bool ok = STAKING_PRECOMPILE.bond(amount, controller);
        if (!ok) revert StakingFailed();
        emit DotStaked(amount, controller);
    }

    /**
     * @notice Begin unbonding DOT from the staking pallet.
     * @param amount Amount to unbond.
     */
    function unstakeDot(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        bool ok = STAKING_PRECOMPILE.unbond(amount);
        if (!ok) revert StakingFailed();
        emit DotUnstaked(amount);
    }

    /**
     * @notice Forward any accumulated stablecoin yield to the SubsidyPool.
     * @dev In a production deployment, a Substrate off-chain worker would
     *      periodically call this after claiming staking rewards.
     * @param token  ERC-20 token address representing accumulated yield.
     * @param amount Amount to forward.
     */
    function withdrawStakingYield(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (subsidyPool == address(0)) revert InvalidAddress(subsidyPool);

        IERC20(token).safeTransfer(subsidyPool, amount);
        emit StakingYieldWithdrawn(amount, subsidyPool);
    }

    // =========================================================================
    // XCM Encoding Helpers
    // =========================================================================

    /**
     * @dev SCALE-encodes a parachain multilocation (V3 format).
     *      Encoding: 03 (V3 enum variant) + 01 (parents=1) + 01 (interior len=1)
     *                + 00 (Parachain junction type) + ULEB-128(paraId)
     *
     *      This is a simplified encoding for demonstration. In production, use
     *      a proper SCALE codec library or off-chain encoding passed as calldata.
     */
    function _encodeParachainDest(uint32 paraId) internal pure returns (bytes memory) {
        // VersionedMultiLocation::V3 { parents: 1, interior: X1(Parachain(paraId)) }
        // SCALE: 0x03  (V3 variant index 3)
        //        0x01  (parents = 1)
        //        0x01  (X1 junctions variant)
        //        0x00  (Parachain junction variant 0)
        //        SCALE compact u32 of paraId
        bytes memory paraIdEncoded = _scaleCompactU32(paraId);
        return abi.encodePacked(
            bytes1(0x03),  // V3
            bytes1(0x01),  // parents = 1
            bytes1(0x01),  // X1
            bytes1(0x00),  // Parachain junction
            paraIdEncoded
        );
    }

    /**
     * @dev SCALE-encodes an AccountId32 beneficiary multilocation.
     */
    function _encodeAccountId32Beneficiary(bytes32 accountId) internal pure returns (bytes memory) {
        // V3 { parents: 0, interior: X1(AccountId32 { network: None, id: accountId }) }
        return abi.encodePacked(
            bytes1(0x03),  // V3
            bytes1(0x00),  // parents = 0
            bytes1(0x01),  // X1
            bytes1(0x01),  // AccountId32 junction variant
            bytes1(0x00),  // network = None
            accountId      // 32-byte account id
        );
    }

    /**
     * @dev SCALE-encodes a VersionedMultiAssets for an ERC-20 token.
     *      Uses a simplified encoding for Paseo demo purposes.
     */
    function _encodeErc20Asset(address token, uint256 amount) internal pure returns (bytes memory) {
        // V3 MultiAssets: [{ id: Concrete(AccountKey20{key: token}), fun: Fungible(amount) }]
        return abi.encodePacked(
            bytes1(0x03),  // V3
            bytes1(0x04),  // compact length 1 (4 >> 2 = 1 item)
            bytes1(0x01),  // Concrete location
            bytes1(0x00),  // parents = 0
            bytes1(0x01),  // X1
            bytes1(0x03),  // AccountKey20 junction
            bytes1(0x00),  // network = None
            token,         // 20-byte address
            bytes1(0x00),  // Fungible variant
            _scaleCompactU128(amount)
        );
    }

    /**
     * @dev SCALE-encodes a Substrate asset (by general index).
     */
    function _encodeSubstrateAsset(uint128 assetId, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x03),
            bytes1(0x04),  // 1 asset
            bytes1(0x01),  // Concrete
            bytes1(0x01),  // parents = 1
            bytes1(0x02),  // X2
            bytes1(0x04),  // PalletInstance junction (50 = Assets pallet)
            bytes1(0x32),  // pallet index 50
            bytes1(0x05),  // GeneralIndex junction
            _scaleCompactU128(uint256(assetId)),
            bytes1(0x00),
            _scaleCompactU128(amount)
        );
    }

    /**
     * @dev SCALE compact encoding of a uint32.
     */
    function _scaleCompactU32(uint32 value) internal pure returns (bytes memory) {
        if (value < 64) {
            return abi.encodePacked(uint8(value << 2));
        } else if (value < 16384) {
            return abi.encodePacked(uint16((uint16(value) << 2) | 0x01));
        } else {
            return abi.encodePacked(uint8(0x02), uint32(value));
        }
    }

    /**
     * @dev SCALE compact encoding of a uint128 (simplified, handles common ranges).
     */
    function _scaleCompactU128(uint256 value) internal pure returns (bytes memory) {
        if (value < 64) {
            return abi.encodePacked(uint8(value << 2));
        } else if (value < 16384) {
            return abi.encodePacked(uint16((uint16(value) << 2) | 0x01));
        } else if (value < 1073741824) {
            return abi.encodePacked(uint32((uint32(value) << 2) | 0x02));
        } else {
            // Big-integer mode: 0x03 prefix + bytes
            bytes memory valBytes = abi.encodePacked(uint128(value));
            uint8 prefix = uint8(((valBytes.length - 4) << 2) | 0x03);
            return abi.encodePacked(prefix, valBytes);
        }
    }

    // =========================================================================
    // View Helpers
    // =========================================================================

    /**
     * @notice Returns the bridge's ERC-20 token balance.
     */
    function bridgeBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
