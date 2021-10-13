const { expect } = require('chai');//, assert, describe, before, it
const { ethers } = require('hardhat');
const { utils } = ethers;
const { log, item1price } = require('./utils/testUtils');
const { toPay } = require('./utils/marketUtils');
const {
  getDeployedContract,
  implementationContract,
  splitterFactoryContract,
  factoryContract,
  marketContract,
} = require('./utils/factoryHelpers');
const { mintFraktal } = require('./utils/fraktalHelpers');

describe('Fraktal Market - Admin', function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;
  let market;
  let Token;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

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
    await market.connect(owner).initialize();
    await Token.connect(alice).setApprovalForAll(market.address, true);
    await market.connect(alice).importFraktal(Token.address, 1);
    await market.connect(alice).listItem(Token.address,item1price,10000);
    await market.connect(bob).buyFraktions(alice.address, Token.address, 3000, {
        value: toPay(3000, item1price),
      });
    await market.connect(carol).buyFraktions(alice.address, Token.address, 3000, {
        value: toPay(3000, item1price),
      });
    await market.connect(alice).rescueEth();
  });

  // Admin functions
  it('Should allow the admin to take the accrued fees', async function () {


    let totalInContract = await ethers.provider.getBalance(market.address);
    log(`The contract has: ${utils.formatEther(totalInContract)} ETH`);
    log('Owner whitdraw the accrued fees');
    let ownerInitialEth = await ethers.provider.getBalance(owner.address);
    await market.connect(owner).withdrawAccruedFees();
    let ownerFinalEth = await ethers.provider.getBalance(owner.address);
    totalInContract = await ethers.provider.getBalance(market.address);
    let difference = ownerFinalEth.sub(ownerInitialEth);
    log(`Owner now has ${utils.formatEther(ownerFinalEth)} ETH`);
    log(`now there is ${utils.formatEther(totalInContract)} in the contract`);
    expect(totalInContract).to.equal(ethers.BigNumber.from('0')); // never gets to 0... ???
  });
  // it('Should not allow to claim the fraktal', async function () {
  //   log('Deedee claims the NFT');
  //   await expect(
  //     market.connect(deedee).claimFraktal(Token.address)
  //   ).to.be.revertedWith('not approval');
  //   log('Bob claims the NFT');
  //   await expect(
  //     market.connect(bob).claimFraktal(Token.address)
  //   ).to.be.revertedWith('not approval');
  //   log('Alice claims the NFT');
  //   await expect(
  //     market.connect(alice).claimFraktal(Token.address)
  //   ).to.be.revertedWith('not approval');
  //   let balances = await Token.balanceOfBatch(
  //      [deedee.address,bob.address,alice.address, market.address],[0,0,0,0]);
  //   expect(balances[0]).to.equal(0);
  //   expect(balances[1]).to.equal(0);
  //   expect(balances[2]).to.equal(0);
  //   expect(balances[3]).to.equal(1);
  // });
});
