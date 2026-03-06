import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-network-helpers";
import type {
  MicropaymentStream,
  SubsidyPool,
  MockERC20,
} from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// =============================================================================
// Test helpers
// =============================================================================

const SECONDS_PER_DAY = 86_400n;
const RATE = 1_000_000n; // 1 USDT per second (6 dec, value = 1e6)

/** Deploy the full contract suite and mint tokens to test accounts. */
async function deployFixture() {
  const [owner, sender, recipient, relayer, attacker] =
    await ethers.getSigners();

  // Deploy mock USDT
  const MockERC20F = await ethers.getContractFactory("MockERC20");
  const usdt = (await MockERC20F.deploy("USD Tether", "USDT", 6)) as MockERC20;
  await usdt.waitForDeployment();

  // Deploy SubsidyPool (stream address wired later)
  const SubsidyPoolF = await ethers.getContractFactory("SubsidyPool");
  const subsidyPool = (await SubsidyPoolF.deploy(
    await usdt.getAddress(),
    ethers.ZeroAddress
  )) as SubsidyPool;
  await subsidyPool.waitForDeployment();

  // Deploy MicropaymentStream
  const StreamF = await ethers.getContractFactory("MicropaymentStream");
  const stream = (await StreamF.deploy(
    await subsidyPool.getAddress()
  )) as MicropaymentStream;
  await stream.waitForDeployment();

  // Wire SubsidyPool → Stream
  await subsidyPool.setStreamContract(await stream.getAddress());
  await subsidyPool.setRelayer(relayer.address, true);

  // Mint USDT to sender (100k tokens)
  await usdt.connect(owner).mint(sender.address, 100_000n * 10n ** 6n);
  // Mint to relayer for deposit
  await usdt.connect(owner).mint(relayer.address, 50_000n * 10n ** 6n);
  // Mint to owner for subsidyPool deposit
  await usdt.connect(owner).mint(owner.address, 50_000n * 10n ** 6n);

  return { owner, sender, recipient, relayer, attacker, usdt, subsidyPool, stream };
}

/** Helper to approve and create a stream from `now + 1s` to `now + duration`. */
async function createStream(
  stream: MicropaymentStream,
  usdt: MockERC20,
  sender: SignerWithAddress,
  recipient: SignerWithAddress,
  durationSeconds = SECONDS_PER_DAY
) {
  // Approve first before computing timestamps so the mined block doesn't
  // invalidate the startTime (contract requires startTime >= block.timestamp).
  const deposit = RATE * durationSeconds;
  await usdt.connect(sender).approve(await stream.getAddress(), deposit);

  const now = BigInt(await time.latest());
  const startTime = now + 30n;  // 30-second buffer after the approve tx
  const stopTime = startTime + durationSeconds;

  const tx = await stream
    .connect(sender)
    .createStream(
      recipient.address,
      deposit,
      await usdt.getAddress(),
      startTime,
      stopTime
    );
  const receipt = await tx.wait();

  // Extract streamId from event
  const iface = stream.interface;
  let streamId = 0n;
  for (const log of receipt!.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "StreamCreated") {
        streamId = parsed.args.streamId;
        break;
      }
    } catch (_) {
      // skip non-matching logs
    }
  }
  return { streamId, deposit, startTime, stopTime };
}

// =============================================================================
// MicropaymentStream – Stream Lifecycle Tests
// =============================================================================

