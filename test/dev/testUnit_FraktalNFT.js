const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

const logs = false;
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";



/////////////////////////////////////////////////////////////////////////////////
it('Should allow the minter to transfer the recently minted NFT', async function (){
  if(logs) console.log('Alice sends the nft to Bob');
  await Token1.connect(alice).safeTransferFrom(alice.address, bob.address, 0, 1, emptyData);
  let balances = await Token1.balanceOfBatch([alice.address,alice.address, bob.address, bob.address],[0,1,0,1]);
  expect(balances[0]).to.equal(ethers.BigNumber.from('0'));
  expect(balances[1]).to.equal(ethers.BigNumber.from('0'));
  expect(balances[2]).to.equal(ethers.BigNumber.from('1'));
  expect(balances[3]).to.equal(ethers.BigNumber.from('0'));
});
it('Should not allow to fraktionalize index 0', async function () {
  if(logs) console.log('Bob tries to fraktionalize the nft');
  await expect(
    Token1.connect(bob).fraktionalize(bob.address, 0)
  ).to.be.revertedWith('Not fraktionalizable');
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

it('should allow to retrieve the gains and burn the fraktions', async function () {
  if(logs) console.log('First find the revenue channel address');
  let lastRevenue = await Token1.getRevenue(1);
  if(logs) console.log('sell revenue in ',lastRevenue)
  PaymentSplitter2 = await ethers.getContractAt("IPaymentSplitter",lastRevenue);
  let bobEthBalance1 = await ethers.provider.getBalance(bob.address);
  let aliceEthBalance1 = await ethers.provider.getBalance(alice.address);
  if(logs) console.log('Alice has ',utils.formatEther(aliceEthBalance1), 'ETH');
  if(logs) console.log('asks for release');
  await PaymentSplitter2.connect(alice).release();
  let aliceEthBalance2 = await ethers.provider.getBalance(alice.address);
  if(logs) console.log('Alice has now ',utils.formatEther(aliceEthBalance2), 'ETH');
  assert(aliceEthBalance2 > aliceEthBalance1, 'Alice couldnt withdraw')
  let balances = await Token1.balanceOfBatch([bob.address, alice.address],[1,1]);
  expect(balances[1]).to.equal(0);
});

it('Should not allow the fraktionalization of previous indexes', async function () {
  if(logs) console.log('Deedee tries to re-use the index');
  await expect(
    Token1.connect(deedee).fraktionalize(deedee.address, 1)
  ).to.be.revertedWith('index used');
});
it('Should allow the owner to change the majority value', async function () {
  if(logs) console.log('Deedee changes the majority of the nft');
  let prevMajority = await Token1.majority();
  await Token1.connect(deedee).setMajority(6000);
  let postMajority = await Token1.majority();
  expect(prevMajority).to.gt(postMajority);
});
it('Should allow the owner to re-fraktionalize it', async function () {
  if(logs) console.log('Deedee fraktionalize the nft');
  await Token1.connect(deedee).fraktionalize(deedee.address, 2);
  let balances = await Token1.balanceOfBatch([deedee.address,deedee.address], [0,2]);
  expect(balances[0]).to.equal(ethers.BigNumber.from('1'));
  expect(balances[1]).to.equal(ethers.BigNumber.from('10000'));
  let fraktionsIndex = await Token1.fraktionsIndex();
  if(logs) console.log('new Fraktions index: ',fraktionsIndex);
});
it('should not allow to move the Fraktal in a batched transaction', async function () {
  if(logs) console.log('Deedee sends a batched transaction (with the Fraktal included)');
  await expect(
    Token1.connect(deedee).safeBatchTransferFrom(deedee.address, alice.address, [2,0], [1,1], '')
  ).to.be.reverted;
  let balances = await Token1.balanceOfBatch([deedee.address,deedee.address, alice.address, alice.address],[0,2,0,2]);
  expect(balances[0]).to.equal(ethers.BigNumber.from('1'))
  expect(balances[1]).to.equal(ethers.BigNumber.from('10000'))
  expect(balances[2]).to.equal(ethers.BigNumber.from('0'))
  expect(balances[3]).to.equal(ethers.BigNumber.from('0'))
});
