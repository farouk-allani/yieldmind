import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("YieldMindVault", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    const VaultFactory = await ethers.getContractFactory("YieldMindVault");
    const vault = await VaultFactory.deploy();
    await vault.waitForDeployment();

    // Generate a strategy ID (same way frontend will)
    const strategyId = ethers.keccak256(
      ethers.toUtf8Bytes("conservative-bonzo-usdc")
    );
    const strategyId2 = ethers.keccak256(
      ethers.toUtf8Bytes("aggressive-bonzo-whbar")
    );

    return { vault, owner, user1, user2, strategyId, strategyId2 };
  }

  describe("Deposit", function () {
    it("should accept HBAR deposits for a strategy", async function () {
      const { vault, user1, strategyId } = await loadFixture(deployFixture);
      const depositAmount = ethers.parseEther("10"); // 10 HBAR

      await expect(
        vault
          .connect(user1)
          .deposit(strategyId, "Bonzo USDC Vault", { value: depositAmount })
      )
        .to.emit(vault, "Deposited")
        .withArgs(user1.address, strategyId, depositAmount, "Bonzo USDC Vault");

      expect(await vault.getDeposit(strategyId, user1.address)).to.equal(
        depositAmount
      );
      expect(await vault.userTotals(user1.address)).to.equal(depositAmount);
      expect(await vault.totalValueLocked()).to.equal(depositAmount);
    });

    it("should accumulate deposits for same strategy", async function () {
      const { vault, user1, strategyId } = await loadFixture(deployFixture);
      const amount1 = ethers.parseEther("5");
      const amount2 = ethers.parseEther("3");

      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", { value: amount1 });
      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", { value: amount2 });

      expect(await vault.getDeposit(strategyId, user1.address)).to.equal(
        amount1 + amount2
      );
      expect(await vault.totalValueLocked()).to.equal(amount1 + amount2);
    });

    it("should track deposits across multiple strategies", async function () {
      const { vault, user1, strategyId, strategyId2 } =
        await loadFixture(deployFixture);
      const amount1 = ethers.parseEther("10");
      const amount2 = ethers.parseEther("5");

      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", { value: amount1 });
      await vault
        .connect(user1)
        .deposit(strategyId2, "Bonzo WHBAR", { value: amount2 });

      expect(await vault.getDeposit(strategyId, user1.address)).to.equal(
        amount1
      );
      expect(await vault.getDeposit(strategyId2, user1.address)).to.equal(
        amount2
      );
      expect(await vault.userTotals(user1.address)).to.equal(
        amount1 + amount2
      );
      expect(await vault.totalValueLocked()).to.equal(amount1 + amount2);
    });

    it("should revert on zero deposit", async function () {
      const { vault, user1, strategyId } = await loadFixture(deployFixture);
      await expect(
        vault
          .connect(user1)
          .deposit(strategyId, "Bonzo USDC", { value: 0 })
      ).to.be.revertedWith("Deposit must be > 0");
    });
  });

  describe("Withdraw", function () {
    it("should allow partial withdrawal from a strategy", async function () {
      const { vault, user1, strategyId } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("10");
      const withdrawAmount = ethers.parseEther("4");

      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", { value: deposit });

      await expect(
        vault.connect(user1).withdraw(strategyId, withdrawAmount)
      )
        .to.emit(vault, "Withdrawn")
        .withArgs(user1.address, strategyId, withdrawAmount);

      expect(await vault.getDeposit(strategyId, user1.address)).to.equal(
        deposit - withdrawAmount
      );
      expect(await vault.totalValueLocked()).to.equal(
        deposit - withdrawAmount
      );
    });

    it("should revert on insufficient balance", async function () {
      const { vault, user1, strategyId } = await loadFixture(deployFixture);
      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", {
          value: ethers.parseEther("5"),
        });

      await expect(
        vault
          .connect(user1)
          .withdraw(strategyId, ethers.parseEther("10"))
      ).to.be.revertedWith("Insufficient strategy balance");
    });
  });

  describe("Emergency Withdraw", function () {
    it("should withdraw all user funds", async function () {
      const { vault, user1, strategyId, strategyId2 } =
        await loadFixture(deployFixture);
      const amount1 = ethers.parseEther("10");
      const amount2 = ethers.parseEther("5");

      await vault
        .connect(user1)
        .deposit(strategyId, "Bonzo USDC", { value: amount1 });
      await vault
        .connect(user1)
        .deposit(strategyId2, "Bonzo WHBAR", { value: amount2 });

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      const tx = await vault.connect(user1).emergencyWithdraw();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // User should have received back amount1 + amount2, minus gas
      expect(balanceAfter + gasCost - balanceBefore).to.equal(
        amount1 + amount2
      );
      expect(await vault.userTotals(user1.address)).to.equal(0);
      expect(await vault.totalValueLocked()).to.equal(0);
    });

    it("should revert when no funds to withdraw", async function () {
      const { vault, user1 } = await loadFixture(deployFixture);
      await expect(
        vault.connect(user1).emergencyWithdraw()
      ).to.be.revertedWith("No funds to withdraw");
    });
  });
});
