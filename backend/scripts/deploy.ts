import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for Zero-Fee Micropayments on Polkadot Hub.
 *
 * Deployment order:
 *   1. MockERC20 (USDT) – only on non-mainnet networks for testing
 *   2. SubsidyPool
 *   3. MicropaymentStream
 *   4. StablecoinBridge
 *   5. Wire up cross-contract references
 *   6. Optionally verify on Blockscout / Etherscan
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network paseo
 *   npx hardhat run scripts/deploy.ts --network hardhat
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("=".repeat(60));
  console.log("Zero-Fee Micropayments – Deployment");
  console.log("=".repeat(60));
  console.log(`Network   : ${networkName}`);
  console.log(`Deployer  : ${deployer.address}`);
  console.log(`Balance   : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Step 1: Deploy Mock ERC-20 (USDT) if not on a live network
  // ---------------------------------------------------------------------------
  let usdtAddress: string;
  let usdcAddress: string;

  if (networkName === "hardhat" || networkName === "localhost") {
    console.log("Deploying MockERC20 (USDT)…");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("USD Tether", "USDT", 6);
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log(`  MockERC20 USDT deployed at: ${usdtAddress}`);

    console.log("Deploying MockERC20 (USDC)…");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log(`  MockERC20 USDC deployed at: ${usdcAddress}`);
  } else {
    // On Paseo use the real bridged USDT / USDC ERC-20 wrapper addresses.
    // These must be set in .env or updated here after bridge deployment.
    usdtAddress = process.env.USDT_ADDRESS || ethers.ZeroAddress;
    usdcAddress = process.env.USDC_ADDRESS || ethers.ZeroAddress;
    if (usdtAddress === ethers.ZeroAddress || usdcAddress === ethers.ZeroAddress) {
      throw new Error("Set USDT_ADDRESS and USDC_ADDRESS in .env for non-local networks");
    }
    console.log(`  Using existing USDT: ${usdtAddress}`);
    console.log(`  Using existing USDC: ${usdcAddress}`);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Deploy SubsidyPool
  // ---------------------------------------------------------------------------
  console.log("\nDeploying SubsidyPool…");
  const SubsidyPool = await ethers.getContractFactory("SubsidyPool");
  const subsidyPool = await SubsidyPool.deploy(
    usdtAddress,       // base token for yield accounting
    ethers.ZeroAddress // stream contract – will be set after Step 3
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

  // Tell SubsidyPool which stream contract to call for subsidised withdrawals.
  const setStreamTx = await subsidyPool.setStreamContract(streamAddress);
  await setStreamTx.wait();
  console.log(`  SubsidyPool.streamContract → ${streamAddress}`);

  // Register the deployer as a relayer on SubsidyPool for demo purposes.
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
    console.log(`    ✓ Verified`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Already Verified")) {
      console.log(`    ⚠  Already verified`);
    } else {
      console.error(`    ✗ Verification failed: ${err}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
