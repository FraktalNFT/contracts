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

    const StakingPoolForUniswapV2Tokens = await hre.ethers.getContractFactory("StakingPoolForUniswapV2Tokens");
    const FraktalAirdrop = await hre.ethers.getContractFactory("FraktalAirdrop");
    const FeeSharingSystem = await hre.ethers.getContractFactory("FeeSharingSystem");
    const FeeSharingSetter = await hre.ethers.getContractFactory("FeeSharingSetter");


    const fraktalNFT = await FraktalNFT.deploy();
    console.log(`FraktalNFT deployed to: ${fraktalNFT.address}`);

    const paymentSpliter = await PaymentSpliter.deploy();
    console.log(`PaymentSpliter deployed to: ${paymentSpliter.address}`);

    // const fraktalFactory = await FraktalFactory.deploy(fraktalNFT.address, paymentSpliter.address);
    const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalNFT.address, paymentSpliter.address]);//deploy by proxy(upgradable)
    console.log(`FraktalFactory deployed to: ${fraktalFactory.address}`);

    // const fraktalMarket = await FraktalMarket.deploy();
    const fraktalMarket = await upgrades.deployProxy(FraktalMarket,[]);//deploy by proxy(upgradable)
    console.log(`FraktalMarket deployed to: ${fraktalMarket.address}`);

    // console.log("Wait 1 min for etherscan to propagate deployed bytecode");
    // await new Promise(r=>setTimeout(r,60*1000));//wait 1 min
    // console.log("Verifying..");
    
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