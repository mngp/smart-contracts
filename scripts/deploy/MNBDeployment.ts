import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const signerAccount = signers[0];
  console.log(`Signer account : ${signerAccount.address}`);

  // We get the contract to deploy
  const tokenErc20 = await ethers.getContractFactory("MNBERC20", {
    signer: signerAccount
  });

  // Constructor arguments
  const tokenName = "MN Bridge";
  const tokenSymbol = "MNB";
  const initialSupply = 350_000_000; // Initial supply for current chain
  const supplyCap = 1_000_000_000; // 1 Billion supply

  // Deploy the contract
  const tokenErc20Contract = await tokenErc20.deploy(tokenName, tokenSymbol, initialSupply, supplyCap);

  // Wait contract deploy process for complete
  await tokenErc20Contract.deployed();

  console.log("ERC20 deployed to:", tokenErc20Contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
