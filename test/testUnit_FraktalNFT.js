const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = false;
///////////////////////////////////////////////////////////////////////CONSTANTS
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

///////////////////////////////////////////////////////////////////////FUNCTIONS
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
describe("Fraktal NFT", function () {
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
  });

  describe('Functions',async function () {
    it('Should mint a Fraktal to the minter', async function (){
      const mintTx = await factory.connect(alice).mint(testUri, 8000);
      const TokenAddress = await awaitTokenAddress(mintTx);
      Token = FraktalImplementationContract.attach(TokenAddress);
      if(logs) console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${Token.address}`,
      );
      let balances = await Token.balanceOfBatch([alice.address,alice.address, factory.address,factory.address],[0,1,0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from("1"));
      expect(balances[1]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[2]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[3]).to.equal(ethers.BigNumber.from("0"));
    });
    it('Should allow the minter to transfer the recently minted NFT', async function (){
        if(logs) console.log('Alice sends the nft to Bob');
        await Token.connect(alice).safeTransferFrom(alice.address, bob.address, 0, 1, emptyData);
        let balances = await Token.balanceOfBatch([alice.address,alice.address, bob.address, bob.address],[0,1,0,1]);
        expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
        expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
        expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
        expect(balances[3]).to.equal(ethers.BigNumber.from('0'));
      });
    it('Should not allow to fraktionalize index 0', async function () {
      if(logs) console.log('Bob tries to fraktionalize the nft');
      await expect(
          Token.connect(bob).fraktionalize(bob.address, 0)
        ).to.be.revertedWith('Not fraktionalizable');
    });
    it('Should not allow anyone (not owner) to fraktionalize', async function () {
      if(logs) console.log('Bob tries to fraktionalize the nft');
      await expect(
        Token.connect(alice).fraktionalize(bob.address, 1)
      ).to.be.revertedWith('not owner');
    });
    it('Should allow the owner to fraktionalize it', async function () {
      if(logs) console.log('Bob fraktionalize the nft');
      await Token.connect(bob).fraktionalize(bob.address, 1);
      let balances = await Token.balanceOfBatch([bob.address,bob.address], [0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    });
    it('Should allow the owner to change the majority value', async function () {
      let prevMajority = await Token.majority();
      if(logs) console.log('Alice try to change the majority of the nft');
      await expect(
        Token.connect(alice).setMajority(6000)
      ).to.be.reverted;
      if(logs) console.log('Bob changes the majority of the nft');
      await Token.connect(bob).setMajority(6000);
      let postMajority = await Token.majority();
      expect(prevMajority).to.gt(postMajority);
    });
    it('should not be able to send the nft after', async function () {
      await expect(
          Token.connect(bob).safeTransferFrom(bob.address, alice.address,0,1,emptyData)
        ).to.be.revertedWith('not approval')
    });
    it('should allow if consent on locking fraktions', async function () {
        if(logs) console.log('Bob locks the fraktions');
        await Token.connect(bob).lockSharesTransfer(bob.address, 10000, alice.address);
        await Token.connect(bob).safeTransferFrom(bob.address, alice.address, 0,1,emptyData);
        if(logs) console.log('Bob unlocks all fraktions');
        await Token.connect(bob).unlockSharesTransfer(alice.address);
        let balances = await Token.balanceOfBatch([bob.address,bob.address, alice.address, alice.address],[0,1,0,1]);
        expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
        expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
        expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
        expect(balances[3]).to.equal(ethers.BigNumber.from('0'));
    });
    it('should not allow the receiver to transfer', async function () {
      await expect(
          Token.connect(alice).safeTransferFrom(alice.address, carol.address, 0,1,emptyData)
        ).to.be.revertedWith('not approval');
    });
    it('should be movable by receiver if consent though', async function () {
        if(logs) console.log('Bob locks all fraktions');
        await Token.connect(bob).lockSharesTransfer(bob.address, 10000, bob.address);
        if(logs) console.log('Alice transfers fraktal');
        await Token.connect(alice).safeTransferFrom(alice.address, bob.address,0,1,emptyData);
        await Token.connect(bob).unlockSharesTransfer(bob.address);
        let balances = await Token.balanceOfBatch([bob.address,bob.address, alice.address],[0,1,0]);
        expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
        expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
        expect(balances[2]).to.equal(ethers.BigNumber.from('0'));
    }); // but if not approved, cannot move!
    it('should allow defraktionalize', async function () {
      if(logs) console.log('Bob defraktionalize');
      await Token.connect(bob).defraktionalize();
      let balances = await Token.balanceOfBatch([bob.address,bob.address],[0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
    });
    it('Should allow the owner to fraktionalize it again (index not used)', async function () {
      if(logs) console.log('Bob fraktionalize the nft');
      await Token.connect(bob).fraktionalize(bob.address, 1);
      let balances = await Token.balanceOfBatch([bob.address,bob.address], [0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
    });
    it('Should allow to send the fraktions', async function () {
        let val = 5000;
        if(logs) console.log(`Bob sends ${val} fraktions to Alice`);
        let prevBalances = await Token.balanceOfBatch([bob.address, alice.address],[1,1]);
        await Token.connect(bob).safeTransferFrom(bob.address, alice.address, 1, val, emptyData);
        let balances = await Token.balanceOfBatch([bob.address, alice.address],[1,1]);
        expect(balances[0]).to.equal(ethers.BigNumber.from(prevBalances[0]-val));
        expect(balances[1]).to.equal(ethers.BigNumber.from(prevBalances[1]+val));
    });
    it('Should not allow to burn other peoples fraktions', async function () {
      if(logs) console.log('Deedee burns Carol fraktions');
      await expect(
        Token.connect(deedee).soldBurn(alice.address, 1, 100)
      ).to.be.revertedWith('not approved');
    });
    it('should not allow to move the Fraktal in a batched transaction', async function () {
      if(logs) console.log('Bob sends a batched transaction (with the Fraktal included)');
      await expect(
        Token.connect(bob).safeBatchTransferFrom(bob.address, alice.address, [1,0], [1,1], '')
      ).to.be.reverted;
      let balances = await Token.balanceOfBatch([bob.address,bob.address, alice.address, alice.address],[0,1,0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'))
      expect(balances[1]).to.equal(ethers.BigNumber.from('5000'))
      expect(balances[2]).to.equal(ethers.BigNumber.from('0'))
      expect(balances[3]).to.equal(ethers.BigNumber.from('5000'))
    });
    it('Should allow to create a Revenue stream to fraktion holders', async function () {
      if(logs) console.log('Alice create Revenue Payment with 100 ETH');
      let firstRevenueTx = await Token.connect(alice).createRevenuePayment(
        {value: utils.parseEther('100')}
      )
      const revenueChannelAddress = await getPaymentSplitterAddress(firstRevenueTx);
      if(logs) console.log('Deployed revenue channel to', revenueChannelAddress);
      PaymentSplitter1 = await ethers.getContractAt("IPaymentSplitter",revenueChannelAddress);
    });
    it('should allow (only owner) to sell the item', async function () {
      if(logs) console.log('Alice try to sell the item (no value)');
      await expect(
        Token.connect(alice).sellItem()
      ).to.be.revertedWith('not owner');
      if(logs) console.log('Bob sells the item (no value)');
      await Token.connect(bob).sellItem()
      expect(await Token.sold()).to.be.equal(true);
    });
    it('should not allow to send fraktions of a sold item', async function () {
      if(logs) console.log('Alice sends Fraktions to Carol')
      await expect(
        Token.connect(alice).safeTransferFrom(alice.address, carol.address, 1,10,emptyData)
      ).to.be.reverted;
    });
    it('Should allow to send the nft', async function () {
      if(logs) console.log('Bob sends the FraktalNFT to Carol')
      await Token.connect(bob).safeTransferFrom(bob.address, carol.address, 0,1,emptyData);
      let balances = await Token.balanceOfBatch([bob.address, carol.address],[0,0]);
      expect(balances[0]).to.be.equal(ethers.BigNumber.from('0'))
      expect(balances[1]).to.be.equal(ethers.BigNumber.from('1'))
    });
    it('Should not allow the fraktionalization of previous indexes', async function () {
      if(logs) console.log('Carol tries to re-use the index');
      await expect(
          Token.connect(carol).fraktionalize(carol.address, 1)
      ).to.be.revertedWith('index used');
    });
    it('Should allow the owner to re-fraktionalize it', async function () {
      if(logs) console.log('Carol re-fraktionalize the nft');
      let newIndex = 2;
      await Token.connect(carol).fraktionalize(carol.address, newIndex);
      let balances = await Token.balanceOfBatch([carol.address,carol.address], [0,2]);
      expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
      expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
      let fraktionsIndex = await Token.fraktionsIndex();
      if(logs) console.log('new Fraktions index: ',fraktionsIndex);
      expect(fraktionsIndex).to.be.equal(newIndex);
    });
    // it('Should ', async function () {
    //
    // });
    // it('Should ', async function () {
    //
    // });

       // sell item to
          // check sells with & without value
        // The fraktal owner (even if lended) can sellItem and setMajority.. CAREFUL HERE!!!

  });
  describe('Payment Splitter', async function () {
    it('Should allow owners to retire its gains', async function () {
        let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
        if(logs) console.log('Bob has ',utils.formatEther(bobEthBalance1), 'ETH');
        if(logs) console.log('He asks for release');
        await PaymentSplitter1.connect(bob).release();
        let bobEthBalance2 = await ethers.provider.getBalance(bob.address);
        if(logs) console.log('Bob has now ',utils.formatEther(bobEthBalance2), 'ETH');
        let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
        if(logs) console.log('Alice has ',utils.formatEther(aliceEthBalance1), 'ETH');
        if(logs) console.log('Alice asks for release');
        await PaymentSplitter1.connect(alice).release();
        let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
        if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
        assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
    });
  });
});
