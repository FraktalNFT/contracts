const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()

async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

///
//   const FraktalFactory = await ethers.getContractFactory("FraktalFactory");
//   const fraktalFactory = await upgrades.deployProxy(FraktalFactory, [deployer.address,deployer.address]);
//   await fraktalFactory.deployed();
//   console.log("FraktalFactory deployed to:", fraktalFactory.address);
    ///


    let proxyAddress = "0x5DF977d385254D9a66ab8cD35e87E1E0c419b135";


    const newMarket = await ethers.getContractFactory("FraktalFactoryV2");
    const upgradedMarket = await upgrades.upgradeProxy(proxyAddress, newMarket);
    console.log("Market upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });