const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const FeeSharingSystem = await hre.ethers.getContractFactory("FeeSharingSystem");
    const MockFrak = await hre.ethers.getContractFactory("MockFrak");

    // for testnet account
    // change for fraktal token address on mainnet
    const mockFrak = await MockFrak.deploy();
    console.log(`MockFrak deployed to: ${mockFrak.address}`);

    const feeSharingSystem = await upgrades.deployProxy(FeeSharingSystem,[mockFrak.address]);
    console.log(`FeeSharingSystem deployed to: ${feeSharingSystem.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });