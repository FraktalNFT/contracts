// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run('compile');

  // We get the contract to deploy
  const TokenLogicContract = await hre.ethers.getContractFactory("FraktalNFT");
  const logicContract = await TokenLogicContract.deploy();
  await logicContract.deployed();
  console.log("FraktalNFT deployed to:", logicContract.address);
  const MarketContract = await hre.ethers.getContractFactory("FraktalMarket");
  const marketContract = await MarketContract.deploy(logicContract.address);
  await marketContract.deployed();
  console.log("Market deployed to:", marketContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
