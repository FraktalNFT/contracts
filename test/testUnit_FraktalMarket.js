const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = false; 
///////////////////////////////////////////////////////////////////////CONSTANTS
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

const item1price = utils.parseEther('0.02');
const newPrice = utils.parseEther('0.025');

///////////////////////////////////////////////////////////////////////FUNCTIONS
function toPay(qty, price) {
  const priceN = utils.formatEther(price);
  if(logs) console.log('priceN', priceN);
  if(logs) console.log('qty', parseFloat(qty));
  const toPayWei = priceN * parseFloat(qty);
  // const toPayWfees = toPayWei + (toPayWei * fee/100) + 0.0001; // extra for gas errors
  const toPayFixed = toPayWei + 0.0001; // sum a little for errors in gas??? CAUTION
  // if(logs) console.log('total ',toPayWfees);
  return utils.parseEther(toPayFixed.toString());
}

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
///////////////////////////////////////////////////////////////////////////TESTS
describe("Fraktal Market", function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;
  let IPaymentSplitter;

  let factory;

  let Token;
  let PaymentSplitter1;
  let PaymentSplitter2;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

  before('Getting accounts - deploying contracts', async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    if(logs) console.log('Alice address: ',alice.address);
    if(logs) console.log('bob address: ',bob.address);
    if(logs) console.log('carol address: ',carol.address);
    FraktalImplementationContract = await ethers.getContractFactory("FraktalNFT");
    logicContract = await FraktalImplementationContract.deploy();
    await logicContract.deployed();
    if(logs) console.log("FraktalNFT deployed to:", logicContract.address);
    PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    psLogicContract = await PaymentSplitterLogicContract.deploy();
    await psLogicContract.deployed();
    if(logs) console.log("Payment Splitter deployed to:", psLogicContract.address);
    const FactoryContract = await ethers.getContractFactory("FraktalFactory");
    factory = await FactoryContract.deploy(logicContract.address, psLogicContract.address);
    await factory.deployed();
    if(logs) console.log("Factory deployed to:", factory.address);
    if(logs) console.log("Factory owner:", await factory.owner());
    const mintTx = await factory.connect(alice).mint(testUri, 8000);
    const TokenAddress = await awaitTokenAddress(mintTx);
    Token = FraktalImplementationContract.attach(TokenAddress);
    if(logs) console.log(
      `Deployed a new ERC1155 FraktalNFT at: ${Token.address}`,
    );
    await Token.connect(alice).fraktionalize(alice.address, 1);
  });
  describe('Market deployment & config', async function () {
    it('Should deploy to the correct owner', async function () {
      let defaultFee = 100;
      const MarketContract = await ethers.getContractFactory("FraktalMarket");
      market = await MarketContract.deploy();
      await market.deployed();
      if(logs) console.log("Market deployed to:", market.address);
      if(logs) console.log("Market owner:", await market.owner());
      expect(await market.owner()).to.equal(owner.address);
      expect(await market.fee()).to.equal(defaultFee);
    });
    it('Should allow only the owner to set market fee', async function () {
      // fee is uint16 (max 10000) so try to break it!! (>10k would be a fee of >100%)
      let newFee = 1000;
      await expect(
        market.connect(alice).setFee(newFee)
      ).to.be.reverted;
      await market.connect(owner).setFee(newFee);
      expect(await market.fee()).to.be.equal(newFee)
    });
  });

  describe('Functions',async function () {
    it('Should allow the owner to send it to the market', async function () {
      if(logs) console.log('Alice approves the market');
      await Token.connect(alice).setApprovalForAll(market.address, true);
      if(logs) console.log('Bob sends the nft through the market');
      await Token.connect(alice).lockSharesTransfer(alice.address,10000,market.address);
      await Token.connect(alice).safeTransferFrom(alice.address, market.address, 0, 1, emptyData);
      await Token.connect(alice).unlockSharesTransfer(market.address);
      let balances = await Token.balanceOfBatch([alice.address,alice.address, market.address], [0,1,0]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
    });
    it('Should not allow to list more than balance', async function () {
      if(logs) console.log('Alice tries to list more than its balance');
      await expect(
        market.connect(bob).listItem(Token.address,item1price,10001)
      ).to.be.revertedWith('no valid Fraktions');
    });
    it('Should allow to list the fraktions', async function () {
      let qty = 5000;
      if(logs) console.log(`Alice lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`)
      await market.connect(alice).listItem(
        Token.address,
        item1price, // total eth/amount
        qty); // amount
      let listingPrice = await market.getListingPrice(alice.address, Token.address);
      expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
      let listingAmount = await market.getListingAmount(alice.address, Token.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    });
    it('Should allow buy fraktions listed', async function () {
      let prevBalances = await Token.balanceOfBatch([carol.address, alice.address],[1,1]);
      let prevSellerBalance = await market.getSellerBalance(alice.address);
      expect(prevSellerBalance).to.equal(ethers.BigNumber.from('0'));
      let qty = 3000;
      let value = toPay(qty, item1price);
      if(logs) console.log(`Carol buys ${qty} fraktions`);
      await market.connect(carol).buyFraktions(alice.address, Token.address, qty, {value: value});
      let balances = await Token.balanceOfBatch([carol.address, alice.address],[1,1]);
      let sellerBalance = await market.getSellerBalance(alice.address);
      // expect(sellerBalance).to.bigger(ethers.BigNumber.from());
      assert(sellerBalance > prevSellerBalance, 'Seller payment didnt enter')
      if(logs) console.log(`Alice has now a balance of ${utils.formatEther(sellerBalance)} ETH`)
      expect(balances[1]).to.equal(prevBalances[1] - qty);
      expect(balances[0]).to.equal(qty);
    });
    it('Should allow to retrieve minimum offer', async function () {
      minOffer = await market.maxPriceRegistered(Token.address);
      if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
      expect(minOffer).to.equal(utils.parseEther((utils.formatEther(item1price)*10000).toString()));
    });
    it('Should allow to make offers', async function () {
      if(logs) console.log('Deedee makes an offer on the token')
      await market.connect(deedee).makeOffer(Token.address, utils.parseEther('200'),{value: utils.parseEther('200')});
      let offerValue = await market.getOffer(deedee.address, Token.address);
      expect(offerValue).to.equal(utils.parseEther('200'))
    });
    it('Should allow to take out an offer', async function () {
      if(logs) console.log('Deedee takes the offer out');
      let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
      await market.connect(deedee).makeOffer(Token.address, utils.parseEther('0'),{value: utils.parseEther('0.00001')});
      let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
      let offerValue = await market.getOffer(deedee.address, Token.address);
      expect(offerValue).to.equal(utils.parseEther('0'));
      assert(deedeeEthBalance1 > deedeeEthBalance0, 'offer not taken');
    });
    it('should allow to unlist the fraktions', async function () {
      if(logs) console.log('Alice unlist the items');
      await market.connect(alice).unlistItem(Token.address);
      let listingAmount = await market.getListingAmount(alice.address, Token.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from('0'));
    });
    it('should not allow to buy unlisted items', async function () {
      if(logs) console.log('Bob tries to buy');
      await expect(
        market.connect(bob).buyFraktions(alice.address, Token.address, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('Not enough Fraktions on sale');
    });
    it('should allow to re list items', async function () {
      let qty = await Token.balanceOf(alice.address, 1);
      if(logs) console.log(`Alice list ${qty} the items with new price`);
      await market.connect(alice).listItem(Token.address,newPrice,qty);
      let listingPrice = await market.getListingPrice(alice.address, Token.address);
      expect(listingPrice).to.equal(ethers.BigNumber.from(newPrice));
      let listingAmount = await market.getListingAmount(alice.address, Token.address);
      expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    });
    it('Should allow to buy fraktions at new price', async function () {
      if(logs) console.log('Carol tries to buy it at old price');
      await expect(
          market.connect(carol).buyFraktions(alice.address, Token.address, 10, {value: toPay(10,item1price)})
        ).to.be.revertedWith('FraktalMarket: insufficient funds');
      await market.connect(carol).buyFraktions(alice.address, Token.address, 100, {value: toPay(100, newPrice)});
      let balances = await Token.balanceOfBatch([carol.address, alice.address],[1,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('3100'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('6900'));
    });
    it('Should allow to retrieve new minimum offer', async function () {
      minOffer = await market.maxPriceRegistered(Token.address);
      if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
      expect(minOffer).to.equal(utils.parseEther((utils.formatEther(newPrice)*10000).toString()));
    });
    it('should allow to rescue gains', async function () {
      if(logs) console.log('Alice rescue ETH')
      let sellerBalance0 = await market.getSellerBalance(alice.address);
      let balanceEth0 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log(`Carol has a balance of ${utils.formatEther(sellerBalance0)} ETH`)
      await market.connect(alice).rescueEth();
      let sellerBalance1 = await market.getSellerBalance(alice.address);
      let balanceEth1 = await ethers.provider.getBalance(alice.address);
      if(logs) console.log(`Balance was ${utils.formatEther(balanceEth0)} and now is ${utils.formatEther(balanceEth1)}`)
      expect(sellerBalance1).to.equal(0)
    });
    it('Should allow to make offers', async function () {
      if(logs) console.log('Deedee makes an offer on the token')
      await expect(
        market.connect(deedee).makeOffer(Token.address, utils.parseEther('200'),{value: utils.parseEther('200')})
      ).to.be.revertedWith('Min offer');
      await market.connect(deedee).makeOffer(Token.address, utils.parseEther('250'),{value: utils.parseEther('250')});
      await market.connect(bob).makeOffer(Token.address, utils.parseEther('250'),{value: utils.parseEther('250')});
      await market.connect(carol).makeOffer(Token.address, utils.parseEther('250'),{value: utils.parseEther('250')});
      let offerValue = await market.getOffer(deedee.address, Token.address);
      expect(offerValue).to.equal(utils.parseEther('250'))
    });
    it('Should allow to vote on offers', async function () {
      if(logs) console.log('Carol votes on Deedee offer')
      await Token.connect(carol).setApprovalForAll(market.address, true);
      await market.connect(carol).voteOffer(deedee.address, Token.address);
    });
    it('Should sell if > majority', async function () {
      if(logs) console.log('Alice votes on Deedee offer')
      await market.connect(alice).voteOffer(deedee.address, Token.address);
      let nftStatus = await Token.sold();
      expect(nftStatus).to.equal(true);
    });
    it('Should not allow anyone to claim the fraktal', async function () {
      if(logs) console.log('Bob claims the buyed NFT');
      await expect(
        market.connect(bob).claimFraktal(Token.address)
      ).to.be.revertedWith('not buyer');
      let balances = await Token.balanceOfBatch([deedee.address, market.address],[0,0]);
      expect(balances[0]).to.equal(0);
      expect(balances[1]).to.equal(1);
    });
    it('Should not allow to unlock fraktions once sold', async function (){
      if(logs) console.log('Alice tries to unlock fraktions');
      await expect(
        Token.connect(alice).unlockSharesTransfer(deedee.address)
      ).to.be.revertedWith('item sold');
    });
    it('Should not allow to send fraktions after sell', async function () {
    //
    // // Its reverting the tx with >
    // // Error: invalid arrayify value (argument="value", value="", code=INVALID_ARGUMENT, version=bytes/5.4.0)
    //
       if(logs) console.log('Alice tries send fraktions');
       await expect(
         Token.connect(bob).safeTransferFrom(bob.address, alice.address, 1,1,'')
       ).to.be.reverted;
    });
    it('Should allow not winners to take out offers', async function () {
	let prevBal = await ethers.provider.getBalance(bob.address);
	await market.connect(bob).makeOffer(Token.address, utils.parseEther('0'),{value: utils.parseEther('0.00000000000000001')})
	let formerBal = await ethers.provider.getBalance(bob.address);
	expect(formerBal).to.gt(prevBal);
    });
    it('Should not allow buyer to take out offer after sell', async function () {
       if(logs) console.log('Deedee takes out its offer');
       let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
       await expect(
         market.connect(deedee).makeOffer(Token.address, utils.parseEther('0'),{value: utils.parseEther('0.00001')})
       ).to.be.revertedWith('offer accepted');
       let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
       expect(deedeeEthBalance1).to.be.equal(deedeeEthBalance1);
    });
    it('Should not allow to list fraktions of used indexes',async function () {
      if(logs) console.log('Carol tries to list fraktions');
      await expect(
        market.connect(carol).listItem(Token.address,item1price,1)
      ).to.be.revertedWith('item sold');
    });
    it('Should allow to claim the fraktal', async function () {
      if(logs) console.log('Deedee claims the buyed NFT');
      await market.connect(deedee).claimFraktal(Token.address);
      let balances = await Token.balanceOfBatch([deedee.address, market.address],[0,0]);
      expect(balances[0]).to.equal(1);
      expect(balances[1]).to.equal(0);
    });
     it('Should allow not winners to take out offers', async function () {
	let prevBal = await ethers.provider.getBalance(carol.address);
	await market.connect(carol).makeOffer(Token.address, utils.parseEther('0'),{value: utils.parseEther('0.00000000000000001')})
	let formerBal = await ethers.provider.getBalance(carol.address);
	expect(formerBal).to.gt(prevBal);
    });
    it('Should not allow to list fraktions of NFT not in the market',async function () {
      if(logs) console.log('Carol tries to list old fraktions');
      await expect(
        market.connect(carol).listItem(Token.address,item1price,1)
      ).to.be.revertedWith('nft not in market');
    });
    it('should allow to retrieve the gains and burn the fraktions', async function () {
        if(logs) console.log('First find the revenue channel address');
        let lastRevenue = await Token.getRevenue(0);
        if(logs) console.log('sell revenue in ',lastRevenue)
        PaymentSplitter2 = await ethers.getContractAt("IPaymentSplitter",lastRevenue);
        if(logs) console.log('Users need to approve the payment revenue channel ')
        await Token.connect(alice).setApprovalForAll(PaymentSplitter2.address,1);
        await Token.connect(carol).setApprovalForAll(PaymentSplitter2.address,1);
        let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
        let carolEthBalance1 = await ethers.provider.getBalance(carol.address);
        if(logs) console.log('Alice has ',utils.formatEther(aliceEthBalance1), 'ETH');
        await PaymentSplitter2.connect(alice).release();
        await PaymentSplitter2.connect(carol).release();
        let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
        if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
        assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
        let balances = await Token.balanceOfBatch([carol.address, alice.address],[1,1]);
        let remaining = await ethers.provider.getBalance(PaymentSplitter2.address);
        if(logs) console.log('In the channel there is ',utils.formatEther(remaining), 'ETH');
        expect(balances[1]).to.equal(0);
        expect(balances[0]).to.equal(0);
    });
    it('Should allow the owner to send it to the market.. again', async function () {
       if(logs) console.log('Deedee approves the market');
	await Token.connect(deedee).fraktionalize(deedee.address, 2);
       await Token.connect(deedee).setApprovalForAll(market.address, true);
       if(logs) console.log('DD sends the nft to the market');
       await Token.connect(deedee).lockSharesTransfer(deedee.address,10000,market.address);
       await Token.connect(deedee).safeTransferFrom(deedee.address, market.address, 0, 1, emptyData);
       await Token.connect(deedee).unlockSharesTransfer(market.address);
       let balances = await Token.balanceOfBatch([deedee.address,deedee.address, market.address], [0,2,0]);
       expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
       expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
       expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
     });
     it('Should allow to list the new fraktions (same token address)', async function () {
       let qty = 5000;
       if(logs) console.log(`DD lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`)
       await market.connect(deedee).listItem(
         Token.address,
         item1price, // total eth/amount
         qty); // amount
       let listingPrice = await market.getListingPrice(deedee.address, Token.address);
       expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
       let listingAmount = await market.getListingAmount(deedee.address, Token.address);
       expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
       let minOffer = await market.maxPriceRegistered(Token.address);
       expect(minOffer).to.be.equal(ethers.BigNumber.from('0'));
       if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
     });
    it('Should allow other users to list the same token Fraktions', async function () {
       if(logs) console.log('DD sends 5k Fraktions to Alice');
       await Token.connect(deedee).safeTransferFrom(deedee.address, alice.address, 2, 5000, emptyData);
       if(logs) console.log('Alice lists 5k Fraktions at a different price');
	await market.connect(alice).unlistItem(Token.address);
       await market.connect(alice).listItem(Token.address, newPrice, 5000);
       let balances = await Token.balanceOfBatch([market.address, deedee.address, alice.address],[0,2,2]);
       expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
       expect(balances[1]).to.equal(ethers.BigNumber.from('5000'));
       expect(balances[2]).to.equal(ethers.BigNumber.from('5000'));
       let listingPrice2 = await market.getListingPrice(alice.address, Token.address);
       expect(listingPrice2).to.equal(ethers.BigNumber.from(newPrice));
       let listingAmount2 = await market.getListingAmount(alice.address, Token.address);
       expect(listingAmount2).to.equal(ethers.BigNumber.from('5000'));
    });
    it('Should handle buys in both listings', async function () {
         if(logs) console.log('Bob buys from Alice');
         await market.connect(bob).buyFraktions(alice.address, Token.address, 1000, {value: toPay(1000, newPrice)});
         if(logs) console.log('Carol buys from Deedee');
         await market.connect(carol).buyFraktions(deedee.address, Token.address, 2000, {value: toPay(2000, item1price)});
         let balances = await Token.balanceOfBatch([alice.address,bob.address,carol.address,deedee.address],[2,2,2,2]);
         //console.log('balances',balances);
         expect(balances[0]).to.equal(ethers.BigNumber.from('4000'));
         expect(balances[1]).to.equal(ethers.BigNumber.from('1000'));
         expect(balances[2]).to.equal(ethers.BigNumber.from('2000'));
         expect(balances[3]).to.equal(ethers.BigNumber.from('3000'));
         });
    // what else to test?
	  // 
 
    // Admin functions
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
   // it('Should not allow to claim the fraktal', async function () {
    //   if(logs) console.log('Deedee claims the NFT');
    //   await expect(
    //     market.connect(deedee).claimFraktal(Token.address)
    //   ).to.be.revertedWith('not approval');
    //   if(logs) console.log('Bob claims the NFT');
    //   await expect(
    //     market.connect(bob).claimFraktal(Token.address)
    //   ).to.be.revertedWith('not approval');
    //   if(logs) console.log('Alice claims the NFT');
    //   await expect(
    //     market.connect(alice).claimFraktal(Token.address)
    //   ).to.be.revertedWith('not approval');
    //   let balances = await Token.balanceOfBatch([deedee.address,bob.address,alice.address, market.address],[0,0,0,0]);
    //   expect(balances[0]).to.equal(0);
    //   expect(balances[1]).to.equal(0);
    //   expect(balances[2]).to.equal(0);
    //   expect(balances[3]).to.equal(1);
    // });

  });
});

////////////////////////////////////////////////////////////////////////////////
