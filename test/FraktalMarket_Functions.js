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

describe('Fraktal Market - Functions', function () {
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

  it('Should allow the owner to send it to the market', async function () {
    log('first, the market obj',market)
    log('Alice approves the market');
    await Token.connect(alice).setApprovalForAll(market.address, true);
    log('Alice sends the nft through the market');
    await market.connect(alice).importFraktal(Token.address, 1);
    // await Token.connect(alice).lockSharesTransfer(alice.address,10000,market.address);
    // await Token.connect(alice).safeTransferFrom(alice.address, market.address, 0, 1, emptyData);
    // await Token.connect(alice).unlockSharesTransfer(alice.address,market.address);
    let balances = await Token.balanceOfBatch(
      [alice.address, alice.address, market.address],
      [0, 1, 0],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
  });
  it('Should allow the owner to defraktionalize', async function () {
    log('Bob tries to export the fraktal')
    await expect(
      market.connect(bob).exportFraktal(Token.address)
    ).to.be.revertedWith('ERC1155: caller is not owner nor approved')
    log('Alice defraks');
    await market.connect(alice).exportFraktal(Token.address);
    let balances = await Token.balanceOfBatch(
      [alice.address, alice.address, market.address],
      [0, 1, 0],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
  });
  it('Should allow the owner to re import in the market (repeated fraktionsIndex)', async function () {
    log('Alice sends the nft through the market');
    await market.connect(alice).importFraktal(Token.address, 1);
    let balances = await Token.balanceOfBatch(
      [alice.address, alice.address, market.address],
      [0, 1, 0],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
  });

  it('Should not allow to list more than balance', async function () {
    log('Alice tries to list more than its balance');
    await expect(
      market.connect(bob).listItem(Token.address, item1price, 10001),
    ).to.be.revertedWith('no valid Fraktions');
	});
	
  it('Should allow to list the fraktions', async function () {
    let qty = 5000;
    log(`Alice lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`);
    await market.connect(alice).listItem(
      Token.address,
      item1price, // total eth/amount
      qty,
    ); // amount
    let listingPrice = await market.getListingPrice(
      alice.address,
      Token.address,
    );
    expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
    let listingAmount = await market.getListingAmount(
      alice.address,
      Token.address,
    );
    expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
	});
	
  it('Should allow buy fraktions listed', async function () {
    let prevBalances = await Token.balanceOfBatch(
      [carol.address, alice.address],
      [1, 1],
    );
    let prevSellerBalance = await market.getSellerBalance(alice.address);
    expect(prevSellerBalance).to.equal(ethers.BigNumber.from('0'));
    let qty = 3000;
    let value = toPay(qty, item1price);
    log(`Carol buys ${qty} fraktions`);
    await market
      .connect(carol)
      .buyFraktions(alice.address, Token.address, qty, { value: value });
    let balances = await Token.balanceOfBatch(
      [carol.address, alice.address],
      [1, 1],
    );
    let sellerBalance = await market.getSellerBalance(alice.address);
    // expect(sellerBalance).to.bigger(ethers.BigNumber.from());
    assert(sellerBalance > prevSellerBalance, 'Seller payment didnt enter');
    log(`Alice has now a balance of ${utils.formatEther(sellerBalance)} ETH`);
    expect(balances[1]).to.equal(prevBalances[1] - qty);
    expect(balances[0]).to.equal(qty);
	});
	
  it('Should allow to retrieve minimum offer', async function () {
    const minOffer = await market.maxPriceRegistered(Token.address);
    log('Min Offer is now:', utils.formatEther(minOffer));
    expect(minOffer).to.equal(
      utils.parseEther((utils.formatEther(item1price) * 10000).toString()),
    );
	});
	
  it('Should allow to make offers', async function () {
    log('Deedee makes an offer on the token');
    await market
      .connect(deedee)
      .makeOffer(Token.address, utils.parseEther('200'), {
        value: utils.parseEther('200'),
      });
    let offerValue = await market.getOffer(deedee.address, Token.address);
    expect(offerValue).to.equal(utils.parseEther('200'));
	});
	
  it('Should allow to take out an offer', async function () {
    log('Deedee takes the offer out');
    let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
    await market
      .connect(deedee)
      .makeOffer(Token.address, utils.parseEther('0'), {
        value: utils.parseEther('0.00001'),
      });
    let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
    let offerValue = await market.getOffer(deedee.address, Token.address);
    expect(offerValue).to.equal(utils.parseEther('0'));
    assert(deedeeEthBalance1 > deedeeEthBalance0, 'offer not taken');
	});
	
  it('should allow to unlist the fraktions', async function () {
    log('Alice unlist the items');
    await market.connect(alice).unlistItem(Token.address);
    let listingAmount = await market.getListingAmount(
      alice.address,
      Token.address,
    );
    expect(listingAmount).to.equal(ethers.BigNumber.from('0'));
	});
	
  it('should not allow to buy unlisted items', async function () {
    log('Bob tries to buy');
    await expect(
      market.connect(bob).buyFraktions(alice.address, Token.address, 10, {
        value: toPay(10, item1price),
      }),
    ).to.be.revertedWith('Not enough Fraktions on sale');
	});
	
  it('should allow to re list items', async function () {
    let qty = await Token.balanceOf(alice.address, 1);
    log(`Alice list ${qty} the items with new price`);
    await market.connect(alice).listItem(Token.address, newPrice, qty);
    let listingPrice = await market.getListingPrice(
      alice.address,
      Token.address,
    );
    expect(listingPrice).to.equal(ethers.BigNumber.from(newPrice));
    let listingAmount = await market.getListingAmount(
      alice.address,
      Token.address,
    );
    expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
	});
	
  it('Should allow to buy fraktions at new price', async function () {
    log('Carol tries to buy it at old price');
    await expect(
      market.connect(carol).buyFraktions(alice.address, Token.address, 10, {
        value: toPay(10, item1price),
      }),
    ).to.be.revertedWith('FraktalMarket: insufficient funds');
    await market
      .connect(carol)
      .buyFraktions(alice.address, Token.address, 100, {
        value: toPay(100, newPrice),
      });
    let balances = await Token.balanceOfBatch(
      [carol.address, alice.address],
      [1, 1],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('3100'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('6900'));
	});
	
  it('Should allow to retrieve new minimum offer', async function () {
    // ? minOffer but function is called maxPriceRegistered?
    const minOffer = await market.maxPriceRegistered(Token.address);
    log(`Min Offer is now: ${utils.formatEther(minOffer)}`);
    expect(minOffer).to.equal(
      utils.parseEther((utils.formatEther(newPrice) * 10000).toString()),
    );
  });
  it('should allow to rescue gains', async function () {
    log('Alice rescue ETH');
    let sellerBalance0 = await market.getSellerBalance(alice.address);
    let balanceEth0 = await ethers.provider.getBalance(alice.address);
    log(`Carol has a balance of ${utils.formatEther(sellerBalance0)} ETH`);
    await market.connect(alice).rescueEth();
    let sellerBalance1 = await market.getSellerBalance(alice.address);
    let balanceEth1 = await ethers.provider.getBalance(alice.address);
    log(
      `Balance was ${utils.formatEther(
        balanceEth0,
      )} and now is ${utils.formatEther(balanceEth1)}`,
    );
    expect(sellerBalance1).to.equal(0);
  });
  it('Should allow to make offers', async function () {
    log('Deedee makes an offer on the token');
    await expect(
      market.connect(deedee).makeOffer(Token.address, utils.parseEther('200'), {
        value: utils.parseEther('200'),
      }),
    ).to.be.revertedWith('Min offer');
    await market
      .connect(deedee)
      .makeOffer(Token.address, utils.parseEther('250'), {
        value: utils.parseEther('250'),
      });
    await market
      .connect(bob)
      .makeOffer(Token.address, utils.parseEther('250'), {
        value: utils.parseEther('250'),
      });
    await market
      .connect(carol)
      .makeOffer(Token.address, utils.parseEther('250'), {
        value: utils.parseEther('250'),
      });
    let offerValue = await market.getOffer(deedee.address, Token.address);
    expect(offerValue).to.equal(utils.parseEther('250'));
  });
  it('Should allow to vote on offers', async function () {
    log('Carol votes on Deedee offer');
    await Token.connect(carol).setApprovalForAll(market.address, true);
    await market.connect(carol).voteOffer(deedee.address, Token.address);
  });
  it('Should sell if > majority', async function () {
    log('Alice votes on Deedee offer');
    await market.connect(alice).voteOffer(deedee.address, Token.address);
    let nftStatus = await Token.sold();
    expect(nftStatus).to.equal(true);
  });
  it('Should not allow anyone to claim the fraktal', async function () {
    log('Bob claims the buyed NFT');
    await expect(
      market.connect(bob).claimFraktal(Token.address),
    ).to.be.revertedWith('not buyer');
    let balances = await Token.balanceOfBatch(
      [deedee.address, market.address],
      [0, 0],
    );
    expect(balances[0]).to.equal(0);
    expect(balances[1]).to.equal(1);
  });
  it('Should not allow to unlock fraktions once sold', async function () {
    log('Alice tries to unlock fraktions');
    await expect(
      Token.connect(alice).unlockSharesTransfer(alice.address, deedee.address),
    ).to.be.revertedWith('item sold');
  });
  it('Should not allow to send fraktions after sell', async function () {
    log('Alice tries send fraktions');
    await expect(
      Token.connect(bob).safeTransferFrom(bob.address, alice.address, 1, 1, ''),
    ).to.be.reverted;
  });
  it('Should allow not winners to take out offers', async function () {
    let prevBal = await ethers.provider.getBalance(bob.address);
    await market.connect(bob).makeOffer(Token.address, utils.parseEther('0'), {
      value: utils.parseEther('0.00000000000000001'),
    });
    let formerBal = await ethers.provider.getBalance(bob.address);
    expect(formerBal).to.gt(prevBal);
  });
  it('Should not allow buyer to take out offer after sell', async function () {
    log('Deedee takes out its offer');
    let deedeeEthBalance0 = await ethers.provider.getBalance(deedee.address);
    await expect(
      market.connect(deedee).makeOffer(Token.address, utils.parseEther('0'), {
        value: utils.parseEther('0.00001'),
      }),
    ).to.be.revertedWith('offer accepted');
    let deedeeEthBalance1 = await ethers.provider.getBalance(deedee.address);
    expect(deedeeEthBalance1).to.be.equal(deedeeEthBalance1);
  });
  it('Should not allow to list fraktions of used indexes', async function () {
    log('Carol tries to list fraktions');
    await expect(
      market.connect(carol).listItem(Token.address, item1price, 1),
    ).to.be.revertedWith('item sold');
  });
  it('Should allow to claim the fraktal', async function () {
    log('Deedee claims the buyed NFT');
    await market.connect(deedee).claimFraktal(Token.address);
    let balances = await Token.balanceOfBatch(
      [deedee.address, market.address],
      [0, 0],
    );
    expect(balances[0]).to.equal(1);
    expect(balances[1]).to.equal(0);
  });
  it('Should allow not winners to take out offers', async function () {
    let prevBal = await ethers.provider.getBalance(carol.address);
    await market
      .connect(carol)
      .makeOffer(Token.address, utils.parseEther('0'), {
        value: utils.parseEther('0.00000000000000001'),
      });
    let formerBal = await ethers.provider.getBalance(carol.address);
    expect(formerBal).to.gt(prevBal);
  });
  it('Should not allow to list fraktions of NFT not in the market', async function () {
    log('Carol tries to list old fraktions');
    await expect(
      market.connect(carol).listItem(Token.address, item1price, 1),
    ).to.be.revertedWith('nft not in market');
  });
  it('should allow to retrieve the gains and burn the fraktions', async function () {
    log('First find the revenue channel address');
    let lastRevenue = await Token.getRevenue(0);
    log(`sell revenue in ${lastRevenue}`);
    PaymentSplitter2 = await ethers.getContractAt(
      'IPaymentSplitter',
      lastRevenue,
    );
    log('Users need to approve the payment revenue channel ');
    await Token.connect(alice).setApprovalForAll(PaymentSplitter2.address, 1);
    await Token.connect(carol).setApprovalForAll(PaymentSplitter2.address, 1);
    let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
    let carolEthBalance1 = await ethers.provider.getBalance(carol.address);
    log(`Alice has ${utils.formatEther(aliceEthBalance1)} ETH`);
    await PaymentSplitter2.connect(alice).release();
    await PaymentSplitter2.connect(carol).release();
    let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
    log(`Alice has now ${utils.formatEther(aliceEthBalance2)} ETH`);
    assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw');
    let balances = await Token.balanceOfBatch(
      [carol.address, alice.address],
      [1, 1],
    );
    let remaining = await ethers.provider.getBalance(PaymentSplitter2.address);
    log(`In the channel there is ${utils.formatEther(remaining)} ETH`);
    expect(balances[1]).to.equal(0);
    expect(balances[0]).to.equal(0);
  });
  it('Should allow the owner to send it to the market.. again', async function () {
    log('Deedee approves the market');
    // await Token.connect(deedee).fraktionalize(deedee.address, 2);
    await Token.connect(deedee).setApprovalForAll(market.address, true);
    log('DD sends the nft to the market');
    await market.connect(deedee).importFraktal(Token.address, 2);
    // await Token.connect(deedee).lockSharesTransfer(deedee.address,10000,market.address);
    // await Token.connect(deedee).safeTransferFrom(deedee.address, market.address, 0, 1, emptyData);
    // await Token.connect(deedee).unlockSharesTransfer(deedee.address,market.address);
    let balances = await Token.balanceOfBatch(
      [deedee.address, deedee.address, market.address],
      [0, 2, 0],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
  });
  it('Should allow to list the new fraktions (same token address)', async function () {
    let qty = 5000;
    log(`DD lists ${qty} fraktions at ${utils.formatEther(item1price)} ETH`);
    await market.connect(deedee).listItem(
      Token.address,
      item1price, // total eth/amount
      qty,
    ); // amount
    let listingPrice = await market.getListingPrice(
      deedee.address,
      Token.address,
    );
    expect(listingPrice).to.equal(ethers.BigNumber.from(item1price));
    let listingAmount = await market.getListingAmount(
      deedee.address,
      Token.address,
    );
    expect(listingAmount).to.equal(ethers.BigNumber.from(qty));
    let minOffer = await market.maxPriceRegistered(Token.address);
    expect(minOffer).to.be.equal(ethers.BigNumber.from('0'));
    log(`Min Offer is now: ${utils.formatEther(await minOffer)} ETH`);
  });
  it('Should allow other users to list the same token Fraktions', async function () {
    log('DD sends 5k Fraktions to Alice');
    await Token.connect(deedee).safeTransferFrom(
      deedee.address,
      alice.address,
      2,
      5000,
      emptyData,
    );
    log('Alice lists 5k Fraktions at a different price');
    await market.connect(alice).unlistItem(Token.address);
    await market.connect(alice).listItem(Token.address, item1price, 5000);
    let balances = await Token.balanceOfBatch(
      [market.address, deedee.address, alice.address],
      [0, 2, 2],
    );
    expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('5000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('5000'));
    let listingPrice2 = await market.getListingPrice(
      alice.address,
      Token.address,
    );
    expect(listingPrice2).to.equal(ethers.BigNumber.from(item1price));
    let listingAmount2 = await market.getListingAmount(
      alice.address,
      Token.address,
    );
    expect(listingAmount2).to.equal(ethers.BigNumber.from('5000'));
  });
  it('Should handle buys in both listings', async function () {
    log('Bob buys from Alice');
    await market.connect(bob).buyFraktions(alice.address, Token.address, 1000, {
      value: toPay(1000, item1price),
    });
    log('Carol buys from Deedee');
    await market
      .connect(carol)
      .buyFraktions(deedee.address, Token.address, 2000, {
        value: toPay(2000, item1price),
      });
    let balances = await Token.balanceOfBatch(
      [alice.address, bob.address, carol.address, deedee.address],
      [2, 2, 2, 2],
    );
    //console.log('balances',balances);
    expect(balances[0]).to.equal(ethers.BigNumber.from('4000'));
    expect(balances[1]).to.equal(ethers.BigNumber.from('1000'));
    expect(balances[2]).to.equal(ethers.BigNumber.from('2000'));
    expect(balances[3]).to.equal(ethers.BigNumber.from('3000'));
  });
  // TODO what else to test?
});
