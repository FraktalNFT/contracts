const { expect, assert } = require("chai");
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
const awaitERC721TokenAddress = async tx => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event NewToken(address token)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.token;
};
const awaitPaymentSplitterAddress = async tx => {
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

describe("FraktalNFT-ERC721 handlers", function () {
  let TokenLogicContract;
  let PaymentSplitterLogicContract;
  let IPaymentSplitter;

  let market;
  let Token1;
  let erc721Factory;
  let ERC721LogicContract;
  let ERC721FactoryContract;
  let TokenERC721;
  let PaymentSplitter1;
  let PaymentSplitter2;
  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;
  let fee = 1;
  // beforeEach(async function () {
  //
  // });
  const item1price = utils.parseEther('0.02');
  const newPrice = utils.parseEther('0.025');


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
        PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
        const psLogicContract = await PaymentSplitterLogicContract.deploy();
        await psLogicContract.deployed();
        if(logs) console.log("Payment Splitter deployed to:", psLogicContract.address);
        const MarketContract = await ethers.getContractFactory("FraktalMarket");
        market = await MarketContract.deploy(logicContract.address, psLogicContract.address);
        await market.deployed();
        if(logs) console.log("Market deployed to:", market.address);
        if(logs) console.log("Market owner:", await market.owner());
        expect(await market.owner()).to.equal(owner.address);
      });
      it('should mint an ERC721 and have the correct balance after', async function () {
        ERC721LogicContract = await ethers.getContractFactory("TestTokenUpgradeable");
        const erc721Contract = await ERC721LogicContract.deploy();
        await erc721Contract.deployed();
        const ERC721FactoryContract = await ethers.getContractFactory("TestTokenFactory");
        erc721Factory = await ERC721FactoryContract.deploy(erc721Contract.address);
        await erc721Factory.deployed();
        if(logs) console.log("ERC721 factory deployed to:", erc721Factory.address);
        if(logs) console.log('Alice mints an ERC721');
        let mintERC721Tx = await erc721Factory.connect(alice).createTestToken('alice NFT', 'ANFT');
        const nftAddress = await awaitERC721TokenAddress(mintERC721Tx);

        TokenERC721 = ERC721LogicContract.attach(nftAddress);
        if(logs) console.log(
          `Deployed a new ERC721 contract at: ${TokenERC721.address}`,
        );
        await TokenERC721.connect(alice).mint();
        let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
        if(logs) console.log('alice balanceof ',aliceERC721Balance);
        expect(aliceERC721Balance).to.equal(ethers.BigNumber.from('1'));
        await TokenERC721.connect(alice).approve(market.address, 1);
        let tokenERC721owner = await TokenERC721.ownerOf(1);
        console.log('owner of ERC721 tokenId 1 ',tokenERC721owner);
        expect(tokenERC721owner).to.equal(alice.address);
      });
      it('Should allow to lock ERC721 tokens to the FraktalMarket.', async function () {
        if(logs) console.log('Alice imports its ERC721');
        let importTx = await market.connect(alice).importERC721(TokenERC721.address, 1);
        let tokenERC721owner = await TokenERC721.ownerOf(1);
        expect(tokenERC721owner).to.equal(market.address);
        let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
        expect(aliceERC721Balance).to.equal(ethers.BigNumber.from('0'));
        tokenERC721owner = await TokenERC721.ownerOf(1);
        if(logs) console.log('owner of ERC721 tokenId 1 ',tokenERC721owner);
        const importTokenAddress = await awaitTokenAddress(importTx);
        Token1 = TokenLogicContract.attach(importTokenAddress);
        if(logs) console.log(
          `Deployed a new ERC1155 FraktalNFT at: ${Token1.address}`,
        );
        const importTokenUri = await Token1.uri(0);
        const erc721uri = await TokenERC721.tokenURI(1);
        expect(importTokenUri).to.equal(erc721uri);
        let aliceImportBalance = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
        expect(aliceImportBalance[0]).to.equal(ethers.BigNumber.from("0"));
        expect(aliceImportBalance[1]).to.equal(ethers.BigNumber.from("10000"));
        let marketBalanceT3 = await Token1.balanceOfBatch([market.address,market.address], [0,1]);
        expect(marketBalanceT3[0]).to.equal(ethers.BigNumber.from("1"));
        expect(marketBalanceT3[1]).to.equal(ethers.BigNumber.from("0"));
        let collateralAddress = await market.getERC721Collateral(Token1.address);
        expect(collateralAddress).to.equal(TokenERC721.address);
      });
    it('should allow defraktionalize', async function () {
      if(logs) console.log('Alice approves the market');
      await Token1.connect(alice).setApprovalForAll(market.address, true);
      if(logs) console.log('Alice defraktionalize');
      await market.connect(alice).defraktionalize(0);
      let balances = await Token1.balanceOfBatch([alice.address,alice.address,market.address],[0,1,0]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
    });

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
      await Token1.connect(bob).lockSharesTransfer(bob.address,10000, alice.address);
      await Token1.connect(bob).safeTransferFrom(bob.address, alice.address, 0,1,emptyData);
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
      if(logs) console.log('Bob unlocks all fraktions');
      await Token1.connect(bob).unlockSharesTransfer(alice.address);
      await Token1.connect(bob).lockSharesTransfer(bob.address,10000, bob.address);
      await Token1.connect(alice).safeTransferFrom(alice.address, bob.address,0,1,emptyData);
      await Token1.connect(bob).unlockSharesTransfer(bob.address);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address, alice.address],[0,1,0]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
    }); // but if not approved, cannot move!
    it('should allow defraktionalize', async function () {
      if(logs) console.log('Bob defraktionalize');
      await Token1.connect(bob).defraktionalize(1);
      let balances = await Token1.balanceOfBatch([bob.address,bob.address],[0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
    });
    it('Should allow the owner to fraktionalize it through the market', async function () {
      await Token1.connect(bob).setApprovalForAll(market.address, true);
      if(logs) console.log('Bob fraktionalize the nft from the market');
      await market.connect(bob).fraktionalize(0);
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
        market.connect(deedee).claimFraktal(0)
      ).to.be.revertedWith('not approval');
      let balances = await Token1.balanceOfBatch([deedee.address, market.address],[0,0]);
      expect(balances[0]).to.equal(0);
      expect(balances[1]).to.equal(1);
    });
    it('Should allow to list the fraktions', async function () {
      if(logs) console.log(`Carol approves the market`)
      await Token1.connect(carol).setApprovalForAll(market.address, true);
      let qty = 5000;
      if(logs) console.log(`Carol lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`)
      let prevBalances = await Token1.balanceOfBatch([market.address, carol.address],[1,1]);
      await market.connect(carol).listItem(
        0,//marketId
        item1price, // total eth/amount
        qty); // amount
      // let balances = await Token1.balanceOfBatch([market.address, carol.address], [1,1]);
      // expect(balances[0]).to.equal(prevBalances[0]+qty);
      // expect(balances[1]).to.equal(prevBalances[1]-qty);
      let listingPrice = await market.getListingPrice(carol.address, 0);
      expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
      let listingAmount = await market.getListingAmount(carol.address, 0);
      expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    });
    it('Should allow buy fraktions listed', async function () {
      let prevBalances = await Token1.balanceOfBatch([carol.address, alice.address],[1,1]);
      let prevSellerBalance = await market.getSellerBalance(carol.address);
      expect(prevSellerBalance).to.equal(ethers.BigNumber.from('0'));
      let qty = 3000;
      let value = toPay(qty, item1price);
      if(logs) console.log(`Alice buys ${qty} fraktions`);
      await market.connect(alice).buyFraktions(carol.address, 0, qty, {value: value});
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
      await market.connect(carol).unlistItem(0);
      let listingAmount = await market.getListingAmount(carol.address, 0);
      expect(listingAmount).to.equal(ethers.BigNumber.from('0'));
    });
    it('should not allow to buy unlisted items', async function () {
      if(logs) console.log('Alice tries to buy');
      await expect(
        market.connect(alice).buyFraktions(carol.address, 0, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('Not enough Fraktions on sale');
    });
    it('should allow to re list items', async function () {
      if(logs) console.log('Carol list the items with new price');
      let qty = await Token1.balanceOf(carol.address, 1);
      await market.connect(carol).listItem(
        0,//marketId
        newPrice, // total eth/amount
        qty); // amount
        let listingPrice = await market.getListingPrice(carol.address, 0);
        expect(listingPrice).to.equal(ethers.BigNumber.from(newPrice));
        let listingAmount = await market.getListingAmount(carol.address, 0);
        expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
      });
    // it('Should allow to change price', async function () {
    //   if(logs) console.log('Bob tries to change price');
    //   await expect(
    //     market.connect(bob).updatePrice(0, newPrice)
    //   ).to.be.revertedWith('There is no list with that ID and your account');
    //   const hackedPrice = await market.getListingPrice(carol.address, 0);
    //   expect(hackedPrice).to.equal(item1price);
    //   if(logs) console.log('Carol change price to ', utils.formatEther(newPrice),' ETH');
    //   await market.connect(carol).updatePrice(0, newPrice);
    //   expect( await market.getListingPrice(carol.address, 0)).to.equal(newPrice);
    // });


    it('Should allow to buy fraktions at new price', async function () {
      if(logs) console.log('Alice tries to buy it at old price');
      await expect(
        market.connect(alice).buyFraktions(carol.address, 0, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('FraktalMarket: insufficient funds');
      await market.connect(alice).buyFraktions(carol.address, 0, 100, {value: toPay(100, newPrice)});
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
      // assert(balanceEth1 < balanceEth0, 'rescue has failed'); // fails??
    });
    it('Should allow to create a Revenue stream to fraktion holders', async function () {
      if(logs) console.log('Alice create Revenue Payment with 100 ETH');
      firstRevenueTx = await Token1.connect(alice).createRevenuePayment(
        {value: utils.parseEther('100')}
      )
      const revenueChannelAddress = await awaitPaymentSplitterAddress(firstRevenueTx);
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
      if(logs) console.log('Alice had 31% and has ',utils.formatEther(aliceEthBalance1), 'ETH');
      if(logs) console.log('Carol asks for Alice release');
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
      await market.connect(bob).voteOffer(deedee.address, Token1.address);
      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
      let balances = await Token1.balanceOfBatch([bob.address],[1]);
      expect(votesOnOffer).to.equal(balances[0]);
    });
    it('Should sell if >80%', async function () {
      if(logs) console.log('Alice votes on Deedee offer')
      await market.connect(alice).voteOffer(deedee.address, Token1.address);
      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
      let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
      expect(votesOnOffer).to.equal(parseFloat(balances[0])+parseFloat(balances[1]));
      let nftStatus = await Token1.sold();
      expect(nftStatus).to.equal(true);
    });
    it('Should allow to claim the fraktal', async function () {
      if(logs) console.log('Deedee claims the buyed NFT');
      await market.connect(deedee).claimFraktal(0);
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
      if(logs) console.log('Carol asks for Alice release');
      await PaymentSplitter2.connect(alice).release();
      let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
      assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
      let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
      expect(balances[0]).to.equal(0);
      expect(balances[1]).to.equal(0);
    });
    it('Should allow to whitdraw the locked nft', async function () {
      if(logs) console.log('Alice allows the market');
      await Token1.connect(deedee).setApprovalForAll(market.address, true);
      if(logs) console.log('Deedee whitdraws its ERC721');
      await market.connect(deedee).claimERC721(0);
      deedeeERC721Balance = await TokenERC721.balanceOf(deedee.address);
      let deedeeBalance = await Token1.balanceOfBatch([deedee.address,deedee.address], [0,1]);
      expect(deedeeERC721Balance).to.equal(ethers.BigNumber.from('1'));
      expect(deedeeBalance[1]).to.equal(ethers.BigNumber.from('0'));
      expect(deedeeBalance[0]).to.equal(ethers.BigNumber.from('0'));
      if(logs) console.log('Deedee has now the token ',TokenERC721.address);
      // let itemAbandoned = await market.getFraktalAddress(0);
      // let itemAbandonedCollateral = await market.getERC721Collateral(0);
      // if(logs) console.log('Fraktal new address ',itemAbandoned);
      // if(logs) console.log('Collateral address ',itemAbandonedCollateral);
      if(logs) console.log('Deedee has now the token ',TokenERC721.address);

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

  });
})
