const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const awaitTokenAddress = async tx => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event Minted(address creator,string urlIpfs,address tokenAddress,uint nftId)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.tokenAddress;
};
const emptyData = '0x000000000000000000000000000000000000dEaD';
describe("FraktalNFT", function () {
  let market;
  let TokenLogicContract;
  let Token1;
  let Token2;
  let Token3;
  let owner;
  let alice;
  let bob;
  let carol;

  // console.log('Owner account ',owner.address);
  // console.log('Alice account ',alice.address);
  // console.log('Bob account ',bob.address);
  // console.log('Carol account ',carol.address);
  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    TokenLogicContract = await ethers.getContractFactory("FraktalNFT");
    const logicContract = await TokenLogicContract.deploy();
    await logicContract.deployed();
    console.log("FraktalNFT deployed to:", logicContract.address);
    const MarketContract = await ethers.getContractFactory("FraktalMarket");
    market = await MarketContract.deploy(logicContract.address);
    await market.deployed();
    console.log("Market deployed to:", market.address);
    console.log("Market owner:", await market.owner());
  });

  describe("Market Deployment", function () {
    it("Should have the correct owner", async function(){
      expect(await market.owner()).to.equal(owner.address);
    });
  });
  describe("ERC1155 functions", function () {
    it("Should mint the correct amount, correct uri and work as an ERC1155", async function () {
      const uri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const mintTx = await market.connect(alice).mint(uri);
      const tokenAddress = await awaitTokenAddress(mintTx);
      Token1 = TokenLogicContract.attach(tokenAddress);
      console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${Token1.address}`,
      );
      const tokenUri = await Token1.uri(0);
      expect(tokenUri).to.equal(uri);
      const aliceBalance = await Token1.balanceOf(alice.address, 0);
      expect(aliceBalance).to.equal(ethers.BigNumber.from("1"));
      const marketBalance = await Token1.balanceOf(market.address, 1);
      expect(marketBalance).to.equal(ethers.BigNumber.from("10000"));
    });
  });
/////////// INTEGRATE THIS IN MARKET

    // it("Should allow transfers of fraktions", async function () {
    //   console.log('Alice sends 1k fraktions to Bob');
    //   await Token1.connect(alice).safeTransferFrom(alice.address, bob.address, ethers.BigNumber.from(1), ethers.BigNumber.from(1000), emptyData);
    //   console.log('Alice sends 5k fraktions to Carol');
    //   await Token1.connect(alice).safeTransferFrom(alice.address, carol.address, ethers.BigNumber.from(1), ethers.BigNumber.from(5000), emptyData);
    //   console.log('Carol sends 2k fraktions to Bob');
    //   await Token1.connect(carol).safeTransferFrom(carol.address, bob.address, ethers.BigNumber.from(1), ethers.BigNumber.from(2000), emptyData);
    //   console.log('Bob sends 1k fraktions to Alice');
    //   await Token1.connect(carol).safeTransferFrom(bob.address, alice.address, ethers.BigNumber.from(1), ethers.BigNumber.from(1000), emptyData);
    //
    //   const bobBalance = await Token1.balanceOf(bob.address, 1);
    //   const aliceBalance = await Token1.balanceOf(alice.address, 1);
    //   const carolBalance = await Token1.balanceOf(carol.address, 1);
    //   expect(aliceBalance).to.equal(ethers.BigNumber.from("5000"));
    //   expect(bobBalance).to.equal(ethers.BigNumber.from("2000"));
    //   expect(carolBalance).to.equal(ethers.BigNumber.from("3000"));
    // });
    // it("Should not allow to move more than balance", async function () {
    //   const initialOwnerBalance = await Token1.balanceOf(alice.address, 0);
    //   await expect(
    //     Token1.connect(alice).safeTransferFrom(alice.address,bob.address,1,5001,emptyData)
    //   ).to.be.revertedWith("Fraktal ERC1155: caller does not have this many unlocked shares.");
    //   expect(await Token1.balanceOf(alice.address, 0)).to.equal(
    //     initialOwnerBalance
    //   );
    // });
    // it("Should not allow to move the nft", async function () {
    //   const initialOwnerBalance = await Token1.balanceOf(alice.address, 0);
    //   await expect(
    //     Token1.connect(alice).safeTransferFrom(alice.address,bob.address,0,1,emptyData)
    //   ).to.be.revertedWith("ERC1155: caller has not transferLocked this many shares to this transfer.");
    //   expect(await Token1.balanceOf(alice.address, 0)).to.equal(
    //     initialOwnerBalance
    //   );
    // });
    // it("Should allow to lock and unlock fraktions", async function () {
    //   console.log('Alice locks 1k to Bob');
    //   await Token1.connect(alice).lockSharesTransfer(1000, bob.address);
    //   console.log('Bob locks 2k to Alice');
    //   await Token1.connect(bob).lockSharesTransfer(2000, alice.address);
    //   console.log('Carol locks 3k to Alice');
    //   await Token1.connect(carol).lockSharesTransfer(3000, alice.address);
    //   const bobLocks = await Token1.getLocked(bob.address);
    //   const aliceLocks = await Token1.getLocked(alice.address);
    //   const carolLocks = await Token1.getLocked(carol.address);
    //   expect(aliceLocks).to.equal(ethers.BigNumber.from("1000"));
    //   expect(bobLocks).to.equal(ethers.BigNumber.from("2000"));
    //   expect(carolLocks).to.equal(ethers.BigNumber.from("3000"));
    //   const aliceLocked = await Token1.getLockedTo(alice.address);
    //   const bobLocked = await Token1.getLockedTo(bob.address);
    //   const carolLocked = await Token1.getLockedTo(carol.address);
    //   expect(aliceLocked).to.equal(ethers.BigNumber.from("5000"));
    //   expect(bobLocked).to.equal(ethers.BigNumber.from("1000"));
    //   expect(carolLocked).to.equal(ethers.BigNumber.from("0"));
    //   console.log('Alice unlocks 1k');
    //   await Token1.connect(alice).unlockSharesTransfer(1000, bob.address);
    //   console.log('Bob unlocks 2k');
    //   await Token1.connect(bob).unlockSharesTransfer(2000, alice.address);
    //   console.log('Carol unlocks 3k');
    //   await Token1.connect(carol).unlockSharesTransfer(3000, alice.address);
    //   const bobunLocks = await Token1.getLocked(bob.address);
    //   const aliceunLocks = await Token1.getLocked(alice.address);
    //   const carolunLocks = await Token1.getLocked(carol.address);
    //   expect(aliceunLocks).to.equal(ethers.BigNumber.from("0"));
    //   expect(bobunLocks).to.equal(ethers.BigNumber.from("0"));
    //   expect(carolunLocks).to.equal(ethers.BigNumber.from("0"));
    //   const aliceunLocked = await Token1.getLockedTo(alice.address);
    //   const bobunLocked = await Token1.getLockedTo(bob.address);
    //   const carolunLocked = await Token1.getLockedTo(carol.address);
    //   expect(aliceunLocked).to.equal(ethers.BigNumber.from("0"));
    //   expect(bobunLocked).to.equal(ethers.BigNumber.from("0"));
    //   expect(carolunLocked).to.equal(ethers.BigNumber.from("0"));
    // });
    // it("Should allow to transfer nft it 10k fraktions consent where", async function (){
    //   console.log('Alice locks 5k to Carol');
    //   await Token1.connect(alice).lockSharesTransfer(5000, carol.address);
    //   console.log('Bob locks 2k to Carol');
    //   await Token1.connect(bob).lockSharesTransfer(2000, carol.address);
    //   console.log('Carol locks 3k to itself');
    //   await Token1.connect(carol).lockSharesTransfer(3000, carol.address);
    //   const carolunLocked = await Token1.getLockedTo(carol.address);
    //   expect(carolunLocked).to.equal(ethers.BigNumber.from('10000'));
    //   await expect(
    //     Token1.connect(alice).safeTransferFrom(alice.address,bob.address,0,1,emptyData)
    //     ).to.be.revertedWith("ERC1155: caller has not transferLocked this many shares to this transfer.");
    //   console.log('Alice transfers the nft to Carol');
    //   await Token1.connect(alice).safeTransferFrom(alice.address,carol.address,0,1,emptyData);
    //   const aliceNftBalance = await Token1.balanceOf(alice.address, 0);
    //   const carolNftBalance = await Token1.balanceOf(carol.address, 0);
    //   expect(aliceNftBalance).to.equal(ethers.BigNumber.from('0'));
    //   expect(carolNftBalance).to.equal(ethers.BigNumber.from('1'));
    // });
});
