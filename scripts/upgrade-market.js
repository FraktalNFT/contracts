const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()
const proxyAddress = "0x392EC06440a8107fA417fBA89DacE8ce005Ed318";


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());


    const newMarket = await ethers.getContractFactory("FraktalMarketV1_1");
    const upgradedMarket = await upgrades.upgradeProxy(proxyAddress, newMarket);
    console.log("Market upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });