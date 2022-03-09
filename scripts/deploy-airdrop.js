const { ethers, upgrades } = require('hardhat')
const hre = require("hardhat");

require('dotenv').config()


async function main(){
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const FraktalAirdrop = await hre.ethers.getContractFactory("FraktalAirdrop");

    // for testnet account
    // change for lp, frak, startblock for mainnet
    const startTimestamp = 1647518400;
    const endTimestamp = 1648382400;
    const maxClaim = ethers.utils.parseEther("10000");
    const fraktalAddress = "0x468065C8B00C7cB3cd6B9fD76dAe9dD49e1C30e0";
    const marketAddress = "0x1379cf637fc4cf09D89CDc9131C38DD4dd15D1c7";
    const merkleRoot = "0x8dfab5f1445c86bab8ddecc22981110b60bb14aa0e326226e3974785643a4e57";

    const fraktalAirdrop = await FraktalAirdrop.deploy(
        startTimestamp,
        endTimestamp,
        maxClaim,
        fraktalAddress,
        marketAddress,
        merkleRoot
        );
    console.log(`FraktalAirdrop deployed to: ${fraktalAirdrop.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });