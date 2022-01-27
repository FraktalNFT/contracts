const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const FraktalNFT = await hre.ethers.getContractFactory("FraktalNFT");
    const PaymentSpliter = await hre.ethers.getContractFactory("PaymentSplitterUpgradeable");
    const FraktalFactory = await hre.ethers.getContractFactory("FraktalFactory");
    const FraktalMarket = await hre.ethers.getContractFactory("FraktalMarket");

    const fraktalNFT = await FraktalNFT.deploy();
    console.log(`FraktalNFT deployed to: ${fraktalNFT.address}`);

    const paymentSpliter = await PaymentSpliter.deploy();
    console.log(`PaymentSpliter deployed to: ${paymentSpliter.address}`);

    const fraktalFactory = await FraktalFactory.deploy(fraktalNFT.address, paymentSpliter.address);
    console.log(`FraktalFactory deployed to: ${fraktalFactory.address}`);

    // const fraktalMarket = await FraktalMarket.deploy();
    const fraktalMarket = await upgrades.deployProxy(FraktalMarket,[]);//deploy by proxy(upgradable)
    console.log(`FraktalMarket deployed to: ${fraktalMarket.address}`);

    // await hre.run("verify:verify", {
    //   address: fraktalNFT.address,
    //   constructorArguments: [],
    // });
    // await hre.run("verify:verify", {
    //   address: paymentSpliter.address,
    //   constructorArguments: [],
    // });
    // await hre.run("verify:verify", {
    //   address: fraktalFactory.address,
    //   constructorArguments: [fraktalNFT.address,paymentSpliter.address],
    // });
    // await hre.run("verify:verify", {
    //   address: fraktalMarket.address,
    //   constructorArguments: [],
    // });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });