import { expect } from "chai";
import { ethers } from "hardhat";

describe("MNGBSwap", function() {
  let MNGBSwapFactory;
  let mngbSwap;
  let tokenIn;
  let tokenOut;
  let owner;
  let account1;
  let account2;

  const tokenInLotSize = 100;
  const tokenOutLotSize = 200;
  const initialSwapLimit = 1000;
  const swapAmount = 301;

  beforeEach(async function() {
    MNGBSwapFactory = await ethers.getContractFactory("MNGBSwap");
    [owner, account1, account2] = await ethers.getSigners();

    tokenIn = await deployToken("T1", "T1", 50_000);
    tokenOut = await deployToken("T2", "T2", 30_000);

    await tokenIn.deployed();
    await tokenOut.deployed();

    mngbSwap = await MNGBSwapFactory.deploy(tokenIn.address, tokenOut.address, tokenInLotSize, tokenOutLotSize);
    await mngbSwap.deployed();

    await tokenOut.mint(mngbSwap.address, 100_000);

    await tokenIn.connect(owner).approve(mngbSwap.address, initialSwapLimit);
    await tokenIn.mint(account1.address, initialSwapLimit);
    await tokenIn.connect(account1).approve(mngbSwap.address, initialSwapLimit);
  });

  async function deployToken(name, symbol, supply) {
    const Token = await ethers.getContractFactory("ERC20Token");
    return await Token.deploy(name, symbol, supply);
  }

  it("should set the initial values correctly", async function() {
    expect(await mngbSwap.tokenIn()).to.equal(tokenIn.address);
    expect(await mngbSwap.tokenOut()).to.equal(tokenOut.address);
    expect(await mngbSwap.tokenInLotSize()).to.equal(tokenInLotSize);
    expect(await mngbSwap.tokenOutLotSize()).to.equal(tokenOutLotSize);
  });

  it("should calculate input and output amounts correctly", async function() {
    const [amountIn, amountOut] = await mngbSwap.calculateInOut(swapAmount);
    expect(amountIn).to.equal(300);
    expect(amountOut).to.equal(600);
  });

  it("should update stats and limits correctly", async function() {
    await mngbSwap.connect(owner).setAccountSwapLimit(account1.address, 400);
    await mngbSwap.connect(account1).swap(swapAmount);

    const account1Stats = await mngbSwap.accountStats(account1.address);
    expect(account1Stats.tokenIn).to.equal(300);
    expect(account1Stats.tokenOut).to.equal(600);
    expect(account1Stats.swapCounter).to.equal(1);

    const generalStats = await mngbSwap.stats();
    expect(generalStats.tokenIn).to.equal(300);
    expect(generalStats.tokenOut).to.equal(600);
    expect(generalStats.swapCounter).to.equal(1);

    const account1Limit = await mngbSwap.swapLimit(account1.address);
    expect(account1Limit).to.equal(100);
  });

  it("should allow the owner to set account swap limit", async function() {
    await mngbSwap.setAccountSwapLimit(account1.address, 500);
    const account1Limit = await mngbSwap.swapLimit(account1.address);
    expect(account1Limit).to.equal(500);
  });

  it("should allow the owner to withdraw tokens", async function() {
    await mngbSwap.connect(owner).setAccountSwapLimit(account1.address, 400);
    const ownerInitialBalances = {
      tokenIn: (await tokenIn.balanceOf(owner.address)),
      tokenOut: (await tokenOut.balanceOf(owner.address)),
    };
    await mngbSwap.connect(account1).swap(swapAmount);


    await mngbSwap.withdraw(tokenOut.address, 300);

    const finalBalance = await tokenOut.balanceOf(owner.address);
    expect(finalBalance).to.equal(ownerInitialBalances.tokenOut.add(300));
  });
});
