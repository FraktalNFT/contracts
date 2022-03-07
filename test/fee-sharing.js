const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { ethers, network } = require("hardhat");

const mineBlock = async (numBlock) => {
  for(i=0;i<numBlock;i++){
      await network.provider.send("evm_mine")
  }
}



describe("FeeSharingSystem", function () {
  it("Should return harvest(ETH not WETH) according to staked users", async function () {
    const [owner,alice,bob] = await ethers.getSigners();

    
    

    const TestFraktalERC20 = await hre.ethers.getContractFactory("TestFraktalERC20");
    const frakToken = await TestFraktalERC20.deploy();
    await frakToken.deployed();
    const rewardToken = await TestFraktalERC20.deploy();
    await rewardToken.deployed();

    await frakToken.transfer(alice.address,utils.parseEther("10000"));
    await frakToken.transfer(bob.address,utils.parseEther("10000"));

    const FeeSharingSystem = await hre.ethers.getContractFactory("FeeSharingSystem");
    const feeSharingSystem = await upgrades.deployProxy(FeeSharingSystem,[frakToken.address]);
    await feeSharingSystem.deployed();

    const FeeSharingSetter = await hre.ethers.getContractFactory("FeeSharingSetter");
    const feeSharingSetter = await FeeSharingSetter.deploy(feeSharingSystem.address,100,1000,500);
    await feeSharingSetter.deployed();

    


    //for debugging
    const showFeeSystemData = async () =>{
      const currentBlock = (await ethers.provider.getBlock("latest")).number;
      const currentRewardPool = await feeSharingSystem.currentRewardPool();
      const currentRound = (await feeSharingSystem.roundNumber()).toNumber();
      const currentEndBlock = await feeSharingSystem.currentEndBlock();
      const lastUpdateBlock = await feeSharingSystem.lastUpdateBlock();
      console.log(`Current block: ${currentBlock}, pool:${currentRewardPool}, round:${currentRound}, endBlock:${currentEndBlock}, lastUpdate: ${lastUpdateBlock}`);
    }

    //alice approve tokens to feeSharingSystem
    await frakToken.connect(alice).approve(feeSharingSystem.address,utils.parseEther("10000"));
    // await frakToken.connect(bob).approve(feeSharingSystem.address,utils.parseEther("100000"));

    //give feeSharingSystem some ETH(simulate marketplace fee collected)
    // await rewardToken.transfer(feeSharingSetter.address,utils.parseEther("10000"))
    await owner.sendTransaction({
      to:feeSharingSetter.address,
      value:utils.parseEther("1")
    });


    // console.log("FeeSharingSystem deployed to:", feeSharingSystem.address, await ethers.provider.getBalance(feeSharingSystem.address));
    // console.log("FeeSharingSetter deployed to:", feeSharingSetter.address, await ethers.provider.getBalance(feeSharingSetter.address));
    const setterBalance = await ethers.provider.getBalance(feeSharingSetter.address);
    expect(setterBalance).to.be.equal(utils.parseEther("1"));
    // console.log("FeeSharingSetter deployed to:", feeSharingSetter.address, await ethers.provider.getBalance(feeSharingSetter.address));

    // console.log(await feeSharingSystem.owner(), owner.address);
    await feeSharingSetter.grantRole(await feeSharingSetter.OPERATOR_ROLE(), owner.address);
    await feeSharingSystem.transferOwnership(feeSharingSetter.address);
    await feeSharingSetter.updateRewards();

    // cannot update before period ended 
    await expect(feeSharingSetter.updateRewards()).to.be.reverted;
    // console.log("feeSharingSystem deployed to:",  await ethers.provider.getBalance(feeSharingSystem.address));
    const systemBalance = await ethers.provider.getBalance(feeSharingSystem.address);
    expect(systemBalance).to.be.equal(utils.parseEther("1"));
    // console.log("Sending fees");
    // await showFeeSystemData();
    await feeSharingSystem.connect(alice).deposit(utils.parseEther("100"),false);
    // console.log("Alice deposit");

    await mineBlock(500);
    await feeSharingSystem.connect(alice).withdrawAll(false);
    const lincePendingReward = await feeSharingSystem.calculatePendingRewards(alice.address);
    await feeSharingSystem.connect(alice).harvest();
    const aliceBalance = await ethers.provider.getBalance(alice.address);
    expect(Number("10001") - Number(utils.formatEther(aliceBalance))).to.be.lt(0.01)
  });
});
  