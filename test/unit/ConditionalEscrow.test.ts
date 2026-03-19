import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployEscrowFixture() {
  const [payer, payee, approver1, approver2, approver3, stranger] = await ethers.getSigners();

  const MockERC20F = await ethers.getContractFactory("MockERC20");
  const token      = await MockERC20F.deploy("Mock USDC", "mUSDC", 6);

  const EscrowF = await ethers.getContractFactory("ConditionalEscrow");
  const escrow  = await EscrowF.deploy();

  const AMOUNT  = ethers.parseUnits("500", 6);
  const latest  = await ethers.provider.getBlock("latest");
  const TIMEOUT = latest!.timestamp + 86400; // +1 day

  await token.mint(payer.address, AMOUNT * 10n);

  return { escrow, token, payer, payee, approver1, approver2, approver3, stranger, AMOUNT, TIMEOUT };
}

// Helper: create a milestone with one approver (defaults)
async function createDefault(
  f: Awaited<ReturnType<typeof deployEscrowFixture>>,
  approversOverride?: string[],
  requiredOverride?: number
) {
  const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
  const approvers = approversOverride ?? [approver1.address];
  const required  = requiredOverride  ?? 1;
  await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
  return escrow.connect(payer).createMilestone(
    payee.address, await token.getAddress(), AMOUNT, approvers, required, TIMEOUT
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ConditionalEscrow", function () {

  // ── Group 1: createMilestone() ────────────────────────────────────────────
  describe("createMilestone()", function () {
    it("locks tokens in escrow (payer balance decreases, escrow increases)", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { token, payer, escrow, AMOUNT } = f;
      const payerBefore  = await token.balanceOf(payer.address);
      const escrowBefore = await token.balanceOf(await escrow.getAddress());
      await createDefault(f);
      expect(await token.balanceOf(payer.address)).to.equal(payerBefore - AMOUNT);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(escrowBefore + AMOUNT);
    });

    it("stores all fields correctly", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      await createDefault(f);
      const m = await escrow.getMilestone(0);
      expect(m.payer).to.equal(payer.address);
      expect(m.payee).to.equal(payee.address);
      expect(m.token).to.equal(await token.getAddress());
      expect(m.amount).to.equal(AMOUNT);
      expect(m.approvers[0]).to.equal(approver1.address);
      expect(m.approvalsRequired).to.equal(1n);
      expect(m.approvalCount).to.equal(0n);
      expect(m.disputeDeadline).to.equal(BigInt(TIMEOUT));
      expect(m.released).to.be.false;
      expect(m.reclaimed).to.be.false;
    });

    it("emits MilestoneCreated with correct args", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, AMOUNT } = f;
      await f.token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT,
          [f.approver1.address], 1, f.TIMEOUT
        )
      ).to.emit(escrow, "MilestoneCreated").withArgs(0n, payer.address, payee.address, AMOUNT);
    });

    it("returns correct milestone IDs (starts at 0, increments)", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT * 2n);
      const id0 = await escrow.connect(payer).createMilestone.staticCall(
        payee.address, await token.getAddress(), AMOUNT, [approver1.address], 1, TIMEOUT
      );
      await escrow.connect(payer).createMilestone(
        payee.address, await token.getAddress(), AMOUNT, [approver1.address], 1, TIMEOUT
      );
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      const id1 = await escrow.connect(payer).createMilestone.staticCall(
        payee.address, await token.getAddress(), AMOUNT, [approver1.address], 1, TIMEOUT
      );
      expect(id0).to.equal(0n);
      expect(id1).to.equal(1n);
    });

    it("reverts if allowance < amount", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      // No approve
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT, [approver1.address], 1, TIMEOUT
        )
      ).to.be.revertedWith("Insufficient allowance");
    });

    it("reverts if amount == 0", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), 0n, [approver1.address], 1, TIMEOUT
        )
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("reverts if payee == address(0)", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, approver1, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          ethers.ZeroAddress, await token.getAddress(), AMOUNT, [approver1.address], 1, TIMEOUT
        )
      ).to.be.revertedWith("Invalid payee");
    });

    it("reverts if approvers array is empty", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT, [], 1, TIMEOUT
        )
      ).to.be.revertedWith("Need at least one approver");
    });

    it("reverts if approvalsRequired == 0", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT, [approver1.address], 0, TIMEOUT
        )
      ).to.be.revertedWith("Invalid approvalsRequired");
    });

    it("reverts if approvalsRequired > approvers.length", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT, TIMEOUT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT, [approver1.address], 2, TIMEOUT
        )
      ).to.be.revertedWith("Invalid approvalsRequired");
    });

    it("reverts if disputeDeadline <= block.timestamp", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, payer, payee, approver1, AMOUNT } = f;
      await token.connect(payer).approve(await escrow.getAddress(), AMOUNT);
      const past = (await ethers.provider.getBlock("latest"))!.timestamp - 1;
      await expect(
        escrow.connect(payer).createMilestone(
          payee.address, await token.getAddress(), AMOUNT, [approver1.address], 1, past
        )
      ).to.be.revertedWith("Deadline must be in future");
    });
  });

  // ── Group 2: approveMilestone() — single approver ─────────────────────────
  describe("approveMilestone() — single approver (1-of-1)", function () {
    it("releases funds to payee on first approve", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, token, approver1, payee, AMOUNT } = f;
      await createDefault(f);
      const payeeBefore = await token.balanceOf(payee.address);
      await escrow.connect(approver1).approveMilestone(0);
      expect(await token.balanceOf(payee.address)).to.equal(payeeBefore + AMOUNT);
    });

    it("milestones[id].released == true after release", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      expect((await f.escrow.getMilestone(0)).released).to.be.true;
    });

    it("emits MilestoneApproved then MilestoneReleased", async function () {
      const f = await loadFixture(deployEscrowFixture);
      const { escrow, approver1, payee, AMOUNT } = f;
      await createDefault(f);
      const tx = escrow.connect(approver1).approveMilestone(0);
      await expect(tx).to.emit(escrow, "MilestoneApproved").withArgs(0n, approver1.address, 1n);
      await expect(tx).to.emit(escrow, "MilestoneReleased").withArgs(0n, payee.address, AMOUNT);
    });

    it("reverts if caller is not an approver", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await expect(f.escrow.connect(f.stranger).approveMilestone(0))
        .to.be.revertedWith("Not an approver");
    });

    it("reverts if milestone already released", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await expect(f.escrow.connect(f.approver1).approveMilestone(0))
        .to.be.revertedWith("Already settled");
    });

    it("reverts if milestone already reclaimed", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401); // past deadline
      await f.escrow.connect(f.payer).reclaimExpired(0);
      await expect(f.escrow.connect(f.approver1).approveMilestone(0))
        .to.be.revertedWith("Already settled");
    });
  });

  // ── Group 3: approveMilestone() — 2-of-3 multi-approver ──────────────────
  describe("approveMilestone() — 2-of-3 multi-approver", function () {
    async function setup2of3(f: Awaited<ReturnType<typeof deployEscrowFixture>>) {
      const approvers = [f.approver1.address, f.approver2.address, f.approver3.address];
      await f.token.connect(f.payer).approve(await f.escrow.getAddress(), f.AMOUNT);
      await f.escrow.connect(f.payer).createMilestone(
        f.payee.address, await f.token.getAddress(), f.AMOUNT, approvers, 2, f.TIMEOUT
      );
    }

    it("first approval increments approvalCount to 1, does NOT release", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await setup2of3(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      const m = await f.escrow.getMilestone(0);
      expect(m.approvalCount).to.equal(1n);
      expect(m.released).to.be.false;
    });

    it("second approval releases funds", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await setup2of3(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await f.escrow.connect(f.approver2).approveMilestone(0);
      expect((await f.escrow.getMilestone(0)).released).to.be.true;
    });

    it("payee balance correct after 2-of-3 approval", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await setup2of3(f);
      const payeeBefore = await f.token.balanceOf(f.payee.address);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await f.escrow.connect(f.approver2).approveMilestone(0);
      expect(await f.token.balanceOf(f.payee.address)).to.equal(payeeBefore + f.AMOUNT);
    });

    it("third approver attempt after release: reverts", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await setup2of3(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await f.escrow.connect(f.approver2).approveMilestone(0);
      await expect(f.escrow.connect(f.approver3).approveMilestone(0))
        .to.be.revertedWith("Already settled");
    });

    it("same approver cannot approve twice (double-approval reverts)", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await setup2of3(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await expect(f.escrow.connect(f.approver1).approveMilestone(0))
        .to.be.revertedWith("Already approved");
    });
  });

  // ── Group 4: reclaimExpired() ─────────────────────────────────────────────
  describe("reclaimExpired()", function () {
    it("payer can reclaim after disputeDeadline passes", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      const payerBefore = await f.token.balanceOf(f.payer.address);
      await f.escrow.connect(f.payer).reclaimExpired(0);
      expect(await f.token.balanceOf(f.payer.address)).to.equal(payerBefore + f.AMOUNT);
    });

    it("milestones[id].reclaimed == true", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      await f.escrow.connect(f.payer).reclaimExpired(0);
      expect((await f.escrow.getMilestone(0)).reclaimed).to.be.true;
    });

    it("emits MilestoneReclaimed", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      await expect(f.escrow.connect(f.payer).reclaimExpired(0))
        .to.emit(f.escrow, "MilestoneReclaimed")
        .withArgs(0n, f.payer.address, f.AMOUNT);
    });

    it("reverts if called before disputeDeadline", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      // Not advancing time — deadline not passed
      await expect(f.escrow.connect(f.payer).reclaimExpired(0))
        .to.be.revertedWith("Deadline not passed");
    });

    it("reverts if caller is not payer", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      await expect(f.escrow.connect(f.stranger).reclaimExpired(0))
        .to.be.revertedWith("Not payer");
    });

    it("reverts if already released", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await time.increase(86401);
      await expect(f.escrow.connect(f.payer).reclaimExpired(0))
        .to.be.revertedWith("Already settled");
    });

    it("reverts on double-reclaim", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      await f.escrow.connect(f.payer).reclaimExpired(0);
      await expect(f.escrow.connect(f.payer).reclaimExpired(0))
        .to.be.revertedWith("Already settled");
    });
  });

  // ── Group 5: State combinations ───────────────────────────────────────────
  describe("state combinations", function () {
    it("approve then attempt reclaimExpired: reverts", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await f.escrow.connect(f.approver1).approveMilestone(0);
      await time.increase(86401);
      await expect(f.escrow.connect(f.payer).reclaimExpired(0))
        .to.be.revertedWith("Already settled");
    });

    it("reclaim then attempt approve: reverts", async function () {
      const f = await loadFixture(deployEscrowFixture);
      await createDefault(f);
      await time.increase(86401);
      await f.escrow.connect(f.payer).reclaimExpired(0);
      await expect(f.escrow.connect(f.approver1).approveMilestone(0))
        .to.be.revertedWith("Already settled");
    });
  });
});
