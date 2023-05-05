import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const [signerAccount, fundReceiver] = signers;
  console.log(`Signer account : ${signerAccount.address}`);

  // Deploy pre-sale token
  const presaleTokenFactory = await ethers.getContractFactory("ERC20Token", {
    signer: signerAccount
  });
  const presaleToken = await presaleTokenFactory.deploy("MN Bridge - Presale Token", "MNB.p", 0);
  await presaleToken.deployed();
  console.log(`Pre-sale token deployed to: ${presaleToken.address}`);

  // Deploy pre-sale smart contract
  const factory = await ethers.getContractFactory("Presale", {
    signer: signerAccount
  });
  const contract = await factory.deploy(presaleToken.address, fundReceiver.address);
  await contract.deployed();

  // Set pre-sale contract as minter
  const MINTER_ROLE = await presaleToken.MINTER_ROLE();
  await presaleToken.connect(signerAccount).grantRole(MINTER_ROLE, contract.address);

  console.log("Pre-sale contract deployed to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
