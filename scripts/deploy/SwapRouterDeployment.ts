import { ethers } from "hardhat";
import { SwapRouter } from "../../typechain-types";

async function main() {
  const signers = await ethers.getSigners();

  const signerAccount = signers[0];
  console.log(`Signer account : ${signerAccount.address}`);

  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory("SwapRouter", {
    signer: signerAccount
  });

  // Constructor arguments
  const feeReceiver = "0xa03A9566479130a2EFC918C6A726D030Dd17627F";
  const token = "0xa922a70569a7555518bF4DED5094661a965E23cA";
  const messageRelayer = "0xa03A9566479130a2EFC918C6A726D030Dd17627F";

  // Deploy the contract
  const routerContract = (await contractFactory.deploy(feeReceiver, token, messageRelayer) as SwapRouter);

  // Wait contract deploy process for complete
  await routerContract.deployed();

  console.log("Cross-chain Swap router deployed to:", routerContract.address);

  const config = {
    chainId: 1,
    swapFee: 15000000000000000,
    isActive: true
  };
  const setNetworkConfig = await routerContract.setTargetChainConfig(config.chainId, config.swapFee, config.isActive);
  console.log(`Network config updated. Config: ${JSON.stringify(config)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
