const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = false;
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
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

describe("FraktalNFT", function () {
  let TokenLogicContract;

  let market;
  let Token1;
  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;
  let fee = 1;
  // beforeEach(async function () {
  //
  // });
  const item1price = utils.parseEther('2');

  function toPay(qty, price) {
    const priceN = utils.formatEther(price);
    if(logs) console.log('priceN', priceN);
    if(logs) console.log('qty', parseFloat(qty));
    if(logs) console.log('fee',fee,'%');
    const toPayWei = priceN * parseFloat(qty);
    // const toPayWfees = toPayWei + (toPayWei * fee/100) + 0.0001; // extra for gas errors
    const toPayFixed = toPayWei + 0.0001; // sum a little for errors in gas??? CAUTION
    // if(logs) console.log('total ',toPayWfees);
    return utils.parseEther(toPayFixed.toString());
  }

  describe("Market Deployment", function () {
    it("Should have the correct owner", async function(){
      [owner, alice, bob, carol, deedee] = await ethers.getSigners();
      if(logs) console.log('Alice address: ',alice.address);
      if(logs) console.log('bob address: ',bob.address);
      if(logs) console.log('carol address: ',carol.address);
      TokenLogicContract = await ethers.getContractFactory("FraktalNFT");
      const logicContract = await TokenLogicContract.deploy();
      await logicContract.deployed();
      if(logs) console.log("FraktalNFT deployed to:", logicContract.address);

      const MarketContract = await ethers.getContractFactory("FraktalMarket");
      market = await MarketContract.deploy(logicContract.address);
      await market.deployed();
      if(logs) console.log("Market deployed to:", market.address);
      if(logs) console.log("Market owner:", await market.owner());
      expect(await market.owner()).to.equal(owner.address);
    });
  it('Should mint a fraktal NFT to the minter', async function (){
    const mintTx = await market.connect(alice).mint(testUri);
    const token1Address = await awaitTokenAddress(mintTx);
    Token1 = TokenLogicContract.attach(token1Address);
    if(logs) console.log(
      `Deployed a new ERC1155 FraktalNFT at: ${Token1.address}`,
    );
    let minOffer = await Token1.maxPriceRegistered();
    if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
    let aliceBalanceT1 = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
    if(logs) console.log('Alice balances ', aliceBalanceT1);
    expect(aliceBalanceT1[0]).to.equal(ethers.BigNumber.from("1"));
    expect(aliceBalanceT1[1]).to.equal(ethers.BigNumber.from("0"));
    let marketBalanceT1 = await Token1.balanceOfBatch([market.address,market.address], [0,1]);
    if(logs) console.log('Market balances ', marketBalanceT1);
    expect(marketBalanceT1[0]).to.equal(ethers.BigNumber.from("0"));
    expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from("10000"));
  });
  it('Should allow the minter to transfer the recently minted NFT', async function (){
    if(logs) console.log('Alice sends the nft to Bob');
    await Token1.connect(alice).safeTransferFrom(alice.address, bob.address, ethers.BigNumber.from(0), ethers.BigNumber.from(1), emptyData);
    aliceBalanceT1 = await Token1.balanceOf(alice.address, 0);
    let bobBalanceT1 = await Token1.balanceOf(bob.address, 0);
    expect(aliceBalanceT1).to.equal(ethers.BigNumber.from('0'));
    expect(bobBalanceT1).to.equal(ethers.BigNumber.from('1'));
  });
  it('Should allow the owner to fraktionalize it', async function () {
    if(logs) console.log('Bob approves the market');
    await Token1.connect(bob).setApprovalForAll(market.address, true);
    if(logs) console.log('Bob fraktionalize the nft');
    await market.connect(bob).fraktionalize(0);
    marketBalanceT1 = await Token1.balanceOfBatch([market.address, market.address], [0,1]);
    bobBalanceT1 = await Token1.balanceOfBatch([bob.address,bob.address], [0,1]);
    expect(marketBalanceT1[0]).to.equal(ethers.BigNumber.from('1'));
    expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from('0'));
    expect(bobBalanceT1[0]).to.equal(ethers.BigNumber.from('0'));
    expect(bobBalanceT1[1]).to.equal(ethers.BigNumber.from('10000'));

  });
  it('Should allow to list the fraktions', async function () {
    if(logs) console.log('Bob list the item');
    await market.connect(bob).listItem(
      0,//marketId
      item1price, // total eth/amount
      5000); // amount
    marketBalanceT1 = await Token1.balanceOfBatch([market.address, market.address], [0,1]);
    bobBalanceT1 = await Token1.balanceOfBatch([bob.address,bob.address], [0,1]);
    expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from('5000'));
    expect(bobBalanceT1[1]).to.equal(ethers.BigNumber.from('5000'));
  });
  it('Should allow to transfer owned fraktions', async function () {
    let val = 5
    console.log(`Bob sends ${val} fraktions to Alice`);
    await Token1.connect(bob).safeTransferFrom(
      bob.address,
      alice.address,
      ethers.BigNumber.from(1),
      ethers.BigNumber.from(val),
      emptyData);
    aliceBalanceT1 = await Token1.balanceOfBatch([alice.address,alice.address],[0,1]);
    expect(aliceBalanceT1[1]).to.equal(ethers.BigNumber.from(val));
    minOffer = await Token1.maxPriceRegistered();
    console.log('Min Offer is now:', utils.formatEther(minOffer))
  });
  it('Should allow buy fraktions listed', async function () {
    await market.connect(carol).buyFraktions(bob.address, 0, 1000, {value: toPay(1000, item1price)});
    let carolBalanceT1 = await Token1.balanceOf(carol.address, 1);
    marketBalanceT1 = await Token1.balanceOf(market.address, 1);
    if(logs) console.log('Carol has bought ',carolBalanceT1.toNumber(), 'fraktions of Token1');
    expect(carolBalanceT1).to.equal(ethers.BigNumber.from('1000'));
    expect(marketBalanceT1).to.equal(ethers.BigNumber.from('4000'));
  });
  it('Should allow to make offers', async function () {
    minOffer = await Token1.maxPriceRegistered();
    console.log('Min Offer is now:', utils.formatEther(minOffer))
    expect(minOffer).to.equal(item1price);
  });
  it('new transfers should not modify min offer', async function () {
    let val = 2500
    console.log(`Bob sends ${val} fraktions to Alice`);
    await Token1.connect(bob).safeTransferFrom(
      bob.address,
      alice.address,
      ethers.BigNumber.from(1),
      ethers.BigNumber.from(val),
      emptyData);
    aliceBalanceT1 = await Token1.balanceOfBatch([alice.address,alice.address],[0,1]);
    expect(aliceBalanceT1[1]).to.equal(ethers.BigNumber.from(2505));
    minOffer = await Token1.maxPriceRegistered();
    expect(minOffer).to.equal(item1price);
    console.log('Min Offer is now:', utils.formatEther(minOffer))
  });
  it('Should not allow to transfer after fraktionalized', async function () {
    await expect(
      market.connect(alice).claimFraktal([],[],0)
    ).to.be.revertedWith("not locked");
  });
  // it('unless all holders are in consent', async function () {
  //
  // });

  });


})
