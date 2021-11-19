const { expect } = require('chai'); //, describe, before, it
const { ethers } = require('hardhat');
const { log } = require('./utils/testUtils');
const {
  getDeployedContract,
  implementationContract,
  splitterFactoryContract,
  marketContract,
  factoryContract
} = require('./utils/factoryHelpers');
const { mintFraktal } = require('./utils/fraktalHelpers');

describe('Fraktal Market - Deploy', function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;
  let Token;
  let market;

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
  });

  it('Should deploy to the correct owner', async function () {
    let defaultFee = 100;
    market = await getDeployedContract('Market Contract', await marketContract());
    await market.connect(owner).initialize();
    log(`Market owner: ${await market.owner()}`);
    expect(await market.owner()).to.equal(owner.address);
    expect(await market.fee()).to.equal(defaultFee);
  });
  it('Should allow only the owner to set market fee', async function () {
    let newFee = 1000;
    await expect(market.connect(alice).setFee(newFee)).to.be.reverted;
    await market.connect(owner).setFee(newFee);
    expect(await market.fee()).to.be.equal(newFee);
  });
});
