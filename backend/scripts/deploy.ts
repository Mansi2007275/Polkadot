import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for Zero-Fee Micropayments on Polkadot Hub.
 *
 * Deployment order:
 *   1. On Paseo: use Native USDT (Asset ID 1984) via Assets Precompile (0x802)
 *      On local: deploy MockERC20 for testing
 *   2. SubsidyPool
 *   3. MicropaymentStream
 *   4. StablecoinBridge
 *   5. Wire up cross-contract references
 *   6. Optionally verify on Blockscout
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network paseo
 *   npx hardhat run scripts/deploy.ts --network hardhat
 */

const ASSETS_PRECOMPILE = "0x0000000000000000000000000000000000000802";
const NATIVE_USDT_ASSET_ID = 1984;
const NATIVE_USDC_ASSET_ID = 1337;

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("=".repeat(60));
  console.log("Zero-Fee Micropayments – Deployment");
  console.log("=".repeat(60));
  console.log(`Network   : ${networkName}`);
  console.log(`Deployer  : ${deployer.address}`);
  console.log(`Balance   : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} DOT`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Step 1: Resolve stablecoin addresses
  // On Paseo, use the Assets Precompile (0x802) with Native Asset IDs.
  // On local networks, deploy MockERC20 for testing.
  // ---------------------------------------------------------------------------
  let usdtAddress: string;
  let usdcAddress: string;
  let usesNativeAssets = false;

  if (networkName === "paseo") {
    console.log("Paseo detected – using Native Assets via Precompile (0x802)");
    console.log(`  Native USDT Asset ID: ${NATIVE_USDT_ASSET_ID}`);
    console.log(`  Native USDC Asset ID: ${NATIVE_USDC_ASSET_ID}`);
    console.log(`  Assets Precompile:    ${ASSETS_PRECOMPILE}`);

    if (process.env.USDT_ADDRESS && process.env.USDT_ADDRESS !== ethers.ZeroAddress) {
      usdtAddress = process.env.USDT_ADDRESS;
      console.log(`  Using ERC-20 wrapper USDT: ${usdtAddress}`);
    } else {
      usdtAddress = ASSETS_PRECOMPILE;
      usesNativeAssets = true;
      console.log(`  Using Native USDT via Assets Precompile`);
    }

    if (process.env.USDC_ADDRESS && process.env.USDC_ADDRESS !== ethers.ZeroAddress) {
      usdcAddress = process.env.USDC_ADDRESS;
      console.log(`  Using ERC-20 wrapper USDC: ${usdcAddress}`);
    } else {
      usdcAddress = ASSETS_PRECOMPILE;
      console.log(`  Using Native USDC via Assets Precompile`);
    }
  } else {
    console.log("Local network – deploying MockERC20 tokens…");
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    const usdt = await MockERC20.deploy("USD Tether", "USDT", 6);
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log(`  MockERC20 USDT deployed at: ${usdtAddress}`);

    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log(`  MockERC20 USDC deployed at: ${usdcAddress}`);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Deploy SubsidyPool
  // ---------------------------------------------------------------------------
  console.log("\nDeploying SubsidyPool…");
  const SubsidyPool = await ethers.getContractFactory("SubsidyPool");
  const subsidyPool = await SubsidyPool.deploy(
    usdtAddress,
    ethers.ZeroAddress
  );
  await subsidyPool.waitForDeployment();
  const subsidyPoolAddress = await subsidyPool.getAddress();
  console.log(`  SubsidyPool deployed at: ${subsidyPoolAddress}`);

  // ---------------------------------------------------------------------------
  // Step 3: Deploy MicropaymentStream
  // ---------------------------------------------------------------------------
  console.log("\nDeploying MicropaymentStream…");
  const MicropaymentStream = await ethers.getContractFactory("MicropaymentStream");
  const stream = await MicropaymentStream.deploy(subsidyPoolAddress);
  await stream.waitForDeployment();
  const streamAddress = await stream.getAddress();
  console.log(`  MicropaymentStream deployed at: ${streamAddress}`);

  // ---------------------------------------------------------------------------
  // Step 4: Deploy StablecoinBridge
  // ---------------------------------------------------------------------------
  console.log("\nDeploying StablecoinBridge…");
  const StablecoinBridge = await ethers.getContractFactory("StablecoinBridge");
  const bridge = await StablecoinBridge.deploy(
    usdtAddress,
    usdcAddress,
    subsidyPoolAddress
  );
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log(`  StablecoinBridge deployed at: ${bridgeAddress}`);

  // ---------------------------------------------------------------------------
  // Step 5: Wire up references
  // ---------------------------------------------------------------------------
  console.log("\nConfiguring contract references…");

  const setStreamTx = await subsidyPool.setStreamContract(streamAddress);
  await setStreamTx.wait();
  console.log(`  SubsidyPool.streamContract → ${streamAddress}`);

  const setBridgeTx = await subsidyPool.setBridgeContract(bridgeAddress);
  await setBridgeTx.wait();
  console.log(`  SubsidyPool.bridgeContract → ${bridgeAddress}`);

  const relayerTx = await subsidyPool.setRelayer(deployer.address, true);
  await relayerTx.wait();
  console.log(`  Deployer registered as relayer on SubsidyPool`);

  // ---------------------------------------------------------------------------
  // Step 6: Verify contracts (if not local)
  // ---------------------------------------------------------------------------
  const shouldVerify = networkName !== "hardhat" && networkName !== "localhost";
  if (shouldVerify) {
    console.log("\nVerifying contracts on Blockscout…");
    await verifyContract(subsidyPoolAddress, [usdtAddress, ethers.ZeroAddress]);
    await verifyContract(streamAddress, [subsidyPoolAddress]);
    await verifyContract(bridgeAddress, [usdtAddress, usdcAddress, subsidyPoolAddress]);
  }

  // ---------------------------------------------------------------------------
  // Step 7: Persist addresses to deployment.json
  // ---------------------------------------------------------------------------
  const deployment = {
    network: networkName,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    usesNativeAssets,
    nativeAssetIds: usesNativeAssets ? { USDT: NATIVE_USDT_ASSET_ID, USDC: NATIVE_USDC_ASSET_ID } : undefined,
    assetsPrecompile: ASSETS_PRECOMPILE,
    contracts: {
      SubsidyPool: subsidyPoolAddress,
      MicropaymentStream: streamAddress,
      StablecoinBridge: bridgeAddress,
      USDT: usdtAddress,
      USDC: usdcAddress,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("Deployment complete!");
  console.log(`Addresses saved to: ${outFile}`);
  if (usesNativeAssets) {
    console.log(`\nNative Assets Mode: USDT(${NATIVE_USDT_ASSET_ID}) USDC(${NATIVE_USDC_ASSET_ID}) via 0x802`);
  }
  console.log("=".repeat(60));
  console.log(JSON.stringify(deployment.contracts, null, 2));
}

async function verifyContract(address: string, constructorArgs: unknown[]) {
  try {
    console.log(`  Verifying ${address}…`);
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`    Verified`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Already Verified")) {
      console.log(`    Already verified`);
    } else {
      console.error(`    Verification failed: ${err}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
