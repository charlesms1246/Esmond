import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const INTERVAL = 30 * 24 * 3600; // 30 days

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployPayrollVaultFixture() {
  const [owner, alice, bob, carol, stranger] = await ethers.getSigners();

  // Deploy MockERC20
  const MockERC20F = await ethers.getContractFactory("MockERC20");
  const mockUsdc   = await MockERC20F.deploy("Mock USDC", "mUSDC", 6);

  // Deploy MockIXcm and etch its bytecode to the hardcoded precompile address
  const MockIXcmF       = await ethers.getContractFactory("MockIXcm");
  const mockXcmDeployed = await MockIXcmF.deploy();
  const xcmCode = await ethers.provider.getCode(await mockXcmDeployed.getAddress());
  await network.provider.send("hardhat_setCode", [XCM_PRECOMPILE, xcmCode]);
  const mockXcm = await ethers.getContractAt("MockIXcm", XCM_PRECOMPILE);
  // Initialise weight (storage not copied by hardhat_setCode)
  await mockXcm.setMockWeight(1_000_000_000, 65536);

  // Deploy MockPayrollScheduler
  const MockSchedulerF = await ethers.getContractFactory("MockPayrollScheduler");
  const mockScheduler  = await MockSchedulerF.deploy();

  // Deploy PayrollVault with mock scheduler
  const VaultF = await ethers.getContractFactory("PayrollVault");
  const vault  = await VaultF.deploy(await mockScheduler.getAddress());

  // Fund owner with 1,000,000 mUSDC
  const MILLION = ethers.parseUnits("1000000", 6);
  await mockUsdc.mint(owner.address, MILLION);

  const USDC_ADDRESS = await mockUsdc.getAddress();

  return { vault, mockUsdc, mockXcm, mockScheduler, owner, alice, bob, carol, stranger, USDC_ADDRESS, MILLION };
}

