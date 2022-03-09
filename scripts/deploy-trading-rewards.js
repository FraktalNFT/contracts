const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const TradingRewardsDistributor = await hre.ethers.getContractFactory("TradingRewardsDistributor");

    // for testnet account
    // change for frak for mainnet
    const frakAddress = "0x468065C8B00C7cB3cd6B9fD76dAe9dD49e1C30e0";

    const tradingRewardsDistributor = await TradingRewardsDistributor.deploy(
        frakAddress
        );
    console.log(`TradingRewardsDistributor deployed to: ${tradingRewardsDistributor.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });