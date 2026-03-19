import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deploySubscriptionFixture() {
  const [provider, subscriber, stranger] = await ethers.getSigners();

  const MockERC20F = await ethers.getContractFactory("MockERC20");
  const token      = await MockERC20F.deploy("Mock USDC", "mUSDC", 6);

  const SubMgrF = await ethers.getContractFactory("SubscriptionManager");
  const subMgr  = await SubMgrF.deploy();

  const CHARGE   = ethers.parseUnits("10", 6);    // 10 USDC per cycle
  const INTERVAL = 30 * 24 * 3600;               // 30 days
  const CAP      = ethers.parseUnits("120", 6);  // 120 USDC total cap (12 cycles)

  await token.mint(subscriber.address, CAP * 10n);

  return { subMgr, token, provider, subscriber, stranger, CHARGE, INTERVAL, CAP };
}

// Helper: create a plan and subscribe, returning IDs
async function createPlanAndSubscribe(
  f: Awaited<ReturnType<typeof deploySubscriptionFixture>>,
  capOverride?: bigint,
  maxCharges = 0,
  expiry = 0
) {
  const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } = f;
  const cap = capOverride ?? CAP;
  const tokenAddr = await token.getAddress();

  const planId = await subMgr.connect(provider).createPlan.staticCall(
    tokenAddr, CHARGE, INTERVAL, maxCharges, expiry
  );
  await subMgr.connect(provider).createPlan(tokenAddr, CHARGE, INTERVAL, maxCharges, expiry);

  await token.connect(subscriber).approve(await subMgr.getAddress(), cap);
  const subId = await subMgr.connect(subscriber).subscribe.staticCall(planId, cap);
  await subMgr.connect(subscriber).subscribe(planId, cap);

  return { planId, subId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("SubscriptionManager", function () {

  // ── Group 1: createPlan() ─────────────────────────────────────────────────
  describe("createPlan()", function () {
    it("stores all fields correctly and active=true", async function () {
      const { subMgr, token, provider, CHARGE, INTERVAL } = await loadFixture(deploySubscriptionFixture);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 12, 0);
      const plan = await subMgr.plans(0);
      expect(plan.provider).to.equal(provider.address);
      expect(plan.token).to.equal(await token.getAddress());
      expect(plan.chargeAmount).to.equal(CHARGE);
      expect(plan.interval).to.equal(INTERVAL);
      expect(plan.maxCharges).to.equal(12n);
      expect(plan.expiry).to.equal(0n);
      expect(plan.active).to.be.true;
    });

    it("emits PlanCreated", async function () {
      const { subMgr, token, provider, CHARGE, INTERVAL } = await loadFixture(deploySubscriptionFixture);
      await expect(subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0))
        .to.emit(subMgr, "PlanCreated")
        .withArgs(0n, provider.address, await token.getAddress(), CHARGE, INTERVAL);
    });

    it("returns correct plan ID", async function () {
      const { subMgr, token, provider, CHARGE, INTERVAL } = await loadFixture(deploySubscriptionFixture);
      const id0 = await subMgr.connect(provider).createPlan.staticCall(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      const id1 = await subMgr.connect(provider).createPlan.staticCall(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      expect(id0).to.equal(0n);
      expect(id1).to.equal(1n);
    });

    it("reverts if token == address(0)", async function () {
      const { subMgr, provider, CHARGE, INTERVAL } = await loadFixture(deploySubscriptionFixture);
      await expect(subMgr.connect(provider).createPlan(ethers.ZeroAddress, CHARGE, INTERVAL, 0, 0))
        .to.be.revertedWith("Invalid token");
    });

    it("reverts if chargeAmount == 0", async function () {
      const { subMgr, token, provider, INTERVAL } = await loadFixture(deploySubscriptionFixture);
      await expect(subMgr.connect(provider).createPlan(await token.getAddress(), 0n, INTERVAL, 0, 0))
        .to.be.revertedWith("chargeAmount must be > 0");
    });

    it("reverts if interval == 0", async function () {
      const { subMgr, token, provider, CHARGE } = await loadFixture(deploySubscriptionFixture);
      await expect(subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, 0, 0, 0))
        .to.be.revertedWith("interval must be > 0");
    });
  });

  // ── Group 2: subscribe() ──────────────────────────────────────────────────
  describe("subscribe()", function () {
    it("stores subscription correctly (totalCharged=0, nextChargeDue=now)", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber, CAP } = f;
      await createPlanAndSubscribe(f);
      const sub   = await subMgr.subscriptions(0);
      const block = await ethers.provider.getBlock("latest");
      expect(sub.subscriber).to.equal(subscriber.address);
      expect(sub.planId).to.equal(0n);
      expect(sub.approvedCap).to.equal(CAP);
      expect(sub.totalCharged).to.equal(0n);
      expect(sub.nextChargeDue).to.equal(BigInt(block!.timestamp));
      expect(sub.active).to.be.true;
    });

    it("emits Subscribed", async function () {
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } =
        await loadFixture(deploySubscriptionFixture);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await token.connect(subscriber).approve(await subMgr.getAddress(), CAP);
      await expect(subMgr.connect(subscriber).subscribe(0, CAP))
        .to.emit(subMgr, "Subscribed")
        .withArgs(0n, subscriber.address, 0n, CAP);
    });

    it("returns correct subscription ID", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } = f;
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await token.connect(subscriber).approve(await subMgr.getAddress(), CAP * 2n);
      const id0 = await subMgr.connect(subscriber).subscribe.staticCall(0, CAP);
      await subMgr.connect(subscriber).subscribe(0, CAP);
      const id1 = await subMgr.connect(subscriber).subscribe.staticCall(0, CAP);
      expect(id0).to.equal(0n);
      expect(id1).to.equal(1n);
    });

    it("reverts if plan is inactive", async function () {
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } =
        await loadFixture(deploySubscriptionFixture);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await subMgr.connect(provider).deactivatePlan(0);
      await token.connect(subscriber).approve(await subMgr.getAddress(), CAP);
      await expect(subMgr.connect(subscriber).subscribe(0, CAP))
        .to.be.revertedWith("Plan not active");
    });

    it("reverts if approvedCap < chargeAmount", async function () {
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL } =
        await loadFixture(deploySubscriptionFixture);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      const tooLow = CHARGE - 1n;
      await token.connect(subscriber).approve(await subMgr.getAddress(), tooLow);
      await expect(subMgr.connect(subscriber).subscribe(0, tooLow))
        .to.be.revertedWith("approvedCap < chargeAmount");
    });

    it("reverts if ERC-20 allowance < chargeAmount", async function () {
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } =
        await loadFixture(deploySubscriptionFixture);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      // Do NOT approve
      await expect(subMgr.connect(subscriber).subscribe(0, CAP))
        .to.be.revertedWith("Insufficient allowance");
    });
  });

  // ── Group 3: charge() ─────────────────────────────────────────────────────
  describe("charge()", function () {
    it("transfers chargeAmount from subscriber to provider", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, token, provider, subscriber, CHARGE } = f;
      const { subId } = await createPlanAndSubscribe(f);
      const providerBefore    = await token.balanceOf(provider.address);
      const subscriberBefore  = await token.balanceOf(subscriber.address);
      await subMgr.charge(subId);
      expect(await token.balanceOf(provider.address)).to.equal(providerBefore + CHARGE);
      expect(await token.balanceOf(subscriber.address)).to.equal(subscriberBefore - CHARGE);
    });

    it("updates totalCharged correctly", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, CHARGE } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await subMgr.charge(subId);
      const sub = await subMgr.subscriptions(subId);
      expect(sub.totalCharged).to.equal(CHARGE);
    });

    it("updates nextChargeDue = old nextChargeDue + interval", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, INTERVAL } = f;
      const { subId } = await createPlanAndSubscribe(f);
      const before = await subMgr.subscriptions(subId);
      const oldDue = before.nextChargeDue;
      await subMgr.charge(subId);
      const after = await subMgr.subscriptions(subId);
      expect(after.nextChargeDue).to.equal(oldDue + BigInt(INTERVAL));
    });

    it("emits Charged with correct args", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, provider, CHARGE, INTERVAL } = f;
      const { subId } = await createPlanAndSubscribe(f);
      const sub = await subMgr.subscriptions(subId);
      await expect(subMgr.charge(subId))
        .to.emit(subMgr, "Charged")
        .withArgs(subId, provider.address, CHARGE, sub.nextChargeDue + BigInt(INTERVAL));
    });

    it("reverts if block.timestamp < nextChargeDue", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr } = f;
      const { subId } = await createPlanAndSubscribe(f);
      // Charge once (advances nextChargeDue by INTERVAL)
      await subMgr.charge(subId);
      // Immediately try again — not due yet
      await expect(subMgr.charge(subId)).to.be.revertedWith("Not due yet");
    });

    it("reverts when totalCharged + chargeAmount > approvedCap", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, CHARGE, INTERVAL } = f;
      // Cap = exactly 1 charge
      const { subId } = await createPlanAndSubscribe(f, CHARGE);
      await subMgr.charge(subId);
      await time.increase(INTERVAL);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Cap exceeded");
    });

    it("reverts if subscriber reduced ERC-20 allowance", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, token, subscriber, INTERVAL } = f;
      const { subId } = await createPlanAndSubscribe(f);
      // Charge once, then advance time
      await subMgr.charge(subId);
      await time.increase(INTERVAL);
      // Subscriber revokes allowance
      await token.connect(subscriber).approve(await subMgr.getAddress(), 0n);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Insufficient allowance");
    });

    it("reverts if subscription is not active", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber, INTERVAL } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await subMgr.charge(subId); // first charge
      await time.increase(INTERVAL);
      await subMgr.connect(subscriber).revoke(subId);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Subscription not active");
    });

    it("reverts if plan is not active", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, provider, INTERVAL } = f;
      const { subId, planId } = await createPlanAndSubscribe(f);
      await subMgr.charge(subId); // first charge
      await time.increase(INTERVAL);
      await subMgr.connect(provider).deactivatePlan(planId);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Plan not active");
    });

    it("reverts if plan has expiry and block.timestamp > expiry", async function () {
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL, CAP } =
        await loadFixture(deploySubscriptionFixture);
      const now    = (await ethers.provider.getBlock("latest"))!.timestamp;
      const expiry = now + INTERVAL * 2; // expires after 2 intervals
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, expiry);
      await token.connect(subscriber).approve(await subMgr.getAddress(), CAP);
      await subMgr.connect(subscriber).subscribe(0, CAP);
      // Advance past expiry
      await time.increaseTo(expiry + 1);
      await expect(subMgr.charge(0)).to.be.revertedWith("Plan expired");
    });

    it("reverts if maxCharges reached", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, INTERVAL } = f;
      // maxCharges = 1
      const { subId } = await createPlanAndSubscribe(f, f.CAP, 1);
      await subMgr.charge(subId); // uses the 1 allowed charge
      await time.increase(INTERVAL);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Max charges reached");
    });
  });

  // ── Group 4: revoke() ────────────────────────────────────────────────────
  describe("revoke()", function () {
    it("sets subscription active = false", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await subMgr.connect(subscriber).revoke(subId);
      expect((await subMgr.subscriptions(subId)).active).to.be.false;
    });

    it("emits Revoked", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await expect(subMgr.connect(subscriber).revoke(subId))
        .to.emit(subMgr, "Revoked")
        .withArgs(subId, subscriber.address);
    });

    it("subsequent charge() reverts with inactive subscription", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber, INTERVAL } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await subMgr.charge(subId);
      await time.increase(INTERVAL);
      await subMgr.connect(subscriber).revoke(subId);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Subscription not active");
    });

    it("reverts if caller is not subscriber", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, stranger } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await expect(subMgr.connect(stranger).revoke(subId))
        .to.be.revertedWith("Not subscriber");
    });

    it("reverts if already revoked", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, subscriber } = f;
      const { subId } = await createPlanAndSubscribe(f);
      await subMgr.connect(subscriber).revoke(subId);
      await expect(subMgr.connect(subscriber).revoke(subId))
        .to.be.revertedWith("Already inactive");
    });
  });

  // ── Group 5: deactivatePlan() ─────────────────────────────────────────────
  describe("deactivatePlan()", function () {
    it("sets plan active = false", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, provider } = f;
      const { planId } = await createPlanAndSubscribe(f);
      await subMgr.connect(provider).deactivatePlan(planId);
      expect((await subMgr.plans(planId)).active).to.be.false;
    });

    it("emits PlanDeactivated", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, provider } = f;
      const { planId } = await createPlanAndSubscribe(f);
      await expect(subMgr.connect(provider).deactivatePlan(planId))
        .to.emit(subMgr, "PlanDeactivated")
        .withArgs(planId);
    });

    it("subsequent charge() reverts on inactive plan", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, provider, INTERVAL } = f;
      const { planId, subId } = await createPlanAndSubscribe(f);
      await subMgr.charge(subId);
      await time.increase(INTERVAL);
      await subMgr.connect(provider).deactivatePlan(planId);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Plan not active");
    });

    it("reverts if caller is not plan provider", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, stranger } = f;
      const { planId } = await createPlanAndSubscribe(f);
      await expect(subMgr.connect(stranger).deactivatePlan(planId))
        .to.be.revertedWith("Not provider");
    });
  });

  // ── Group 6: Cap boundary cases ───────────────────────────────────────────
  describe("cap boundary cases", function () {
    it("exactly at cap: last charge succeeds when totalCharged + charge == approvedCap", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL } = f;
      // Cap = exactly 3 charges
      const exactCap = CHARGE * 3n;
      await token.connect(subscriber).approve(await subMgr.getAddress(), exactCap);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await subMgr.connect(subscriber).subscribe(0, exactCap);
      await subMgr.charge(0);
      await time.increase(INTERVAL);
      await subMgr.charge(0);
      await time.increase(INTERVAL);
      // 3rd charge — totalCharged + CHARGE == exactCap, should succeed
      await expect(subMgr.charge(0)).not.to.be.reverted;
    });

    it("one over cap: reverts when totalCharged + charge > approvedCap by 1 base unit", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, token, provider, subscriber, CHARGE, INTERVAL } = f;
      // Cap = 2 charges + 1 base unit under a 3rd
      const cap = CHARGE * 3n - 1n;
      await token.connect(subscriber).approve(await subMgr.getAddress(), cap);
      await subMgr.connect(provider).createPlan(await token.getAddress(), CHARGE, INTERVAL, 0, 0);
      await subMgr.connect(subscriber).subscribe(0, cap);
      await subMgr.charge(0);
      await time.increase(INTERVAL);
      await subMgr.charge(0);
      await time.increase(INTERVAL);
      // 3rd charge would go 1 over cap
      await expect(subMgr.charge(0)).to.be.revertedWith("Cap exceeded");
    });

    it("multiple cycles within cap all succeed", async function () {
      const f = await loadFixture(deploySubscriptionFixture);
      const { subMgr, INTERVAL, CAP, CHARGE } = f;
      const { subId } = await createPlanAndSubscribe(f, CAP);
      const cycles = Number(CAP / CHARGE); // 12 cycles
      for (let i = 0; i < cycles; i++) {
        if (i > 0) await time.increase(INTERVAL);
        await expect(subMgr.charge(subId)).not.to.be.reverted;
      }
      // Next would exceed cap
      await time.increase(INTERVAL);
      await expect(subMgr.charge(subId)).to.be.revertedWith("Cap exceeded");
    });
  });
});
