import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Presale", function() {
  // Constructor arguments

  let MINTER_ROLE: string;
  let USDT: Contract;
  let MNBp: Contract;
  let preSale: Contract;
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;
  let fundReceiver: SignerWithAddress;

  beforeEach(async function() {
    [deployer, account1, account2, fundReceiver] = await ethers.getSigners();

    // We get the contract to deploy
    const erc20Factory = await ethers.getContractFactory("ERC20Token");

    // Deploy the contract
    USDT = await erc20Factory.deploy("Tether USD", "USDT", 50_000_000);

    // Wait contract deploy process for complete
    await USDT.deployed();

    // We get the contract to deploy
    const mnbErc20Factory = await ethers.getContractFactory("MNBERC20");

    // Deploy the contract
    MNBp = await mnbErc20Factory.deploy("MN Bridge - Presale", "MNB.p", 0, 50_000_000);

    // Wait contract deploy process for complete
    await MNBp.deployed();

    // Deploy pre-sale contract
    const presaleFactory = await ethers.getContractFactory("Presale");
    preSale = await presaleFactory.deploy(MNBp.address, fundReceiver.address);
    await preSale.deployed();

    // Grant pre-sale contract as a MINTER_ROLE
    MINTER_ROLE = await MNBp.MINTER_ROLE();
    await MNBp.grantRole(MINTER_ROLE, preSale.address);

    // Give allowance to pre-sale contract
    await USDT.transfer(account1.address, 25000);
    await USDT.connect(account1).approve(preSale.address, 25000);
  });

  it("Basic Functionalities", async function() {
    await expect(await preSale.getFundReceiver(), "Fund receiver account").to.equal(fundReceiver.address);
    await expect(await preSale.getAsset(), "Get asset for presale").to.equal(MNBp.address);

    await preSale.setFundReceiver(account2.address);
    await expect(await preSale.getFundReceiver(), "Fund receiver change").to.equal(account2.address);

    // Ownable access control check
    await expect(
      preSale.connect(account1).setFundReceiver(account2.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Pair functionality", async function() {
    await expect(await preSale.pairCounter(), "Pair counter").to.equal(0);
    await expect(await preSale.globalAssetCounter(), "Global asset counter").to.equal(0);

    const pairs = [{
      minContribution: 10_00000000,
      maxContribution: 5000_00000000,
      lotSize: 1_00000000,
      lotPrice: 1000000,
      saleCap: 1500_00000000,
      isActive: true,
    }];

    const saleStart = Math.floor((new Date()).getTime() / 1000) - 100;
    const saleEnd = Math.floor((new Date()).getTime() / 1000) + 100;
    await preSale.createPair(USDT.address, pairs[0].minContribution, pairs[0].maxContribution, pairs[0].lotSize, pairs[0].lotPrice, saleStart, saleEnd, pairs[0].saleCap, pairs[0].isActive);

    const cPair = await preSale.pairs(0);

    //region Pair information
    await expect(cPair._exist, "Pair exist").to.equal(true);
    await expect(cPair.quoteAsset, "Pair quote asset").to.equal(USDT.address);
    await expect(cPair.minContribution, "Min contribution").to.equal(pairs[0].minContribution);
    await expect(cPair.maxContribution, "Max contribution").to.equal(pairs[0].maxContribution);
    await expect(cPair.lotSize, "Lot size").to.equal(pairs[0].lotSize);
    await expect(cPair.lotPrice, "Lot price").to.equal(pairs[0].lotPrice);
    await expect(cPair.saleStart, "Sale start date").to.equal(saleStart);
    await expect(cPair.saleEnd, "Sale end date").to.equal(saleEnd);
    await expect(cPair.saleCap, "Sale asset cap").to.equal(pairs[0].saleCap);
    await expect(cPair.isActive, "Sale is active").to.equal(pairs[0].isActive);
    //endregion

    await expect(await preSale.pairCounter(), "Pair counter").to.equal(1);
  });

  it("Buy / Mint functionality", async function() {
    const nowTime = Math.floor((new Date()).getTime() / 1000);
    await preSale.createPair(USDT.address, 10, 5000, 1, 5, (nowTime - 200), (nowTime + 200), 6000, true); // Pair 0 - Fully active
    await preSale.createPair(USDT.address, 10, 5000, 1, 5, (nowTime - 200), (nowTime + 200), 6000, false); // Pair 1 - Sale is not active
    await preSale.createPair(USDT.address, 10, 5000, 1, 5, (nowTime - 200), (nowTime - 10), 6000, true); // Pair 2 - Sale active but not in sale dates
    await preSale.createPair(USDT.address, 10, 5000, 1, 5, (nowTime - 200), (nowTime + 200), 1000, true); // Pair 3 - Fully active but sale cap is low

    //region Non-existence | Disabled pair / Time checks
    await expect(
      preSale.buyAsset(77, 25),
      "Try to buy non-exist pair"
    ).to.be.revertedWith("Pair is not exist or disabled");

    await expect(
      preSale.buyAsset(1, 25),
      "Try to buy passive pair"
    ).to.be.revertedWith("Pair is not exist or disabled");

    await expect(
      preSale.buyAsset(2, 25),
      "Try to buy time over pair"
    ).to.be.revertedWith("Pair is not sale period for now");
    //endregion

    //region Buy below min / over max contribution limits
    await expect(
      preSale.buyAsset(0, 5),
      "Try to buy below min contribution"
    ).to.be.revertedWith("Contribution amount is too low");

    await expect(
      preSale.buyAsset(0, 7500),
      "Try to buy over max contribution"
    ).to.be.revertedWith("Contribution amount is too high");

    await expect(
      preSale.buyAsset(3, 7500),
      "Try to buy over sale cap"
    ).to.be.revertedWith("Sale cap exceeds");
    //endregion

    await preSale.connect(account1).buyAsset(0, 22); // Should be buy `4` asset with `20` quote asset
    const remainingMaxContribution = await preSale.accountMaxContribution(0, account1.address);

    await expect(remainingMaxContribution, "Max contribution after buy").to.equal(4980);
    await expect(await preSale.globalAssetCounter(), "Global asset counter after buy").to.equal(4);
    await expect(await USDT.balanceOf(fundReceiver.address), "Fund receiver quote asset check").to.equal(20);
    await expect(await MNBp.balanceOf(account1.address), "Buyer asset balance check").to.equal(4);
    await expect(await preSale.connect(account1).buyAsset(0, 20), "Emit check").to.emit(preSale, "NewSell").withArgs(0, 4, 20);
  });

});