// Helper: deposit + register one Hub employee, configure scheduler to mark them due
async function setupWithOneHubEmployee(
  fixture: Awaited<ReturnType<typeof deployPayrollVaultFixture>>,
  salary = ethers.parseUnits("1000", 6),
  parachainId = 0,
  employeeAddr?: string
) {
  const { vault, mockUsdc, mockScheduler, owner, alice, USDC_ADDRESS } = fixture;
  const empAddr = employeeAddr ?? alice.address;
  const depositAmount = salary * 10n;
  await mockUsdc.approve(await vault.getAddress(), depositAmount);
  await vault.deposit(USDC_ADDRESS, depositAmount);
  await vault.registerEmployee(empAddr, salary, USDC_ADDRESS, INTERVAL, salary * 10n, parachainId);
  await mockScheduler.setReturnValues([empAddr], [salary]);
  return { empAddr, salary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("PayrollVault", function () {

  // ── Group 1: deposit() ────────────────────────────────────────────────────
  describe("deposit()", function () {
    it("increases vault balance by deposited amount", async function () {
      const { vault, mockUsdc, owner, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      const amount = ethers.parseUnits("5000", 6);
      await mockUsdc.approve(await vault.getAddress(), amount);
      await vault.deposit(USDC_ADDRESS, amount);
      expect(await vault.vaultBalance(USDC_ADDRESS)).to.equal(amount);
    });

    it("emits VaultDeposited with correct args", async function () {
      const { vault, mockUsdc, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      const amount = ethers.parseUnits("1000", 6);
      await mockUsdc.approve(await vault.getAddress(), amount);
      await expect(vault.deposit(USDC_ADDRESS, amount))
        .to.emit(vault, "VaultDeposited")
        .withArgs(USDC_ADDRESS, amount);
    });

    it("reverts if caller is not owner", async function () {
      const { vault, mockUsdc, stranger, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      const amount = ethers.parseUnits("100", 6);
      await mockUsdc.mint(stranger.address, amount);
      await mockUsdc.connect(stranger).approve(await vault.getAddress(), amount);
      await expect(vault.connect(stranger).deposit(USDC_ADDRESS, amount))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("reverts if allowance is insufficient", async function () {
      const { vault, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      // No approve — transferFrom will revert
      await expect(vault.deposit(USDC_ADDRESS, ethers.parseUnits("100", 6)))
        .to.be.revertedWith("Insufficient allowance");
    });

    it("reverts if amount is zero", async function () {
      const { vault, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.deposit(USDC_ADDRESS, 0n))
        .to.be.revertedWith("Amount must be > 0");
    });

    it("reverts if token is zero address", async function () {
      const { vault } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.deposit(ethers.ZeroAddress, 100n))
        .to.be.revertedWith("Invalid token");
    });
  });

  // ── Group 2: registerEmployee() ───────────────────────────────────────────
  describe("registerEmployee()", function () {
    it("stores all 7 fields correctly", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      const salary = ethers.parseUnits("500", 6);
      const cap    = salary * 12n;
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, cap, 0);
      const emp = await vault.getEmployee(0);
      expect(emp.wallet).to.equal(alice.address);
      expect(emp.salaryAmount).to.equal(salary);
      expect(emp.payToken).to.equal(USDC_ADDRESS);
      expect(emp.payInterval).to.equal(INTERVAL);
      expect(emp.approvedCap).to.equal(cap);
      expect(emp.parachainId).to.equal(0);
      expect(emp.active).to.be.true;
    });

    it("returns correct ID starting from 0", async function () {
      const { vault, USDC_ADDRESS, alice, bob } = await loadFixture(deployPayrollVaultFixture);
      const salary = ethers.parseUnits("100", 6);
      const id0 = await vault.registerEmployee.staticCall(alice.address, salary, USDC_ADDRESS, INTERVAL, salary, 0);
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary, 0);
      const id1 = await vault.registerEmployee.staticCall(bob.address, salary, USDC_ADDRESS, INTERVAL, salary, 0);
      expect(id0).to.equal(0n);
      expect(id1).to.equal(1n);
    });

    it("increments employeeCount", async function () {
      const { vault, USDC_ADDRESS, alice, bob } = await loadFixture(deployPayrollVaultFixture);
      const salary = ethers.parseUnits("100", 6);
      expect(await vault.employeeCount()).to.equal(0n);
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary, 0);
      expect(await vault.employeeCount()).to.equal(1n);
      await vault.registerEmployee(bob.address, salary, USDC_ADDRESS, INTERVAL, salary, 0);
      expect(await vault.employeeCount()).to.equal(2n);
    });

    it("emits EmployeeRegistered with correct args", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      const salary = ethers.parseUnits("200", 6);
      await expect(vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary, 0))
        .to.emit(vault, "EmployeeRegistered")
        .withArgs(0n, alice.address, salary, 0);
    });

    it("reverts if caller is not owner", async function () {
      const { vault, USDC_ADDRESS, alice, stranger } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.connect(stranger).registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("reverts if wallet is zero address", async function () {
      const { vault, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.registerEmployee(ethers.ZeroAddress, 100n, USDC_ADDRESS, INTERVAL, 100n, 0))
        .to.be.revertedWith("Invalid wallet");
    });

    it("reverts if salary is zero", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.registerEmployee(alice.address, 0n, USDC_ADDRESS, INTERVAL, 100n, 0))
        .to.be.revertedWith("Salary must be > 0");
    });

    it("reverts if interval is zero", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, 0, 100n, 0))
        .to.be.revertedWith("Interval must be > 0");
    });

    it("reverts if cap < salary", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await expect(vault.registerEmployee(alice.address, 200n, USDC_ADDRESS, INTERVAL, 100n, 0))
        .to.be.revertedWith("Cap must be >= salary");
    });

    it("stores parachainId 0 (Hub) correctly", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      expect((await vault.getEmployee(0)).parachainId).to.equal(0);
    });

    it("stores parachainId 2004 (Moonbeam) correctly", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 2004);
      expect((await vault.getEmployee(0)).parachainId).to.equal(2004);
    });

    it("sets nextPaymentDue to block.timestamp at registration", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      const block = await ethers.provider.getBlock("latest");
      const emp   = await vault.getEmployee(0);
      expect(emp.nextPaymentDue).to.equal(BigInt(block!.timestamp));
    });
  });

  // ── Group 3: deactivateEmployee() ────────────────────────────────────────
  describe("deactivateEmployee()", function () {
    it("sets active = false", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      await vault.deactivateEmployee(0);
      expect((await vault.getEmployee(0)).active).to.be.false;
    });

    it("emits EmployeeDeactivated", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      await expect(vault.deactivateEmployee(0))
        .to.emit(vault, "EmployeeDeactivated")
        .withArgs(0n);
    });

    it("reverts if already inactive", async function () {
      const { vault, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      await vault.deactivateEmployee(0);
      await expect(vault.deactivateEmployee(0)).to.be.revertedWith("Already inactive");
    });

    it("reverts if caller not owner", async function () {
      const { vault, USDC_ADDRESS, alice, stranger } = await loadFixture(deployPayrollVaultFixture);
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 100n, 0);
      await expect(vault.connect(stranger).deactivateEmployee(0))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  // ── Group 4: runPayroll() ─────────────────────────────────────────────────
  describe("runPayroll()", function () {
    it("calls computePayroll with all active employees' data", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault, mockScheduler, USDC_ADDRESS, alice, bob } = f;
      const salary = ethers.parseUnits("500", 6);
      await f.mockUsdc.approve(await vault.getAddress(), salary * 20n);
      await vault.deposit(USDC_ADDRESS, salary * 20n);
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await vault.registerEmployee(bob.address,   salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      // scheduler returns empty — we just want to check inputs
      await mockScheduler.setEmpty();

      await vault.runPayroll();

      expect(await mockScheduler.callCount()).to.equal(1n);
      expect(await mockScheduler.getLastEmployeesLength()).to.equal(2n);
      expect(await mockScheduler.lastEmployees(0)).to.equal(alice.address);
      expect(await mockScheduler.lastEmployees(1)).to.equal(bob.address);
      expect(await mockScheduler.lastSalaries(0)).to.equal(salary);
      expect(await mockScheduler.lastSalaries(1)).to.equal(salary);
    });

    it("with empty due list: exits without calling XCM", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault, mockXcm, mockScheduler, USDC_ADDRESS, alice } = f;
      await f.mockUsdc.approve(await vault.getAddress(), ethers.parseUnits("1000", 6));
      await vault.deposit(USDC_ADDRESS, ethers.parseUnits("1000", 6));
      await vault.registerEmployee(alice.address, 100n, USDC_ADDRESS, INTERVAL, 1000n, 0);
      await mockScheduler.setEmpty();

      await vault.runPayroll();

      expect(await mockXcm.executeCallCount()).to.equal(0n);
      expect(await mockXcm.sendCallCount()).to.equal(0n);
    });

    it("Hub employee (parachainId=0): calls execute(), never calls send()", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault, mockXcm } = f;
      await setupWithOneHubEmployee(f, ethers.parseUnits("100", 6), 0, f.alice.address);

      await vault.runPayroll();

      expect(await mockXcm.executeCallCount()).to.equal(1n);
      expect(await mockXcm.sendCallCount()).to.equal(0n);
    });

    it("Non-Hub employee (parachainId=2004): calls send(), never calls execute()", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault, mockXcm } = f;
      await setupWithOneHubEmployee(f, ethers.parseUnits("100", 6), 2004, f.bob.address);

      await vault.runPayroll();

      expect(await mockXcm.executeCallCount()).to.equal(0n);
      expect(await mockXcm.sendCallCount()).to.equal(1n);
    });

    it("Mixed roster: 2 Hub + 1 Moonbeam — correct execute vs send counts", async function () {
      const { vault, mockUsdc, mockXcm, mockScheduler, owner, alice, bob, carol, USDC_ADDRESS } =
        await loadFixture(deployPayrollVaultFixture);

      const salary = ethers.parseUnits("100", 6);
      await mockUsdc.approve(await vault.getAddress(), salary * 20n);
      await vault.deposit(USDC_ADDRESS, salary * 20n);

      // alice = Hub (0), carol = Hub (0), bob = Moonbeam (2004)
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await vault.registerEmployee(carol.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await vault.registerEmployee(bob.address,   salary, USDC_ADDRESS, INTERVAL, salary * 10n, 2004);

      await mockScheduler.setReturnValues(
        [alice.address, carol.address, bob.address],
        [salary, salary, salary]
      );

      await vault.runPayroll();

      expect(await mockXcm.executeCallCount()).to.equal(2n);
      expect(await mockXcm.sendCallCount()).to.equal(1n);
    });

    it("updates nextPaymentDue for all paid employees", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault } = f;
      await setupWithOneHubEmployee(f, ethers.parseUnits("100", 6), 0, f.alice.address);

      const before = await vault.getEmployee(0);
      const T0 = before.nextPaymentDue;

      await vault.runPayroll();

      const after = await vault.getEmployee(0);
      expect(after.nextPaymentDue).to.equal(T0 + BigInt(INTERVAL));
    });

    it("reverts if vault balance insufficient", async function () {
      const { vault, mockUsdc, mockScheduler, USDC_ADDRESS, alice } =
        await loadFixture(deployPayrollVaultFixture);

      const salary  = ethers.parseUnits("100", 6);
      const deposit = ethers.parseUnits("50", 6);    // only 50, salary is 100
      await mockUsdc.approve(await vault.getAddress(), deposit);
      await vault.deposit(USDC_ADDRESS, deposit);
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await mockScheduler.setReturnValues([alice.address], [salary]);

      await expect(vault.runPayroll()).to.be.revertedWith("Insufficient vault balance");
    });

    it("emits PayrollExecuted with correct employeeCount and totalPayout", async function () {
      const f = await loadFixture(deployPayrollVaultFixture);
      const { vault } = f;
      const salary = ethers.parseUnits("100", 6);
      await setupWithOneHubEmployee(f, salary, 0, f.alice.address);

      await expect(vault.runPayroll())
        .to.emit(vault, "PayrollExecuted")
        .withArgs(1n, salary);
    });

    it("only passes ACTIVE employees to scheduler", async function () {
      const { vault, mockUsdc, mockScheduler, USDC_ADDRESS, alice, bob, carol } =
        await loadFixture(deployPayrollVaultFixture);

      const salary = ethers.parseUnits("100", 6);
      await mockUsdc.approve(await vault.getAddress(), salary * 20n);
      await vault.deposit(USDC_ADDRESS, salary * 20n);

      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await vault.registerEmployee(bob.address,   salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);
      await vault.registerEmployee(carol.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);

      // Deactivate carol
      await vault.deactivateEmployee(2);
      await mockScheduler.setEmpty();

      await vault.runPayroll();

      // Only alice and bob should be in the scheduler call
      expect(await mockScheduler.getLastEmployeesLength()).to.equal(2n);
      expect(await mockScheduler.lastEmployees(0)).to.equal(alice.address);
      expect(await mockScheduler.lastEmployees(1)).to.equal(bob.address);
    });

    it("exits cleanly with no XCM calls when no active employees exist", async function () {
      const { vault, mockXcm } = await loadFixture(deployPayrollVaultFixture);
      // No employees registered
      await vault.runPayroll();
      expect(await mockXcm.executeCallCount()).to.equal(0n);
      expect(await mockXcm.sendCallCount()).to.equal(0n);
    });
  });

  // ── Group 5: Reentrancy guard ─────────────────────────────────────────────
  describe("reentrancy guard", function () {
    it("runPayroll() blocks reentrant calls via scheduler callback", async function () {
      const { mockUsdc, USDC_ADDRESS, alice } = await loadFixture(deployPayrollVaultFixture);
      const [owner] = await ethers.getSigners();

      // Step 1: deploy the reentrant scheduler with no vault yet
      const ReentrantF = await ethers.getContractFactory("ReentrantScheduler");
      const reentrant  = await ReentrantF.deploy();

      // Step 2: deploy the vault pointing to the reentrant scheduler
      const VaultF = await ethers.getContractFactory("PayrollVault");
      const vault  = await VaultF.deploy(await reentrant.getAddress());

      // Step 3: complete the circular reference
      await reentrant.setVault(await vault.getAddress());

      // Step 4: fund vault so runPayroll() doesn't exit early on balance check
      const salary = ethers.parseUnits("10", 6);
      await mockUsdc.mint(owner.address, salary * 10n);
      await mockUsdc.approve(await vault.getAddress(), salary * 10n);
      await vault.deposit(USDC_ADDRESS, salary * 10n);
      await vault.registerEmployee(alice.address, salary, USDC_ADDRESS, INTERVAL, salary * 10n, 0);

      // runPayroll() → reentrant scheduler calls runPayroll() again → ReentrancyGuard reverts
      await expect(vault.runPayroll()).to.be.reverted;
    });
  });

  // ── Group 6: vaultBalance() ───────────────────────────────────────────────
  describe("vaultBalance()", function () {
    it("returns correct balance after deposit", async function () {
      const { vault, mockUsdc, USDC_ADDRESS } = await loadFixture(deployPayrollVaultFixture);
      const amount = ethers.parseUnits("2500", 6);
      await mockUsdc.approve(await vault.getAddress(), amount);
      await vault.deposit(USDC_ADDRESS, amount);
      expect(await vault.vaultBalance(USDC_ADDRESS)).to.equal(amount);
    });

    it("returns 0 for token with no deposits", async function () {
      const { vault, mockUsdc } = await loadFixture(deployPayrollVaultFixture);
      // Deploy a second token, never deposit it
      const MockERC20F = await ethers.getContractFactory("MockERC20");
      const otherToken = await MockERC20F.deploy("Other", "OTH", 18);
      expect(await vault.vaultBalance(await otherToken.getAddress())).to.equal(0n);
    });
  });
});
