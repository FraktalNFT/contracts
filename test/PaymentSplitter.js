const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;
const { awaitTokenAddress, getPaymentSplitterAddress } = require('./utils/txHelpers');
const { log, testUri, emptyData } = require('./utils/testUtils');
const {
  marketContract,
  getDeployedContract,
} = require('./utils/factoryHelpers');

describe("Payment Splitter", function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;
  let Token;
  let PaymentSplitter1;
  let PaymentSplitter2;

  let alice;
  let bob;
  let carol;

  before('Getting accounts - deploying contracts', async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    log(`Alice address: ${alice.address}`);
    log(`bob address: ${bob.address}`);
    log(`carol address: ${carol.address}`);

    FraktalImplementationContract = await ethers.getContractFactory("FraktalNFT");
    logicContract = await FraktalImplementationContract.deploy();
    await logicContract.deployed();
    log(`FraktalNFT deployed to: ${logicContract.address}`);
    PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    psLogicContract = await PaymentSplitterLogicContract.deploy();
    await psLogicContract.deployed();
    log(`Payment Splitter deployed to: ${psLogicContract.address}`);
    const FactoryContract = await ethers.getContractFactory("FraktalFactory");
    factory = await FactoryContract.deploy(logicContract.address, psLogicContract.address);
    await factory.deployed();
    log(`Factory deployed to: ${factory.address}`);
    log(`Factory owner: ${await factory.owner()}`);
    const mintTx = await factory.connect(alice).mint(testUri, 8000);
    const TokenAddress = await awaitTokenAddress(mintTx);
    Token = FraktalImplementationContract.attach(TokenAddress);

    // Prepare sold out to test revenue + burn
    market = await getDeployedContract('Market Contract', await marketContract());
    await market.connect(owner).initialize();
    await Token.connect(alice).setApprovalForAll(market.address, true);
    await market.connect(alice).importFraktal(Token.address, 1);
    // prepare Revenue channels
    await Token.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1999, emptyData);
    let firstRevenueTx = await Token.connect(alice).createRevenuePayment(
      {value: utils.parseEther('100')}
    )
    const revenueChannelAddress = await getPaymentSplitterAddress(firstRevenueTx);
    log('Deployed revenue channel to', revenueChannelAddress);
    PaymentSplitter1 = await ethers.getContractAt("IPaymentSplitter",revenueChannelAddress);

    await market.connect(bob).makeOffer(Token.address, utils.parseEther('200'),{
            value: utils.parseEther('200'),
          });
    await market.connect(alice).voteOffer(bob.address, Token.address);
    await market.connect(bob).claimFraktal(Token.address);
    let newPaymentAddress = await Token.getRevenue(1);
    log('new revenue in ',newPaymentAddress)
    PaymentSplitter2 = await ethers.getContractAt("IPaymentSplitter",newPaymentAddress);

  });

  it('Should allow owners to retire its gains', async function () {
    let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
    log(`Bob has ${utils.formatEther(bobEthBalance1)} ETH`);
    log('He asks for release');
    await PaymentSplitter1.connect(bob).release();
    let bobEthBalance2 = await ethers.provider.getBalance(bob.address);
    log(`Bob has now ${utils.formatEther(bobEthBalance2)} ETH`);
    let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
    log(`Alice has ${utils.formatEther(aliceEthBalance1)} ETH`);
    log('Alice asks for release');
    await PaymentSplitter1.connect(alice).release();
    let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
    log(`Alice has now ${utils.formatEther(aliceEthBalance2)} ETH`);
    expect(aliceEthBalance2).to.gt(aliceEthBalance1);  // 'Alice couldnt withdraw'
  });
  it('BUYOUT: Should allow owners to retire its gains and burn the fraktions', async function () {
    await Token.connect(bob).setApprovalForAll(PaymentSplitter2.address, true);
    await Token.connect(alice).setApprovalForAll(PaymentSplitter2.address, true);
    let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
    log(`Bob has ${utils.formatEther(bobEthBalance1)} ETH`);
    log('He asks for release');
    await PaymentSplitter2.connect(bob).release();
    let bobEthBalance2 = await ethers.provider.getBalance(bob.address);
    log(`Bob has now ${utils.formatEther(bobEthBalance2)} ETH`);
    let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
    log(`Alice has ${utils.formatEther(aliceEthBalance1)} ETH`);
    log('Alice asks for release');
    await PaymentSplitter2.connect(alice).release();
    let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
    log(`Alice has now ${utils.formatEther(aliceEthBalance2)} ETH`);
    expect(aliceEthBalance2).to.gt(aliceEthBalance1);  // 'Alice couldnt withdraw'
  });
});
