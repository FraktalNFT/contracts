const { expect, util } = require("chai");
const { utils } = require("ethers");
const { ethers } = require("hardhat");

const mineBlock = async (numBlock) => {
    for(i=0;i<numBlock;i++){
        await network.provider.send("evm_mine")
    }
}

describe("Fraktal StakingPool", function () {
    it("Should get 500 reward token on 10 blocks staking duration", async function () {
        const [owner, alice] = await ethers.getSigners();
        const ERC20Token = await ethers.getContractFactory("TestFraktalERC20");
        const StakingPoolForUniswapV2Tokens = await ethers.getContractFactory("StakingPoolForUniswapV2Tokens");

        const rewardToken = await ERC20Token.deploy();
        await rewardToken.deployed();

        const stakedToken = await ERC20Token.deploy();
        await stakedToken.deployed();

        //start at block number 20
        const startBlock = 20;

        //50 Frak per block, for 1 million block (https://docs.fraktal.io/fraktal-governance-token-frak/liquidity-incentives)
        const stakingPool = await StakingPoolForUniswapV2Tokens.deploy(
            stakedToken.address,
            rewardToken.address,
            utils.parseEther("50"),
            startBlock,
            startBlock+1000000
        );
        await stakingPool.deployed();
        
        //send 50 million reward token (50 token * 1 million blocks)
        await rewardToken.connect(owner).transfer(stakingPool.address,utils.parseEther("50000000"));

        const amountToStake = utils.parseEther("1337");
        await stakedToken.approve(stakingPool.address,amountToStake);
        await stakingPool.deposit(amountToStake);

        //mine to blocknumber 20
        await mineBlock(13);

        //mine 10 block (staking for 10 block)
        await mineBlock(10);

        const beforeWithdrawFraktal = await rewardToken.balanceOf(owner.address);
        await stakingPool.withdraw(amountToStake);
        const afterWithdrawFraktal = await rewardToken.balanceOf(owner.address);
        const rewardReceived = Number(utils.formatEther((afterWithdrawFraktal - beforeWithdrawFraktal).toString()));

        //as there's only one staker, all rewards goes to the staker. 10 block * 50 rewardPerBlock = 500 rewardToken
        expect(rewardReceived-500).to.be.lte(0.00001);
    });
  });