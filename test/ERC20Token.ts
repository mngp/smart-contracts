import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ERC20Token", function() {
  // Constructor arguments
  const tokenName = "Dummy Token";
  const tokenSymbol = "DMY";
  const initialSupply = 5_000; // Initial supply for current chain
  const supplyCap = 25_000; // 1 Billion supply

  let erc20: Contract;
  let erc20Factory: ContractFactory;
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;

  beforeEach(async function() {
    [deployer, account1] = await ethers.getSigners();

    // We get the contract to deploy
    erc20Factory = await ethers.getContractFactory("ERC20Token");

    // Deploy the contract
    erc20 = await erc20Factory.deploy(tokenName, tokenSymbol, initialSupply, supplyCap);

    // Wait contract deploy process for complete
    await erc20.deployed();
  });

  it("Basic ERC20 Parameters", async function() {
    await expect(await erc20.decimals(), "Token decimals").to.equal(8);
    await expect(await erc20.name(), "Token name").to.equal(tokenName);
    await expect(await erc20.symbol(), "Token symbol").to.equal(tokenSymbol);
  });

  it("Owner Balance / Total Supply / Update balances after transfers", async function() {
    const ownerBalance = await erc20.balanceOf(deployer.address);
    await expect(await erc20.totalSupply(), "Total supply").to.equal(ownerBalance);

    // Transfer to account1
    await erc20.transfer(account1.address, 300);

    // Balance checks
    const finalOwnerBalance = await erc20.balanceOf(deployer.address);
    await expect(finalOwnerBalance).to.equal(ownerBalance.sub(300));

    const acc1Balance = await erc20.balanceOf(account1.address);
    await expect(acc1Balance).to.equal(300);
  });

  it("Mint / Burn Functionality", async function() {
    const ownerBalance = await erc20.balanceOf(deployer.address);

    await erc20.burn(500);
    await expect(await erc20.balanceOf(deployer.address), "Burn").to.equal(ownerBalance.sub(500));

    await erc20.mint(deployer.address, 500);
    await expect(await erc20.balanceOf(deployer.address), "Mint").to.equal(ownerBalance);
  });

  it("Supply Cap Functionality", async function() {
    const mintedSupply = await erc20.totalSupply();
    const cap = await erc20.cap();
    const mintableSupply = cap.sub(mintedSupply);

    // Mint with deployer address
    await erc20.connect(deployer).mint(deployer.address, mintableSupply);
    await expect(await erc20.totalSupply()).to.equal(cap);

    // Should be reverted with "Cap exceeded"
    await expect(
      erc20.connect(deployer).mint(deployer.address, 100)
    ).to.be.revertedWith("SupplyCap: cap exceeded");
  });

  it("Access Control Functionality", async function() {
    const minterRole = await erc20.MINTER_ROLE();

    // Initial minter role check
    await expect(await erc20.hasRole(minterRole, deployer.address)).to.equal(true);
    await expect(await erc20.hasRole(minterRole, account1.address)).to.equal(false);

    // Grant role check
    await erc20.connect(deployer).grantRole(minterRole, account1.address);
    await expect(await erc20.hasRole(minterRole, account1.address)).to.equal(true);

    // Renounce role check
    await erc20.connect(account1).renounceRole(minterRole, account1.address);
    await expect(await erc20.hasRole(minterRole, account1.address)).to.equal(false);

    // Revoke role check (From role admin)
    await erc20.connect(deployer).grantRole(minterRole, account1.address);
    await expect(await erc20.hasRole(minterRole, account1.address)).to.equal(true);
    await erc20.connect(deployer).revokeRole(minterRole, account1.address);
    await expect(await erc20.hasRole(minterRole, account1.address)).to.equal(false);
  });

});
