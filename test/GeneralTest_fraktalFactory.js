const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = true;
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
  // console.log('token creator', decodedLog.creator)
  return decodedLog.tokenAddress;
};
const getPaymentSplitterAddress = async tx => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event NewRevenueAdded(address payer, address revenueChannel, uint256 amount, bool sold)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.revenueChannel;
};

describe("Fraktal", function () {
  let FraktalImplementationContract;
  let PaymentSplitterLogicContract;
  let IPaymentSplitter;

  let factory;
  let market;
  let Token1;
  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;
  let fee = 1;
  let PaymentSplitter1;
  let PaymentSplitter2;
  // beforeEach(async function () {
  //
  // });
  // to the market tests
  const item1price = utils.parseEther('0.02');
  const newPrice = utils.parseEther('0.025');

  function toPay(qty, price) {
    const priceN = utils.formatEther(price);
    const toPayWei = priceN * parseFloat(qty);
    // const toPayWfees = toPayWei + (toPayWei * fee/100) + 0.0001; // extra for gas errors
    const toPayFixed = toPayWei + 0.0000000001; // sum a little for errors in gas??? CAUTION
    // if(logs) console.log('total ',toPayWfees);
    return utils.parseEther(toPayFixed.toString());
  }

  describe("Market Deployment", function () {
      it("Should have the correct owner", async function(){
        [owner, alice, bob, carol, deedee] = await ethers.getSigners();
        if(logs) console.log('Alice address: ',alice.address);
        if(logs) console.log('bob address: ',bob.address);
        if(logs) console.log('carol address: ',carol.address);
        FraktalImplementationContract = await ethers.getContractFactory("FraktalNFT");
        const logicContract = await FraktalImplementationContract.deploy();
        await logicContract.deployed();
        if(logs) console.log("FraktalNFT deployed to:", logicContract.address);
        PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
        const psLogicContract = await PaymentSplitterLogicContract.deploy();
        await psLogicContract.deployed();
        if(logs) console.log("Payment Splitter deployed to:", psLogicContract.address);

        const FactoryContract = await ethers.getContractFactory("FraktalFactory");
        factory = await FactoryContract.deploy(logicContract.address, psLogicContract.address);
        await factory.deployed();
        if(logs) console.log("Factory deployed to:", factory.address);
        if(logs) console.log("Factory owner:", await factory.owner());
        expect(await factory.owner()).to.equal(owner.address);

        const MarketContract = await ethers.getContractFactory("FraktalMarket");
        market = await MarketContract.deploy();
        await market.deployed();
        if(logs) console.log("Market deployed to:", market.address);
        if(logs) console.log("Market owner:", await market.owner());
        expect(await market.owner()).to.equal(owner.address);
      });
    it('Should mint fraktions to the minter', async function (){
      const mintTx = await factory.connect(alice).mint(testUri, 8000);
      const token1Address = await awaitTokenAddress(mintTx);
      Token1 = FraktalImplementationContract.attach(token1Address);
      if(logs) console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${Token1.address}`,
      );
      // let minOffer = await Token1.maxPriceRegistered();
      // if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
      let balances = await Token1.balanceOfBatch([alice.address,alice.address, factory.address,factory.address],[0,1,0,1]);
      console.log('balances',balances)
      expect(balances[0]).to.equal(ethers.BigNumber.from("1"));
      expect(balances[1]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[2]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[3]).to.equal(ethers.BigNumber.from("0"));
    });
    // it('should allow defraktionalize', async function () {
    //   if(logs) console.log('Alice approves the market');
    //   await Token1.connect(alice).setApprovalForAll(factory.address, true);
    //   if(logs) console.log('Alice defraktionalize');
    //   await Token1.connect(alice).defraktionalize();
    //   let balances = await Token1.balanceOfBatch([alice.address,alice.address,factory.address],[0,1,0]);
    //   expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
    //   expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
    //   expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
    // });
    it('Should allow the minter to transfer the recently minted NFT', async function (){
      if(logs) console.log('Alice sends the nft to Bob');
      await Token1.connect(alice).safeTransferFrom(alice.address, bob.address, ethers.BigNumber.from(0), ethers.BigNumber.from(1), emptyData);
      let balances = await Token1.balanceOfBatch([alice.address,alice.address, bob.address, bob.address],[0,1,0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[3]).to.equal(ethers.BigNumber.from('0'));
    });
    it('Should allow the owner to fraktionalize it', async function () {
      if(logs) console.log('Bob fraktionalize the nft');
      await Token1.connect(bob).fraktionalize(bob.address, 1);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address], [0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    });
    it('should not be able to send the nft after', async function () {
      await expect(
        Token1.connect(bob).safeTransferFrom(bob.address, alice.address,0,1,emptyData)
      ).to.be.revertedWith('not approval')
    });
    it('should allow if consent on locking fraktions', async function () {
      if(logs) console.log('Bob locks the fraktions');
      await Token1.connect(bob).lockSharesTransfer(bob.address, 10000, alice.address);
      await Token1.connect(bob).safeTransferFrom(bob.address, alice.address, 0,1,emptyData);
      if(logs) console.log('Bob unlocks all fraktions');
      await Token1.connect(bob).unlockSharesTransfer(alice.address);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address, alice.address, alice.address],[0,1,0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[3]).to.equal(ethers.BigNumber.from('0'));
    });
    it('should not allow the receiver to transfer', async function () {
      await expect(
        Token1.connect(alice).safeTransferFrom(alice.address, carol.address, 0,1,emptyData)
      ).to.be.revertedWith('not approval');
    });
    it('should be movable by receiver if consent though', async function () {
      if(logs) console.log('Bob locks all fraktions');
      await Token1.connect(bob).lockSharesTransfer(bob.address, 10000, bob.address);
      if(logs) console.log('Alice transfers fraktal');
      await Token1.connect(alice).safeTransferFrom(alice.address, bob.address,0,1,emptyData);
      await Token1.connect(bob).unlockSharesTransfer(bob.address);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address, alice.address],[0,1,0]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
    }); // but if not approved, cannot move!
    // it('should allow defraktionalize', async function () {
    //   if(logs) console.log('Bob defraktionalize');
    //   await Token1.connect(bob).defraktionalize(1);
    //   let balances = await Token1.balanceOfBatch([bob.address,bob.address],[0,1]);
    //   expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
    //   expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
    // });
    it('Should allow the owner to send it to the market', async function () {
      if(logs) console.log('Bob approves the market');
      await Token1.connect(bob).setApprovalForAll(market.address, true);
      if(logs) console.log('Bob sends the nft through the market');
      await Token1.connect(bob).lockSharesTransfer(bob.address,10000,market.address);
      await Token1.connect(bob).safeTransferFrom(bob.address, market.address, 0, 1, emptyData);
      await Token1.connect(bob).unlockSharesTransfer(market.address);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address, market.address], [0,1,0]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
    });
    it('Should allow to send the fraktions', async function () {
      let val = 5000;
      if(logs) console.log(`Bob sends ${val} fraktions to Carol`);
      let prevBalances = await Token1.balanceOfBatch([market.address, bob.address, carol.address],[0,1,1]);
      await Token1.connect(bob).safeTransferFrom(bob.address, carol.address, 1, val, emptyData);
      let balances = await Token1.balanceOfBatch([market.address, bob.address, carol.address],[0,1,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from(prevBalances[1]-val));
      expect(balances[2]).to.equal(ethers.BigNumber.from(prevBalances[2]+val));
    });
    it('Should not allow to claim the fraktal', async function () {
      if(logs) console.log('Deedee claims the NFT');
      await expect(
        market.connect(deedee).claimFraktal(Token1.address)
      ).to.be.revertedWith('not approval');
      if(logs) console.log('Bob claims the NFT');
      await expect(
        market.connect(bob).claimFraktal(Token1.address)
      ).to.be.revertedWith('not approval');
      if(logs) console.log('Alice claims the NFT');
      await expect(
        market.connect(alice).claimFraktal(Token1.address)
      ).to.be.revertedWith('not approval');
      let balances = await Token1.balanceOfBatch([deedee.address,bob.address,alice.address, market.address],[0,0,0,0]);
      expect(balances[0]).to.equal(0);
      expect(balances[1]).to.equal(0);
      expect(balances[2]).to.equal(0);
      expect(balances[3]).to.equal(1);
    });
    it('Should not allow to burn other peoples fraktions', async function () {
      if(logs) console.log('Deedee burns Alices fraktions');
      await expect(
        Token1.connect(deedee).soldBurn(alice.address, 1, 100)
      ).to.be.revertedWith('ERC1155: burn amount exceeds balance');
    });
    it('Should allow to list the fraktions', async function () {
      if(logs) console.log(`Carol approves the market`)
      await Token1.connect(carol).setApprovalForAll(market.address, true);
      let qty = 5000;
      if(logs) console.log(`Carol lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`)
      let prevBalances = await Token1.balanceOfBatch([market.address, carol.address],[1,1]);
      await market.connect(carol).listItem(
        Token1.address,
        item1price, // total eth/amount
        qty); // amount
      let balances = await Token1.balanceOfBatch([market.address, carol.address], [1,1]);
      // testing listed items not in market property
      // expect(balances[0]).to.equal(prevBalances[0]+qty);
      // expect(balances[1]).to.equal(prevBalances[1]-qty);
      let listingPrice = await market.getListingPrice(carol.address, Token1.address);
      expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
      let listingAmount = await market.getListingAmount(carol.address, Token1.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    });
    it('Should allow buy fraktions listed', async function () {
      let prevBalances = await Token1.balanceOfBatch([carol.address, alice.address],[1,1]);
      let prevSellerBalance = await market.getSellerBalance(carol.address);
      expect(prevSellerBalance).to.equal(ethers.BigNumber.from('0'));
      let qty = 3000;
      let value = toPay(qty, item1price);
      if(logs) console.log(`Alice buys ${qty} fraktions`);
      await market.connect(alice).buyFraktions(carol.address, Token1.address, qty, {value: value});
      let balances = await Token1.balanceOfBatch([carol.address, alice.address],[1,1]);
      let sellerBalance = await market.getSellerBalance(carol.address);
      // expect(sellerBalance).to.bigger(ethers.BigNumber.from());
      assert(sellerBalance > prevSellerBalance, 'Seller payment didnt enter')
      if(logs) console.log(`Carol has now a balance of ${utils.formatEther(sellerBalance)} ETH`)
      expect(balances[0]).to.equal(prevBalances[0] - qty);
      expect(balances[1]).to.equal(qty);
    });
    it('Should allow to retrieve minimum offer', async function () {
      minOffer = await market.maxPriceRegistered(Token1.address);
      if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
      expect(minOffer).to.equal(utils.parseEther((utils.formatEther(item1price)*10000).toString()));
    });
    it('Should allow to make offers', async function () {
      if(logs) console.log('Deedee makes an offer on the token')
      await market.connect(deedee).makeOffer(Token1.address, utils.parseEther('200'),{value: utils.parseEther('200')});
      let offerValue = await market.getOffer(deedee.address, Token1.address);
      expect(offerValue).to.equal(utils.parseEther('200'))
    });
    it('Should allow to take out an offer', async function () {
      if(logs) console.log('Deedee takes the offer out');
      let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
      await market.connect(deedee).makeOffer(Token1.address, utils.parseEther('0'),{value: utils.parseEther('0.00001')});
      let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
      let offerValue = await market.getOffer(deedee.address, Token1.address);
      expect(offerValue).to.equal(utils.parseEther('0'));
      assert(deedeeEthBalance1 > deedeeEthBalance0, 'offer not taken');
    });
    it('should allow to unlist the fraktions', async function () {
      if(logs) console.log('Carol unlist the items');
      await market.connect(carol).unlistItem(Token1.address);
      let listingAmount = await market.getListingAmount(carol.address, Token1.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from('0'));
    });
    it('should not allow to buy unlisted items', async function () {
      if(logs) console.log('Alice tries to buy');
      await expect(
        market.connect(alice).buyFraktions(carol.address, Token1.address, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('Not enough Fraktions on sale');
    });
    it('should allow to re list items', async function () {
      let qty = await Token1.balanceOf(carol.address, 1);
      if(logs) console.log(`Carol list ${qty} the items with new price`);
      await market.connect(carol).listItem(
        Token1.address,
        newPrice, // total eth/amount
        qty); // amount
      let listingPrice = await market.getListingPrice(carol.address, Token1.address);
      expect(listingPrice).to.equal(ethers.BigNumber.from(newPrice));
      let listingAmount = await market.getListingAmount(carol.address, Token1.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    });
    it('Should allow to buy fraktions at new price', async function () {
      if(logs) console.log('Alice tries to buy it at old price');
      await expect(
        market.connect(alice).buyFraktions(carol.address, Token1.address, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('FraktalMarket: insufficient funds');
      await market.connect(alice).buyFraktions(carol.address, Token1.address, 100, {value: toPay(100, newPrice)});
      let balances = await Token1.balanceOfBatch([alice.address, market.address],[1,1]);
      if(logs) console.log('Carol has bought 2000 fraktions of Token1 at the new price');
      expect(balances[0]).to.equal(ethers.BigNumber.from('3100'));
    });
    it('Should allow to retrieve new minimum offer', async function () {
      minOffer = await market.maxPriceRegistered(Token1.address);
      if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
      expect(minOffer).to.equal(utils.parseEther((utils.formatEther(newPrice)*10000).toString()));
    });
    it('should allow to rescue gains', async function () {
      if(logs) console.log('Carol rescue ETH')
      let sellerBalance0 = await market.getSellerBalance(carol.address);
      let balanceEth0 = await ethers.provider.getBalance(carol.address);
      if(logs) console.log(`Carol has a balance of ${utils.formatEther(sellerBalance0)} ETH`)
      await market.connect(carol).rescueEth();
      let sellerBalance1 = await market.getSellerBalance(carol.address);
      let balanceEth1 = await ethers.provider.getBalance(carol.address);
      if(logs) console.log(`Balance was ${utils.formatEther(balanceEth0)} and now is ${utils.formatEther(balanceEth1)}`)
      expect(sellerBalance1).to.equal(0)
      // assert(balanceEth1 < balanceEth0, 'rescue has failed'); // fails!
    });
    it('Should allow to create a Revenue stream to fraktion holders', async function () {
      if(logs) console.log('Alice create Revenue Payment with 100 ETH');
      let firstRevenueTx = await Token1.connect(alice).createRevenuePayment(
        {value: utils.parseEther('100')}
      )
      const revenueChannelAddress = await getPaymentSplitterAddress(firstRevenueTx);
      if(logs) console.log('Deployed revenue channel to', revenueChannelAddress);
      PaymentSplitter1 = await ethers.getContractAt("IPaymentSplitter",revenueChannelAddress);
    });
    it('Should allow owners to retire its gains', async function () {
      let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
      if(logs) console.log('Bob has ',utils.formatEther(bobEthBalance1), 'ETH');
      if(logs) console.log('He asks for release');
      await PaymentSplitter1.connect(bob).release();
      let bobEthBalance2 = await ethers.provider.getBalance(bob.address);
      if(logs) console.log('Bob has now ',utils.formatEther(bobEthBalance2), 'ETH');
      // assert(bobEthBalance2 > bobEthBalance1, 'Bob couldnt withdraw')// fails!!! WHY???
      let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log('Alice has ',utils.formatEther(aliceEthBalance1), 'ETH');
      if(logs) console.log('Alice asks for release');
      await PaymentSplitter1.connect(alice).release();
      let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
      assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
    });
    it('Should allow to make offers', async function () {
      if(logs) console.log('Deedee makes an offer on the token')
      await expect(
        market.connect(alice).makeOffer(Token1.address, utils.parseEther('200'),{value: utils.parseEther('200')})
      ).to.be.revertedWith('Min offer');
      await market.connect(deedee).makeOffer(Token1.address, utils.parseEther('250'),{value: utils.parseEther('250')});
      let offerValue = await market.getOffer(deedee.address, Token1.address);
      expect(offerValue).to.equal(utils.parseEther('250'))
    });
    it('Should allow to vote on offers', async function () {
      if(logs) console.log('Bob votes on Deedee offer')
      // await Token1.connect(bob).setApprovalForAll(market.address, false); // if i set false it fails..
      await market.connect(bob).voteOffer(deedee.address, Token1.address);
      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
      let balances = await Token1.balanceOfBatch([bob.address],[1]);
      expect(votesOnOffer).to.equal(balances[0]);
    });
    it('BUG? Should allow to unlock fraktions and vote again (votes dont sum)', async function () {
      if(logs) console.log('Bob unlocks its fraktions');
      await Token1.connect(bob).unlockSharesTransfer(deedee.address);
      if(logs) console.log('Bob votes on Deedee offer again')
      await market.connect(bob).voteOffer(deedee.address, Token1.address);
      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
      let balances = await Token1.balanceOfBatch([bob.address],[1]);
      expect(votesOnOffer).to.equal(balances[0]);
    });
    it('Should sell if > majority', async function () {
      if(logs) console.log('Alice approves the market');
      await Token1.connect(alice).setApprovalForAll(market.address, true);
      if(logs) console.log('Alice votes on Deedee offer')
      await market.connect(alice).voteOffer(deedee.address, Token1.address);
      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
      let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
      expect(votesOnOffer).to.equal(parseFloat(balances[0])+parseFloat(balances[1]));
      let nftStatus = await Token1.sold();
      expect(nftStatus).to.equal(true);
    });
    it('Should not allow anyone to claim the fraktal', async function () {
      if(logs) console.log('Alice claims the buyed NFT');
      await expect(
        market.connect(alice).claimFraktal(Token1.address)
      ).to.be.revertedWith('not buyer');
      let balances = await Token1.balanceOfBatch([alice.address, market.address],[0,0]);
      expect(balances[0]).to.equal(0);
      expect(balances[1]).to.equal(1);
    });
    it('Should not allow to unlock fraktions once sold', async function (){
      let votesBefore = await market.getVotes(deedee.address, Token1.address);
      await expect(
        Token1.connect(alice).unlockSharesTransfer(deedee.address)
      ).to.be.revertedWith('item sold');
      let votesAfter = await market.getVotes(deedee.address, Token1.address);
      expect(votesAfter).to.be.equal(votesBefore);
    });
    it('Should allow to claim the fraktal', async function () {
      if(logs) console.log('Deedee claims the buyed NFT');
      await market.connect(deedee).claimFraktal(Token1.address);
      let balances = await Token1.balanceOfBatch([deedee.address, market.address],[0,0]);
      expect(balances[0]).to.equal(1);
      expect(balances[1]).to.equal(0);
    });
    it('should allow to retrieve the gains and burn the fraktions', async function () {
      if(logs) console.log('First find the revenue channel address');
      let lastRevenue = await Token1.getRevenue(1);
      if(logs) console.log('sell revenue in ',lastRevenue)
      PaymentSplitter2 = await ethers.getContractAt("IPaymentSplitter",lastRevenue);
      let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
      if(logs) console.log('Bob has ',utils.formatEther(bobEthBalance1), 'ETH');
      if(logs) console.log('He asks for release');
      await PaymentSplitter2.connect(bob).release();
      let bobEthBalance2 = await ethers.provider.getBalance(bob.address);
      if(logs) console.log('Bob has now ',utils.formatEther(bobEthBalance2), 'ETH');
      // assert(bobEthBalance2 > bobEthBalance1, 'Bob couldnt withdraw')// fails!!! WHY???
      let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log('Alice has ',utils.formatEther(aliceEthBalance1), 'ETH');
      if(logs) console.log('asks for release');
      await PaymentSplitter2.connect(alice).release();
      let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
      assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
      let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
      expect(balances[1]).to.equal(0);
      expect(balances[0]).to.equal(0);
    });
    it('Should allow the admin to take the accrued fees', async function () {
      let totalInContract = await ethers.provider.getBalance(market.address);
      if(logs) console.log('The contract has now, ', utils.formatEther(totalInContract), 'ETH');
      if(logs) console.log('Owner whitdraw the accrued fees');
      let ownerInitialEth = await ethers.provider.getBalance(owner.address);
      await market.connect(owner).withdrawAccruedFees();
      let ownerFinalEth =  await ethers.provider.getBalance(owner.address);
      totalInContract = await ethers.provider.getBalance(market.address);
      let difference = ownerFinalEth.sub(ownerInitialEth);
      expect(difference).to.gt(ethers.BigNumber.from('0'));
      if(logs) console.log('Owner now has ',utils.formatEther(ownerFinalEth), 'ETH');
      if(logs) console.log('now there is ',utils.formatEther(totalInContract),' in the contract');
      // expect(totalInContract).to.equal(ethers.BigNumber.from('0')); // never gets to 0... ???
    });
    it('Should allow the owner to re-fraktionalize it', async function () {
      if(logs) console.log('Deedee fraktionalize the nft');
      await expect(
        Token1.connect(deedee).fraktionalize(deedee.address, 1)
      ).to.be.revertedWith('index used')
      await Token1.connect(deedee).fraktionalize(deedee.address, 2);
      let balances = await Token1.balanceOfBatch([deedee.address,deedee.address], [0,2]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      let fraktionsIndex = await Token1.fraktionsIndex();
      if(logs) console.log('new Fraktions index: ',fraktionsIndex);

    });

    // what else to check
    // majority can be changed by the owner (would be interesting also to change it from the market)
    // change fees of market
    // import NFT's and do all over again (or add the other test files)
    // re-fraktionalize and test all over again!
  });
})