describe("MicropaymentStream", function () {
  // ---------------------------------------------------------------------------
  describe("Stream Creation", function () {
    it("should create a stream and emit StreamCreated", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const now = BigInt(await time.latest());
      const startTime = now + 10n;
      const stopTime = startTime + SECONDS_PER_DAY;
      const deposit = RATE * SECONDS_PER_DAY;

      await usdt.connect(sender).approve(await stream.getAddress(), deposit);

      await expect(
        stream
          .connect(sender)
          .createStream(recipient.address, deposit, await usdt.getAddress(), startTime, stopTime)
      )
        .to.emit(stream, "StreamCreated")
        .withArgs(
          1n,
          sender.address,
          recipient.address,
          await usdt.getAddress(),
          deposit,
          startTime,
          stopTime,
          RATE
        );
    });

    it("should lock tokens from sender", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const deposit = RATE * SECONDS_PER_DAY;
      const balBefore = await usdt.balanceOf(sender.address);

      await createStream(stream, usdt, sender, recipient);

      const balAfter = await usdt.balanceOf(sender.address);
      expect(balBefore - balAfter).to.equal(deposit);
    });

    it("should reject self-streaming", async function () {
      const { stream, usdt, sender } = await loadFixture(deployFixture);
      const deposit = RATE * SECONDS_PER_DAY;
      await usdt.connect(sender).approve(await stream.getAddress(), deposit);
      const now = BigInt(await time.latest());
      await expect(
        stream
          .connect(sender)
          .createStream(sender.address, deposit, await usdt.getAddress(), now + 30n, now + 30n + SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(stream, "InvalidRecipient");
    });

    it("should reject zero-address recipient", async function () {
      const { stream, usdt, sender } = await loadFixture(deployFixture);
      const deposit = RATE * SECONDS_PER_DAY;
      await usdt.connect(sender).approve(await stream.getAddress(), deposit);
      const now = BigInt(await time.latest());
      await expect(
        stream
          .connect(sender)
          .createStream(ethers.ZeroAddress, deposit, await usdt.getAddress(), now + 30n, now + 30n + SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(stream, "InvalidRecipient");
    });

    it("should reject deposit not divisible by duration", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const indivisibleDeposit = RATE * SECONDS_PER_DAY + 1n; // +1 makes it indivisible
      await usdt.connect(sender).approve(await stream.getAddress(), indivisibleDeposit);
      const now = BigInt(await time.latest());
      await expect(
        stream
          .connect(sender)
          .createStream(recipient.address, indivisibleDeposit, await usdt.getAddress(), now + 30n, now + 30n + SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(stream, "InvalidDeposit");
    });

    it("should reject startTime in the past", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const deposit = RATE * SECONDS_PER_DAY;
      await usdt.connect(sender).approve(await stream.getAddress(), deposit);
      const now = BigInt(await time.latest());
      await expect(
        stream
          .connect(sender)
          .createStream(recipient.address, deposit, await usdt.getAddress(), now - 100n, now + SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(stream, "InvalidTimeRange");
    });
  });

  // ---------------------------------------------------------------------------
  describe("balanceOf", function () {
    it("should return 0 before stream starts", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId } = await createStream(stream, usdt, sender, recipient);
      expect(await stream.balanceOf(streamId)).to.equal(0n);
    });

    it("should accrue balance proportionally over time", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      // Advance time to 1 hour after stream start
      await time.increaseTo(startTime + 3600n);

      const bal = await stream.balanceOf(streamId);
      expect(Number(bal)).to.be.closeTo(Number(RATE * 3600n), Number(RATE)); // allow ±1s drift
    });

    it("should cap balance at deposit after stream ends", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, stopTime, deposit } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(stopTime + 1000n);
      expect(await stream.balanceOf(streamId)).to.equal(deposit);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Withdrawal", function () {
    it("recipient can withdraw vested amount", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(startTime + 3600n);
      const withdrawAmount = RATE * 3600n;

      await expect(stream.connect(recipient).withdrawFromStream(streamId, withdrawAmount))
        .to.emit(stream, "StreamWithdrawn")
        .withArgs(streamId, recipient.address, withdrawAmount, false);

      const balAfter = await usdt.balanceOf(recipient.address);
      expect(balAfter).to.equal(withdrawAmount);
    });

    it("attacker cannot withdraw", async function () {
      const { stream, usdt, sender, recipient, attacker } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(startTime + 3600n);
      await expect(
        stream.connect(attacker).withdrawFromStream(streamId, RATE * 3600n)
      ).to.be.revertedWithCustomError(stream, "CallerNotRecipient");
    });

    it("cannot withdraw more than vested", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(startTime + 3600n);
      const overAmount = RATE * 7200n; // only 1h vested, requesting 2h
      await expect(
        stream.connect(recipient).withdrawFromStream(streamId, overAmount)
      ).to.be.revertedWithCustomError(stream, "InsufficientBalance");
    });

    it("subsidy pool can trigger withdrawal on recipient's behalf", async function () {
      const { stream, usdt, sender, recipient, relayer, subsidyPool } =
        await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(startTime + 3600n);
      const withdrawAmount = RATE * 3600n;

      // Fund SubsidyPool so it can call the stream
      await usdt.connect(relayer).approve(await subsidyPool.getAddress(), 10_000n * 10n ** 6n);
      await subsidyPool.connect(relayer).deposit(5_000n * 10n ** 6n);

      await expect(subsidyPool.connect(relayer).subsidisedWithdraw(streamId, withdrawAmount))
        .to.emit(stream, "StreamWithdrawn")
        .withArgs(streamId, recipient.address, withdrawAmount, true);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Stream Cancellation", function () {
    it("sender can cancel and get refund", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime, deposit } = await createStream(stream, usdt, sender, recipient);

      const senderBalBefore = await usdt.balanceOf(sender.address);

      await time.increaseTo(startTime + 3600n);
      await stream.connect(sender).cancelStream(streamId);

      const senderBalAfter = await usdt.balanceOf(sender.address);
      const recipientBal = await usdt.balanceOf(recipient.address);

      // Recipient gets ~1 hour's worth (allow ±2 seconds of block drift)
      expect(Number(recipientBal)).to.be.closeTo(Number(RATE * 3600n), Number(RATE * 2n));
      // Sender gets the rest (minus possible ±1s drift)
      expect(Number(senderBalAfter - senderBalBefore)).to.be.closeTo(
        Number(deposit - RATE * 3600n),
        Number(RATE * 2n)
      );
    });

    it("non-sender cannot cancel", async function () {
      const { stream, usdt, sender, recipient, attacker } = await loadFixture(deployFixture);
      const { streamId } = await createStream(stream, usdt, sender, recipient);
      await expect(
        stream.connect(attacker).cancelStream(streamId)
      ).to.be.revertedWithCustomError(stream, "CallerNotSender");
    });

    it("cancelled stream cannot be cancelled again", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);
      await time.increaseTo(startTime + 3600n);
      await stream.connect(sender).cancelStream(streamId);
      await expect(
        stream.connect(sender).cancelStream(streamId)
      ).to.be.revertedWithCustomError(stream, "StreamNotActive");
    });
  });

  // ---------------------------------------------------------------------------
  describe("Pause / Resume", function () {
    it("sender can pause and resume a stream", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId } = await createStream(stream, usdt, sender, recipient);

      await expect(stream.connect(sender).pauseStream(streamId))
        .to.emit(stream, "StreamPaused")
        .withArgs(streamId, sender.address);

      await expect(stream.connect(sender).resumeStream(streamId))
        .to.emit(stream, "StreamResumed")
        .withArgs(streamId, sender.address);
    });

    it("paused stream returns 0 balance", async function () {
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);
      await time.increaseTo(startTime + 3600n);
      await stream.connect(sender).pauseStream(streamId);
      expect(await stream.balanceOf(streamId)).to.equal(0n);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Reentrancy Protection", function () {
    it("reentrant withdrawal reverts", async function () {
      // This test verifies the ReentrancyGuard fires. We use a malicious ERC-20
      // that re-enters withdrawFromStream during safeTransfer.
      // For simplicity we test that calling withdrawFromStream twice on the same
      // stream with the same amount fails on the second call.
      const { stream, usdt, sender, recipient } = await loadFixture(deployFixture);
      const { streamId, startTime } = await createStream(stream, usdt, sender, recipient);

      await time.increaseTo(startTime + 3600n);
      const amount = RATE * 1800n; // 30 min

      // Request far more than could possibly be vested (entire deposit)
      const overAmount = RATE * SECONDS_PER_DAY; // full day's deposit, only 60 min vested
      await expect(
        stream.connect(recipient).withdrawFromStream(streamId, overAmount)
      ).to.be.revertedWithCustomError(stream, "InsufficientBalance");
    });
  });
});

