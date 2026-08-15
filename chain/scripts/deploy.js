// 部署脚本：JBP 积分台账 → 仓单 → 烘焙包 → 接线 + 示例数据
// 用法：npx hardhat run scripts/deploy.js --network localhost
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1) JBP 积分台账（联盟链存证，非代币）
  const JBP = await hre.ethers.getContractFactory("JebiPoint");
  const jbp = await JBP.deploy();
  await jbp.waitForDeployment();
  const jbpAddr = await jbp.getAddress();
  console.log("JebiPoint (JBP)      ->", jbpAddr);

  // 2) 咖啡豆数字仓单
  const CWR = await hre.ethers.getContractFactory("CoffeeWarehouseReceipt");
  const cwr = await CWR.deploy();
  await cwr.waitForDeployment();
  const cwrAddr = await cwr.getAddress();
  console.log("CoffeeWarehouseReceipt ->", cwrAddr);

  // 3) 烘焙包服务凭证
  const RPT = await hre.ethers.getContractFactory("RoastPackageToken");
  const rpt = await RPT.deploy(jbpAddr);
  await rpt.waitForDeployment();
  const rptAddr = await rpt.getAddress();
  console.log("RoastPackageToken    ->", rptAddr);

  // 接线：烘焙履行 → 仓单铸造（授权 RPT 为仓单 minter）；平台获得 JBP 发放权
  await (await rpt.setWarehouse(cwrAddr)).wait();
  await (await cwr.addMinter(rptAddr)).wait();
  await (await cwr.addMinter(deployer.address)).wait();
  await (await jbp.addMinter(deployer.address)).wait();

  // 示例数据：一仓批次（250kg）+ 两个烘焙包
  await (
    await cwr.mintBatch(deployer.address, 250000, "CCRC-2025-0001", "ipfs://QmX/warehouse-0001.json")
  ).wait();
  await (
    await rpt.mintPackage(deployer.address, 250, "Yirgacheffe", "medium-01", 1200, "ipfs://QmX/roast-001.json")
  ).wait();
  await (
    await rpt.mintPackage(deployer.address, 1000, "Colombia", "dark-02", 4200, "ipfs://QmX/roast-002.json")
  ).wait();
  console.log("Sample batch + 2 roast packages minted");

  const summary = {
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId), // BigInt -> number
    deployer: deployer.address,
    jebiPoint: jbpAddr,
    coffeeWarehouseReceipt: cwrAddr,
    roastPackageToken: rptAddr,
  };
  const out = path.join(__dirname, "deployment.json");
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log("Saved:", out);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});