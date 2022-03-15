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
    const TradingRewardsDistributor = await hre.ethers.getContractFactory("TradingRewardsDistributor");
    const FeeSharingSystem = await hre.ethers.getContractFactory("FeeSharingSystem");
    const FeeSharingSetter = await hre.ethers.getContractFactory("FeeSharingSetter");


    const frakAddress = "0x1f81f8f262714cc932141c7C79495B481eF27258";


    const fraktalNFT = await FraktalNFT.deploy();
    console.log(`FraktalNFT deployed to: ${fraktalNFT.address}`);

    const paymentSpliter = await PaymentSpliter.deploy();
    console.log(`PaymentSpliter deployed to: ${paymentSpliter.address}`);

    const fraktalAddress = "0x8F3D19eFE7c9e7411EC8B14e02c2699b5F669628";
    const paymentSplitterAddress = "0x65fD1b44f13222E6e3e5c722e104cb22AB24B4D8";

    // const fraktalFactory = await FraktalFactory.deploy(fraktalNFT.address, paymentSpliter.address);
    // const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalNFT.address, paymentSpliter.address]);//deploy by proxy(upgradable)
    const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalAddress, paymentSplitterAddress]);//deploy by proxy(upgradable)
    console.log(`FraktalFactory deployed to: ${fraktalFactory.address}`);

    // const fraktalMarket = await FraktalMarket.deploy();
    const fraktalMarket = await upgrades.deployProxy(FraktalMarket,[]);//deploy by proxy(upgradable)
    console.log(`FraktalMarket deployed to: ${fraktalMarket.address}`);

    //////////////////////////////////////////////// Airdrop//////////////////////////////////////////////
    const FraktalAirdrop = await hre.ethers.getContractFactory("FraktalAirdrop");

    // for testnet account
    // change for lp, frak, startblock for mainnet
    const startTimestamp = 1647518400;
    const endTimestamp = 1648382400;
    const maxClaim = ethers.utils.parseEther("10000");
    // const frakAddress = "0x468065C8B00C7cB3cd6B9fD76dAe9dD49e1C30e0";
    const marketAddress = fraktalMarket.address;
    const merkleRoot = "0x8dfab5f1445c86bab8ddecc22981110b60bb14aa0e326226e3974785643a4e57";

    const fraktalAirdrop = await FraktalAirdrop.deploy(
        startTimestamp,
        endTimestamp,
        maxClaim,
        frakAddress,
        marketAddress,
        merkleRoot
        );
    console.log(`FraktalAirdrop deployed to: ${fraktalAirdrop.address}`);

    ////////////////////////////////////////////////lp staking//////////////////////////////////////////////
    const lpAddress = "0x2763f944fc85CAEECD559F0f0a4667A68256144d";
    // const frakAddress = "0x468065C8B00C7cB3cd6B9fD76dAe9dD49e1C30e0";
    const frakPerBlock = ethers.utils.parseEther("50");
    //https://etherscan.io/block/countdown/14404250
    const startBlock = 14404250;
    const endBlock = startBlock+1000000;

    const stakingPoolLp = await StakingPoolForUniswapV2Tokens.deploy(
        lpAddress,
        frakAddress,
        frakPerBlock,
        startBlock,
        endBlock
        );
    console.log(`StakingPoolForUniswapV2Tokens deployed to: ${stakingPoolLp.address}`);

    ////////////////////////////////////////////////trading rewards//////////////////////////////////////////////

    const tradingRewardsDistributor = await TradingRewardsDistributor.deploy(
        frakAddress
        );
    console.log(`TradingRewardsDistributor deployed to: ${tradingRewardsDistributor.address}`);

    ////////////////////////////////////////////////fee sharing //////////////////////////////////////////////

    const feeSharingSystem = await upgrades.deployProxy(FeeSharingSystem,[frakAddress]);
    console.log(`FeeSharingSystem deployed to: ${feeSharingSystem.address}`);

    // const feeSharingAddress = "0xF915c5Fd027ca2A9ee7890a20efaE2DE59A03929";

    const feeSharingSetter = await FeeSharingSetter.deploy(
        feeSharingSystem.address,
        // feeSharingAddress,
        1000,
        10000,
        6500
    );
    console.log(`FeeSharingSetter deployed to: ${feeSharingSetter.address}`);

    
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });