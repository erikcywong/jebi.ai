// 链上逻辑验证：购买 / 履行铸造仓单（含 URI 回退）/ 取消退款 / 防重入与权限
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Jebi Coffee chain contracts (v2)", function () {
  let owner, buyer;
  let jbp, cwr, rpt;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    const JBP = await ethers.getContractFactory("JebiPoint");
    jbp = await JBP.deploy();
    await jbp.waitForDeployment();
    await (await jbp.addMinter(owner.address)).wait();

    const CWR = await ethers.getContractFactory("CoffeeWarehouseReceipt");
    cwr = await CWR.deploy();
    await cwr.waitForDeployment();

    const RPT = await ethers.getContractFactory("RoastPackageToken");
    rpt = await RPT.deploy(await jbp.getAddress());
    await rpt.waitForDeployment();
    await (await rpt.setWarehouse(await cwr.getAddress())).wait();
    await (await cwr.addMinter(await rpt.getAddress())).wait(); // 授权 RPT 铸造仓单（履行后铸造）
    await (await cwr.addMinter(owner.address)).wait();          // 授权平台管理员铸造原始批次
  });

  // 铸造一个 250g 烘焙包并给买家 5000 JBP + 授权
  async function mintAndFund(price = 1200) {
    await (await rpt.mintPackage(owner.address, 250, "Yirgacheffe", "medium-01", price, "ipfs://roast-001.json")).wait();
    await (await jbp.mint(buyer.address, 5000, "test-seed")).wait();
    await (await jbp.connect(buyer).approve(await rpt.getAddress(), price)).wait();
    return 1; // tokenId
  }

  it("only minters can mint JBP", async function () {
    await expect(jbp.connect(buyer).mint(buyer.address, 100, "x"))
      .to.be.revertedWith("JBP: not authorized minter");
  });

  it("purchase transfers NFT and JBP", async function () {
    const tokenId = await mintAndFund();
    await rpt.connect(buyer).purchasePackage(tokenId);

    expect(await rpt.ownerOf(tokenId)).to.equal(buyer.address);
    expect(await jbp.balanceOf(buyer.address)).to.equal(5000n - 1200n);
    expect(await jbp.balanceOf(await rpt.getAddress())).to.equal(1200n); // 托管在合约内
    expect((await rpt.packages(tokenId)).status).to.equal(1n); // Purchased
  });

  it("rejects double purchase", async function () {
    const tokenId = await mintAndFund();
    await rpt.connect(buyer).purchasePackage(tokenId);
    // NFT 已不在平台名下
    await expect(rpt.connect(buyer).purchasePackage(tokenId))
      .to.be.revertedWith("JRP: package not listed for sale");
  });

  it("fulfill mints warehouse receipt with fallback URI", async function () {
    const tokenId = await mintAndFund();
    await rpt.connect(buyer).purchasePackage(tokenId);
    await rpt.fulfillPackage(tokenId);

    expect((await rpt.packages(tokenId)).status).to.equal(3n); // Fulfilled

    const batchId = await cwr.batchCounter();
    expect(batchId).to.equal(1n);
    expect(await cwr.balanceOf(buyer.address, batchId)).to.equal(250n); // 250 克
    // 烘焙包元数据 URI 传播到仓单（自定义 URI 优先）
    expect(await cwr.uri(batchId)).to.equal("ipfs://roast-001.json");

    // 修正点：无自定义 URI 的批次回退到 baseURI + id + .json
    await (await cwr.mintBatch(buyer.address, 100, "CCRC-TEST", "")).wait();
    expect(await cwr.uri(2)).to.equal("https://api.jebi.one/metadata/2.json");
  });

  it("cancel refunds JBP and burns NFT", async function () {
    const tokenId = await mintAndFund();
    await rpt.connect(buyer).purchasePackage(tokenId);
    await rpt.cancelPackage(tokenId);

    expect(await jbp.balanceOf(buyer.address)).to.equal(5000n); // 全额退款
    expect(await rpt.packageExists(tokenId)).to.equal(false);
    await expect(rpt.ownerOf(tokenId)).to.be.reverted;
  });

  it("owner can withdraw escrowed JBP", async function () {
    const tokenId = await mintAndFund();
    await rpt.connect(buyer).purchasePackage(tokenId);
    await rpt.withdrawJBP(1200);
    expect(await jbp.balanceOf(await rpt.getAddress())).to.equal(0n);
    expect(await jbp.balanceOf(owner.address)).to.equal(1200n);
  });

  it("cannot fulfill a package that was not purchased", async function () {
    await (await rpt.mintPackage(owner.address, 250, "Yirgacheffe", "medium-01", 1200, "ipfs://x.json")).wait();
    await expect(rpt.fulfillPackage(1)).to.be.revertedWith("JRP: package not purchased");
  });
});