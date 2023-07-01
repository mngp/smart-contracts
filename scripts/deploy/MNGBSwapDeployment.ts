import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const signerAccount = signers[0];
  console.log(`Signer account : ${signerAccount.address}`);

  // We get the contract to deploy
  const tokenErc20 = await ethers.getContractFactory("MNGBSwap", {
    signer: signerAccount
  });

  // Constructor arguments
  const tokenIn = "0x13DfE44c7B461222e10597E517e4485Ff4766582"; // MNG
  const tokenOut = "0xa922a70569a7555518bF4DED5094661a965E23cA"; // MNB
  const inLotSize = 10; // Token-in lot size
  const outLotSize = 1; // Token-out lot size
  const tokenInReceiver = "0x72AE2DCC61E24D1DCa14b8BE4EAa6a1B9Fd26435";

  // Deploy the contract
  const contractFactory = await tokenErc20.deploy(tokenIn, tokenOut, inLotSize, outLotSize, tokenInReceiver);

  // Wait contract deploy process for complete
  await contractFactory.deployed();

  console.log("MNG - MNB Swap deployed to:", contractFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
