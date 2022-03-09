const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const StakingPoolForUniswapV2Tokens = await hre.ethers.getContractFactory("StakingPoolForUniswapV2Tokens");

    // for testnet account
    // change for lp, frak, startblock for mainnet
    const lpAddress = "0x9A18671771a15CA42442F0970852670A3972A789";
    const frakAddress = "0x468065C8B00C7cB3cd6B9fD76dAe9dD49e1C30e0";
    const frakPerBlock = ethers.utils.parseEther("50");
    const startBlock = 10297503;
    const endBlock = startBlock+1000000;

    const stakingPoolLp = await StakingPoolForUniswapV2Tokens.deploy(
        lpAddress,
        frakAddress,
        frakPerBlock,
        startBlock,
        endBlock
        );
    console.log(`StakingPoolForUniswapV2Tokens deployed to: ${stakingPoolLp.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });