import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const [signerAccount, fundReceiver] = signers;
  console.log(`Signer account : ${signerAccount.address}`);

  // Deploy contract
  const contractFactory = await ethers.getContractFactory("PresaleClaim", {
    signer: signerAccount
  });
  const contract = await contractFactory.deploy("0xa922a70569a7555518bF4DED5094661a965E23cA", "0xbe84AF8f35C04943B9e82F601485FF2d6c0c6f2a");
  await contract.deployed();
  console.log(`Contract deployed to: ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