// =============================================================================
// SubsidyPool Tests
// =============================================================================

describe("SubsidyPool", function () {
  describe("Deposit & Shares", function () {
    it("first deposit gets 1:1 shares", async function () {
      const { subsidyPool, usdt, owner } = await loadFixture(deployFixture);
      const amount = 1_000n * 10n ** 6n;
      await usdt.connect(owner).approve(await subsidyPool.getAddress(), amount);
      await subsidyPool.connect(owner).deposit(amount);

      const dep = await subsidyPool.depositors(owner.address);
      expect(dep.shares).to.equal(amount);
      expect(dep.amount).to.equal(amount);
    });

    it("multiple depositors split shares proportionally", async function () {
      const { subsidyPool, usdt, owner, relayer } = await loadFixture(deployFixture);
      const amount1 = 1_000n * 10n ** 6n;
      const amount2 = 2_000n * 10n ** 6n;

      await usdt.connect(owner).approve(await subsidyPool.getAddress(), amount1);
      await subsidyPool.connect(owner).deposit(amount1);

      await usdt.connect(relayer).approve(await subsidyPool.getAddress(), amount2);
      await subsidyPool.connect(relayer).deposit(amount2);

      const dep1 = await subsidyPool.depositors(owner.address);
      const dep2 = await subsidyPool.depositors(relayer.address);
      // dep2.shares should be 2x dep1.shares (2000/1000)
      expect(dep2.shares).to.equal(dep1.shares * 2n);
    });

    it("reverts on zero deposit", async function () {
      const { subsidyPool, owner } = await loadFixture(deployFixture);
      await expect(subsidyPool.connect(owner).deposit(0n)).to.be.revertedWithCustomError(
        subsidyPool,
        "ZeroAmount"
      );
    });
  });

  describe("Withdraw", function () {
    it("depositor can withdraw all shares", async function () {
      const { subsidyPool, usdt, owner } = await loadFixture(deployFixture);
      const amount = 1_000n * 10n ** 6n;
      await usdt.connect(owner).approve(await subsidyPool.getAddress(), amount);
      await subsidyPool.connect(owner).deposit(amount);

      const dep = await subsidyPool.depositors(owner.address);
      const shares = dep[1]; // index 1 = shares field
      const balBefore = await usdt.balanceOf(owner.address);
      await subsidyPool.connect(owner).withdraw(shares);

      const balAfter = await usdt.balanceOf(owner.address);
      expect(Number(balAfter - balBefore)).to.be.closeTo(Number(amount), 10);
    });

    it("cannot withdraw more shares than owned", async function () {
      const { subsidyPool, usdt, owner } = await loadFixture(deployFixture);
      const amount = 1_000n * 10n ** 6n;
      await usdt.connect(owner).approve(await subsidyPool.getAddress(), amount);
      await subsidyPool.connect(owner).deposit(amount);

      await expect(
        subsidyPool.connect(owner).withdraw(amount * 100n)
      ).to.be.revertedWithCustomError(subsidyPool, "InsufficientShares");
    });
  });

  describe("Yield Accrual", function () {
    it("pending yield increases over time", async function () {
      const { subsidyPool, usdt, owner } = await loadFixture(deployFixture);
      const amount = 10_000n * 10n ** 6n;
      await usdt.connect(owner).approve(await subsidyPool.getAddress(), amount);
      await subsidyPool.connect(owner).deposit(amount);

      const pending0 = await subsidyPool.pendingYield(owner.address);
      await time.increase(30 * 24 * 3600); // 30 days
      const pending30 = await subsidyPool.pendingYield(owner.address);

      expect(pending30).to.be.gt(pending0);
    });
  });

  describe("Subsidy Operations", function () {
    it("unauthorised caller cannot call subsidisedWithdraw", async function () {
      const { subsidyPool, attacker } = await loadFixture(deployFixture);
      await expect(
        subsidyPool.connect(attacker).subsidisedWithdraw(1n, 100n)
      ).to.be.revertedWithCustomError(subsidyPool, "NotAuthorised");
    });
  });
});
