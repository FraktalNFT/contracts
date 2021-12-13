const { expect, assert } = require('chai');//, assert, describe, before, it
const { ethers } = require('hardhat');
const { utils } = ethers;
const { toPay } = require('./utils/marketUtils');
const { log, item1price, emptyData, newPrice } = require('./utils/testUtils');
const {
  marketContract,
  factoryContract,
  implementationContract,
  splitterFactoryContract,
  getDeployedContract,
} = require('./utils/factoryHelpers');
const { mintFraktal } = require('./utils/fraktalHelpers');

describe('Fraktal Market - Auction', function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;
  let market;
  let Token;
  let PaymentSplitter2;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

  // TODO change to beforeEach to isolate tests
  before('Getting accounts - deploying contracts', async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    log(`Alice address: ${alice.address}`);
    log(`Bob address: ${bob.address}`);
    log(`Carol address: ${carol.address}`);
    FraktalImplementationContract = await implementationContract();
    logicContract = await getDeployedContract(
      'Fraktal NFT',
      FraktalImplementationContract,
    );
    PaymentSplitterLogicContract = await splitterFactoryContract();
    psLogicContract = await getDeployedContract(
      'Payment Splitter',
      PaymentSplitterLogicContract,
    );
    factory = await getDeployedContract(
      'Fraktal Factory',
      await factoryContract(),
      [logicContract.address, psLogicContract.address],
    );
    log(`Factory owner: ${await factory.owner()}`);
    Token = await mintFraktal(factory, logicContract, alice);
    market = await getDeployedContract('Market Contract', await marketContract());
    await market.connect(alice).initialize()
  });

  it('Check if auction listed', async function () {
    log('Alice approves the market');
    await Token.connect(alice).setApprovalForAll(market.address, true);
    
    log('Alice sends the nft through the market');
    await market.connect(alice).importFraktal(Token.address, 1);

    let listingTime = (await bob.provider.getBlock()).timestamp;
    let reservePrice = utils.parseEther("10");
    let shares = 1000;

    console.log(typeof(listingTime));
    await market.connect(alice).listItemAuction(Token.address,reservePrice,shares);

    let auctionListed = await market.auctionListings(Token.address,alice.address,0);

    expect(auctionListed.numberOfShares).to.equal(shares);
    expect(auctionListed.reservePrice).to.equal(reservePrice);
    expect(auctionListed.auctionEndTime).to.gt(listingTime);

  });

  it('Revert seller list auction more than available',async function(){
    await expect(
        market.connect(alice).listItemAuction(Token.address,10000000,9001)
    ).to.be.reverted;

    let bobContribution = utils.parseEther("1");//for redeem failed auction test
    await market.connect(bob).participateAuction(
            Token.address,alice.address,0,{value:bobContribution}
    );
    

  })

  it('Revert seller redeem auction before auction had finished',async function(){
    await expect(
        market.connect(alice).redeemAuctionSeller(Token.address,alice.address,0)
    ).to.be.reverted;
  })



  it('Unlist auction should change auction endtime to current',async function(){
    let lastAuction = await market.auctionListings(Token.address,alice.address,0);
    await market.connect(alice).unlistAuctionItem(Token.address,0);
    let unlistedAuction = await market.auctionListings(Token.address,alice.address,0);

    expect(unlistedAuction.auctionEndTime).to.be.lt(lastAuction.auctionEndTime);
  })

  it('Revert auction participation if auction ended',async function(){
    let bobContribution = utils.parseEther("1");
    await expect(
        market.connect(bob).participateAuction(
            Token.address,alice.address,0,{value:bobContribution})
    ).to.be.reverted;
  })

  it('Revert redeem auction not seller',async function(){
    await expect(
        market.connect(bob).redeemAuctionSeller(Token.address,alice.address,0)
    ).to.be.reverted;
  })

  it('Revert redeem auction if already redeemed',async function(){
    await market.connect(alice).redeemAuctionSeller(Token.address,alice.address,0);
    await expect(
        market.connect(alice).redeemAuctionSeller(Token.address,alice.address,0)
        ).to.be.reverted;
  })

  it('Check seller\'s fraktions after redeemed a failed auction ',async function(){
    let aliceFrak = await Token.balanceOf(alice.address,1);
    expect(aliceFrak).to.equal(10000);
  })

  it('Give participant Eth back on auction failed',async function(){
    let bobBalance = await bob.getBalance();
    await market.connect(bob).redeemAuctionParticipant(Token.address,alice.address,0);
    let bobBalanceAfter = await bob.getBalance();
    expect(bobBalanceAfter).to.be.gt(bobBalance);

  })

  it('Revert seller list auction if reserve prive equal 0',async function(){
    await expect(
        market.connect(alice).listItemAuction(Token.address,0,1000)
    ).to.be.reverted;
  })

  it('Revert auction participation if auction did not exist',async function(){
    await expect(
        market.connect(bob).participateAuction(
            Token.address,alice.address,1,{value:utils.parseEther("1")}
    )
    ).to.be.reverted;
  })

  it('List next auction without deleting last auction data',async function(){
    await market.connect(alice).listItemAuction(Token.address,utils.parseEther("1"),1000);
    let {tokenAddress, reservePrice, numberOfShares,auctionEndTime} = await market.auctionListings(Token.address,alice.address,0);
    let newAuction = await market.auctionListings(Token.address,alice.address,1);
    expect(tokenAddress).to.equal(Token.address);
    expect(reservePrice).to.equal(reservePrice);
    expect(numberOfShares).to.equal(1000);
    expect(auctionEndTime).to.gt(0);
    expect(auctionEndTime).to.lt((await alice.provider.getBlock()).timestamp);
    expect(newAuction.auctionEndTime).to.be.gt(0);
  })

  it('Check auctionReserve and participantContribution increase after user participate in auction',async function(){
    let bobContribution = utils.parseEther("1");
    await market.connect(bob).participateAuction(
            Token.address,alice.address,1,{value:bobContribution}
    );

    expect(await market.auctionReserve(alice.address,1)).to.be.equal(bobContribution);
    expect(await market.participantContribution(alice.address,1,bob.address)).to.be.equal(bobContribution);
  })



  it('Revert participant redeem auction before auction had finished',async function(){
    // await market.connect(alice).unlistAuctionItem(Token.address,1);//this make bob redeem not reverted
    await expect(
        market.connect(bob).redeemAuctionParticipant(Token.address,alice.address,1)
    ).to.be.reverted;
  })

  it('Revert participant redeem if auction is not existed',async function(){
    await expect(
        market.connect(bob).redeemAuctionParticipant(Token.address,alice.address,2)
    ).to.be.reverted;
  })

  it('Give participant fraktions if auction succeeded',async function(){
    await market.connect(alice).unlistAuctionItem(Token.address,1);

    await market.connect(bob).redeemAuctionParticipant(Token.address,alice.address,1);
    let bobFrak = await Token.balanceOf(bob.address,1);
    expect(bobFrak).to.be.equal(1000);
  })
  it('Give auctioned Eth (minus fee) to seller if auction succeeded',async function(){
    let aliceBalance = await alice.getBalance();
    await market.connect(alice).redeemAuctionSeller(Token.address,alice.address,1);
    let aliceBalanceAfter = await alice.getBalance();
    let gas = utils.parseEther("0.001");
    let fee = utils.parseEther("0.01");
    expect(aliceBalanceAfter-aliceBalance).to.be.gt(utils.parseEther("1") - gas - fee);
  })

  it('Sample auction with 2 participant',async function(){
    await market.connect(alice).listItemAuction(Token.address,utils.parseEther('2'),5000);
    let sellerNonce = (await market.auctionNonce(alice.address))-1;

    let carolContribute = utils.parseEther('3');
    let deedeeContribute = utils.parseEther('2');
    
    await market.connect(carol).participateAuction(Token.address,alice.address,sellerNonce,
        {value:carolContribute}
    );
    await market.connect(deedee).participateAuction(Token.address,alice.address,sellerNonce,
        {value:deedeeContribute}
    );


    let tenDays = 864000;
    await network.provider.send("evm_increaseTime", [tenDays]);
    await network.provider.send("evm_mine");

    let aliceBalance = await alice.getBalance();

    await market.connect(alice).redeemAuctionSeller(Token.address,alice.address,sellerNonce);
    await market.connect(carol).redeemAuctionParticipant(Token.address,alice.address,sellerNonce);
    await market.connect(deedee).redeemAuctionParticipant(Token.address,alice.address,sellerNonce);

    let carolFrak = await Token.balanceOf(carol.address,1);
    let deedeeFrak = await Token.balanceOf(deedee.address,1);
    let aliceBalanceAfter = await alice.getBalance();

    expect(carolFrak).to.equal(3000);
    expect(deedeeFrak).to.equal(2000);

    let gas = utils.parseEther("0.001");
    let fee = utils.parseEther("0.05");
    expect(aliceBalanceAfter-aliceBalance).to.be.gt(utils.parseEther("5") - gas - fee);
  })
});
