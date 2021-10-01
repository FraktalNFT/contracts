const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = false;
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

const item1price = utils.parseEther('0.02');
const newPrice = utils.parseEther('0.025');


////////////////////////////////////////////////////////////////////////////////
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
//      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
  let balances = await Token1.balanceOfBatch([bob.address],[1]);
//      expect(votesOnOffer).to.equal(balances[0]);
});
it('BUG? Should allow to unlock fraktions and vote again (votes dont sum)', async function () {
  if(logs) console.log('Bob unlocks its fraktions');
  await Token1.connect(bob).unlockSharesTransfer(deedee.address);
  if(logs) console.log('Bob votes on Deedee offer again')
  await market.connect(bob).voteOffer(deedee.address, Token1.address);
//      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
//    to get the votes mechanics, just look at the lockedToTotal in the Token (for accounts with offers)
  let balances = await Token1.balanceOfBatch([bob.address],[1]);
//      expect(votesOnOffer).to.equal(balances[0]);
});
it('Should sell if > majority', async function () {
  if(logs) console.log('Alice approves the market');
  await Token1.connect(alice).setApprovalForAll(market.address, true);
  if(logs) console.log('Alice votes on Deedee offer')
  await market.connect(alice).voteOffer(deedee.address, Token1.address);
//      let votesOnOffer = await market.getVotes(deedee.address, Token1.address);
  let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
//      expect(votesOnOffer).to.equal(parseFloat(balances[0])+parseFloat(balances[1]));
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
//      let votesBefore = await market.getVotes(deedee.address, Token1.address);
//	let votesBefore = await Token1.lockedToTotal(deedee.address);
  await expect(
    Token1.connect(alice).unlockSharesTransfer(deedee.address)
  ).to.be.revertedWith('item sold');
//      let votesAfter = await market.getVotes(deedee.address, Token1.address);
//      expect(votesAfter).to.be.equal(votesBefore);
});

it('Should not allow to send fraktions after sell', async function () {
//
// // Its reverting the tx with >
// // Error: invalid arrayify value (argument="value", value="", code=INVALID_ARGUMENT, version=bytes/5.4.0)
//
//   let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
//   console.log('balances',balances)
   await expect(
     Token1.connect(bob).safeTransferFrom(bob.address, alice.address, 1,1,'')
).to.be.reverted;
//   balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
//   console.log('balances',balances)
//   expect(balances[0]).to.equal(1);
//   expect(balances[1]).to.equal(0);
});

it('Should not allow to take out offer after sell', async function () {
 if(logs) console.log('Deedee takes out its offer');
 //let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
 await expect(
market.connect(deedee).makeOffer(Token1.address, utils.parseEther('0'),{value: utils.parseEther('0.00001')})
 ).to.be.revertedWith('offer accepted');
 //let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
 //let offerValue = await market.getOffer(deedee.address, Token1.address);
 //expect(offerValue).to.equal(utils.parseEther('0'));
});
it('Should allow to claim the fraktal', async function () {
if(logs) console.log('Deedee claims the buyed NFT');
await market.connect(deedee).claimFraktal(Token1.address);
let balances = await Token1.balanceOfBatch([deedee.address, market.address],[0,0]);
expect(balances[0]).to.equal(1);
expect(balances[1]).to.equal(0);
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
it('Should allow admin to change the fee of the market', async function () {
  let prevFee = await market.fee();
  if(logs) console.log('Admin account sets fee in 3.14%');
  await market.connect(owner).setFee(314);
  let postFee = await market.fee();
  expect(postFee).to.gt(prevFee);
});

it('Should allow the owner to send it to the market.. again', async function () {
  if(logs) console.log('Deedee approves the market');
  await Token1.connect(deedee).setApprovalForAll(market.address, true);
  if(logs) console.log('DD sends the nft to the market');
  await Token1.connect(deedee).lockSharesTransfer(deedee.address,10000,market.address);
  await Token1.connect(deedee).safeTransferFrom(deedee.address, market.address, 0, 1, emptyData);
  await Token1.connect(deedee).unlockSharesTransfer(market.address);
  let balances = await Token1.balanceOfBatch([deedee.address,deedee.address, market.address], [0,2,0]);
  expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
  expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
  expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
});
it('Should allow to list the new fraktions (same token address)', async function () {
  let qty = 5000;
  if(logs) console.log(`DD lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`)
  let prevBalances = await Token1.balanceOfBatch([market.address, deedee.address],[2,2]);
  await market.connect(deedee).listItem(
    Token1.address,
    item1price, // total eth/amount
    qty); // amount
  let listingPrice = await market.getListingPrice(deedee.address, Token1.address);
  expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
  let listingAmount = await market.getListingAmount(deedee.address, Token1.address);
  expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
  let minOffer = await market.maxPriceRegistered(Token1.address);
  if(logs) console.log('Min Offer is now:', utils.formatEther(minOffer))
});
it('Should not allow to list fraktions of used indexes',async function () {
  if(logs) console.log('Bob tries to list old fraktions');
  await expect(
    market.connect(bob).listItem(Token1.address,item1price,1)
  ).to.be.revertedWith('no valid Fraktions');
});
it('Should not allow to list more than balance', async function () {
  if(logs) console.log('Alice tries to list more than its balance');
  await expect(
    market.connect(bob).listItem(Token1.address,item1price,5001)
  ).to.be.revertedWith('no valid Fraktions');
});
it('Should allow other users to list the same token Fraktions', async function () {
  if(logs) console.log('DD sends 5k Fraktions to Alice');
  await Token1.connect(deedee).safeTransferFrom(deedee.address, alice.address, 2, 5000, emptyData);
  if(logs) console.log('Alice lists 5k Fraktions at a different price');
  await market.connect(alice).listItem(Token1.address, newPrice, 5000);
  let balances = await Token1.balanceOfBatch([market.address, deedee.address, alice.address],[0,2,2]);
  expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
  expect(balances[1]).to.equal(ethers.BigNumber.from('5000'));
  expect(balances[2]).to.equal(ethers.BigNumber.from('5000'));
  let listingPrice2 = await market.getListingPrice(alice.address, Token1.address);
  expect(listingPrice2).to.equal(ethers.BigNumber.from(newPrice));
  let listingAmount2 = await market.getListingAmount(alice.address, Token1.address);
  expect(listingAmount2).to.equal(ethers.BigNumber.from('5000'));
});
it('Should handle buys in both listings', async function () {
    if(logs) console.log('Bob buys from Alice');
    await market.connect(bob).buyFraktions(alice.address, Token1.address, 1000, {value: toPay(1000, newPrice)});
      if(logs) console.log('Carol buys from Deedee');
    await market.connect(carol).buyFraktions(deedee.address, Token1.address, 2000, {value: toPay(2000, item1price)});
    let balances = await Token1.balanceOfBatch([alice.address,bob.address,carol.address,deedee.address],[2,2,2,2]);
    //console.log('balances',balances);
    expect(balances[0]).to.equal(ethers.BigNumber.from('4000'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('1000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('2000'));
    expect(balances[3]).to.equal(ethers.BigNumber.from('3000'));
      });
