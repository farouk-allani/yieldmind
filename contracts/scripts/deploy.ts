import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying YieldMindVault to Hedera Testnet...\n");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  // Deploy the contract
  const VaultFactory = await ethers.getContractFactory("YieldMindVault");
  const vault = await VaultFactory.deploy();
  await vault.waitForDeployment();

  const contractAddress = await vault.getAddress();
  console.log("✅ YieldMindVault deployed at:", contractAddress);
  console.log(
    "🔗 HashScan:",
    `https://hashscan.io/testnet/contract/${contractAddress}`
  );

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deployment = {
    contract: "YieldMindVault",
    address: contractAddress,
    deployer: deployer.address,
    network: "hederaTestnet",
    chainId: 296,
    timestamp: new Date().toISOString(),
    txHash: vault.deploymentTransaction()?.hash || "unknown",
  };

  const deploymentPath = path.join(deploymentsDir, "hederaTestnet.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentPath);

  // Remind user to update .env
  console.log("\n⚠️  Add this to your .env and web/.env:");
  console.log(`NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
