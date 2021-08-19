const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

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
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
describe("FraktalMarket", function () {
  let market;
  let TokenLogicContract;
  let Token1;
  let Token2;
  let Token3;
  let PaymentSplitterLogicContract;
  let PaymentSplitter1;
  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;
  let fee = 1;
  // beforeEach(async function () {
  //
  // });

  const item1price = utils.parseEther('0.01');
  function toPay(qty, price) {
    const priceN = utils.formatEther(price);
    // console.log('priceN', priceN);
    // console.log('qty', parseFloat(qty));
    // console.log('fee',fee,'%');
    const toPayWei = priceN * parseFloat(qty);
    const toPayWfees = toPayWei + (toPayWei * fee/100) + 0.0001; // extra for gas errors
    // console.log('total ',toPayWfees);
    return utils.parseEther(toPayWfees.toString());
  }


  describe("Market Deployment", function () {
    it("Should have the correct owner", async function(){
      [owner, alice, bob, carol, deedee] = await ethers.getSigners();
      TokenLogicContract = await ethers.getContractFactory("FraktalNFT");
      const logicContract = await TokenLogicContract.deploy();
      await logicContract.deployed();
      console.log("FraktalNFT deployed to:", logicContract.address);
      // PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
      // const pSlogicContract = await PaymentSplitterLogicContract.deploy();
      // await pSlogicContract.deployed();
      // console.log("Payment Splitter deployed to:", pSlogicContract.address);

      const MarketContract = await ethers.getContractFactory("FraktalMarket");
      market = await MarketContract.deploy(logicContract.address);
      await market.deployed();
      console.log("Market deployed to:", market.address);
      console.log("Market owner:", await market.owner());
      expect(await market.owner()).to.equal(owner.address);
    });
    it("Only owner can change to positive fees", async function(){
      const initialFee = await market.getFee();
      console.log('Whoever try to set fee');
      await expect(
        market.connect(alice).setFee(ethers.BigNumber.from('10'))
      ).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await market.getFee()).to.equal(initialFee);
      // console.log('setting a negative fee');
      // await expect( // it throws a different error.. check out about negative BigNumber?
      //   market.connect(owner).setFee(ethers.BigNumber.from('-10'))
      // ).to.be.revertedWith("FraktalMarket: negative fee not acceptable");
      console.log('owner sets new fee to 10%');
      fee = 10;
      await market.connect(owner).setFee(ethers.BigNumber.from(fee));
      expect(await market.getFee()).to.equal(ethers.BigNumber.from(fee));
    });
  });
  describe("ERC1155 functions", function () {
    it("Should mint the correct amount, correct uri and [work as an ERC1155]", async function () {
      const mintTx = await market.connect(alice).mint(testUri);
      const tokenAddress = await awaitTokenAddress(mintTx);
      Token1 = TokenLogicContract.attach(tokenAddress);
      console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${Token1.address}`,
      );
      const tokenUri = await Token1.uri(0);
      expect(tokenUri).to.equal(testUri);
      let aliceBalance = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from("1"));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from("0"));
      let marketBalanceT1 = await Token1.balanceOfBatch([market.address,market.address], [0,1]);
      expect(marketBalanceT1[0]).to.equal(ethers.BigNumber.from("0"));
      expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from("10000"));
    });
  });
  describe("Listing functions", async function () {
      it('Should get the fraktal in the market and return the fraktions', async function () {
      console.log('Alice locks her NFT for listing');
      await market.connect(alice).fraktionalize(0);
      marketBalanceT1 = await Token1.balanceOfBatch([market.address, market.address], [0,1]);
      let aliceBalance = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(marketBalanceT1[0]).to.equal(ethers.BigNumber.from('1'));
      expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from('0'));
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from('0'));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from('10000'));
    });
    it('Should allow to list the fraktions', async function () {
      console.log('Alice list the item');
      await market.connect(alice).listItem(0,item1price,5000,'fixed');
      marketBalanceT1 = await Token1.balanceOfBatch([market.address, market.address], [0,1]);
      aliceBalance = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(marketBalanceT1[1]).to.equal(ethers.BigNumber.from('5000'));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from('5000'));
    });
    it('Should find item listed information', async function () {
      const listedItemPrice = await market.getListingPrice(alice.address, 0);
      let listedItemAmount = await market.getListingAmount(alice.address, 0);
      console.log('Price of listing', utils.formatEther(listedItemPrice));
      console.log('Amount of listed', listedItemAmount.toNumber());
      expect(listedItemPrice).to.equal(item1price);
      expect(listedItemAmount).to.equal(ethers.BigNumber.from('5000'));
    });
    it('Should allow to buy fraktions', async function () {
      console.log('testing +max of listed');
      await expect(
        market.connect(bob).buy(alice.address, 0, 6001, {value: toPay(6001,item1price)})
      ).to.be.revertedWith('Not enough Fraktions on sale');
      console.log('testing total price > msg.value');
      await expect(
        market.connect(bob).buy(alice.address, 0, 10, {value: toPay(5,item1price)})
      ).to.be.revertedWith('FraktalMarket: insufficient funds');
      await market.connect(bob).buy(alice.address, 0, 1000, {value: toPay(1000, item1price)});
      let bobFraktionsToken1 = await Token1.balanceOf(bob.address, 1);
      let marketBalanceT1Fraktions = await Token1.balanceOf(market.address, 1);
      console.log('Bob has bought ',bobFraktionsToken1.toNumber(), 'fraktions of Token1');
      expect(bobFraktionsToken1).to.equal(ethers.BigNumber.from('1000'));
      expect(marketBalanceT1Fraktions).to.equal(ethers.BigNumber.from('4000'));
    });
    it('Should allow Alice to change price', async function () {
      console.log('Bob tries to change price');
      const newPrice = utils.parseEther('0.015');
      await expect(
        market.connect(bob).updatePrice(0, newPrice)
      ).to.be.revertedWith('There is no list with that ID and your account');
      const hackedPrice = await market.getListingPrice(alice.address, 0);
      expect(hackedPrice).to.equal(item1price);
      console.log('Alice change price');
      await market.connect(alice).updatePrice(0, newPrice);
      expect( await market.getListingPrice(alice.address, 0)).to.equal(newPrice);
      await expect(
        market.connect(carol).buy(alice.address, 0, 10, {value: toPay(10,item1price)})
      ).to.be.revertedWith('FraktalMarket: insufficient funds');

      await market.connect(carol).buy(alice.address, 0, 3000, {value: toPay(3000, newPrice)});
      let carolFraktionsToken1 = await Token1.balanceOf(carol.address, 1);
      console.log('Carol has bought ',carolFraktionsToken1.toNumber(), 'fraktions of Token1 at the new price');
      expect(carolFraktionsToken1).to.equal(ethers.BigNumber.from('3000'));
    });
    it('Should allow the seller to rescue the eth', async function () {
      let aliceInitialEthBalance = await ethers.provider.getBalance(alice.address);
      console.log('Alice has ', utils.formatEther(aliceInitialEthBalance));
      // let totalInContract = await ethers.provider.getBalance(market.address);
      let aliceBalanceInContract = await market.getSellerBalance(alice.address);
      console.log('Alice has a balance of ', utils.formatEther(aliceBalanceInContract));
      console.log('Alice retrieves its gains');
      await market.connect(alice).rescueEth();
      let aliceEndEthBalance = await ethers.provider.getBalance(alice.address);
      console.log('Alice has now, ', utils.formatEther(aliceEndEthBalance));
      expect(aliceEndEthBalance).to.gt(aliceInitialEthBalance);
    });
    it('Should allow the admin to take the accrued fees', async function () {
      let totalInContract = await ethers.provider.getBalance(market.address);
      console.log('The contract has now, ', utils.formatEther(totalInContract));
      console.log('Owner whitdraw the accrued fees');
      let ownerInitialEth = await ethers.provider.getBalance(owner.address);
      await market.connect(owner).withdrawAccruedFees();
      let ownerFinalEth =  await ethers.provider.getBalance(owner.address);
      totalInContract = await ethers.provider.getBalance(market.address);
      let difference = ownerFinalEth.sub(ownerInitialEth);
      expect(difference).to.gt(ethers.BigNumber.from('0'));
      console.log('Owner now has ',utils.formatEther(ownerFinalEth), ' and whitdrew ',utils.formatEther(difference), 'ETH');
      console.log('now there is ',utils.formatEther(totalInContract),' in the contract');
      expect(totalInContract).to.equal(ethers.BigNumber.from('0')); // never gets to 0... ???
    });
    it('Should allow Alice to unlist its listed item', async function () {
      console.log('Alice unlist its item');
      await expect(
        market.connect(bob).unlistItem(0)
      ).to.be.revertedWith("You have no listed Fraktions with this id");
      await market.connect(alice).unlistItem(0);
      aliceBalance = await Token1.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from('6000'));
      listedItemAmount = await market.getListingAmount(alice.address, 0);
      expect(listedItemAmount).to.equal(ethers.BigNumber.from('0'));
    });
    it('Should not allow anyone to buy not listed items', async function () {
      await expect(
        market.connect(bob).buy(alice.address, 0, 10, {value: toPay(10, item1price)})
      ).to.be.revertedWith("There are no Fraktions in sale");
    });
    // it('Should return the owners and amounts of token holders', async function () {
      // payment splitter (include a map balance in each nft?)
    //   let getLength = await Token1.getOwnersLength();
    //   console.log('Total owners from enumerable Map.length()', getLength.toNumber());
    //   // let getAliceIndex = await Token1.getOwnerIndex(alice.address);
    //   // let getAliceData = await Token1.getOwnersAt(getAliceIndex);
    //   // let getAliceAmount = await Token1.balanceOf(alice.address, 1);
    //   // console.log('Alice  index ',getAliceData[0],'account: ',getAliceData[1], ' amount: ',getAliceAmount);
    //   let tokenHoldersList = await Token1.connect(alice).payRevenue();
    //   console.log('pay Revenue list: ',tokenHoldersList);
    // });
    it('Should allow to create a Revenue stream to fraktion holders', async function () {
      console.log('Alice create Revenue Payment with 100 ETH');
      let aliceFraktions1 = await Token1.balanceOf(alice.address, 1);
      let bobFraktions1 = await Token1.balanceOf(bob.address, 1);
      let carolFraktions1 = await Token1.balanceOf(carol.address, 1);
      // this is a basic subgraph call, where we've got stored balances.
      // has to be off chain for the implementation of balances in the contracts generates
      // too big files. instead its created a PaymentSplitter clone to handle each revenue uniquely.
      // revenues aren't accumulable for they are handled as entities guardian of balances.
      console.log('fraktion balances ', [aliceFraktions1.toNumber(), bobFraktions1.toNumber(), carolFraktions1.toNumber()]);
      await Token1.connect(alice).createRevenuePayment(
        [alice.address,bob.address,carol.address],
        [aliceFraktions1, bobFraktions1, carolFraktions1],
        {value: utils.parseEther('100')}
      )
    });
    it('Should allow owners to retire its gains', async function () {
      let carolEthBalance = await ethers.provider.getBalance(carol.address);
      console.log('Carol had 30% and has ',utils.formatEther(carolEthBalance));
      console.log('She asks for release');
      await Token1.connect(carol).askRelease(0, carol.address);
      carolEthBalance = await ethers.provider.getBalance(carol.address);
      console.log('Carol has now ',utils.formatEther(carolEthBalance));
      let aliceEthBalance = await ethers.provider.getBalance(alice.address);
      console.log('Alice had 60% and has ',utils.formatEther(aliceEthBalance));
      console.log('Carol asks for Alice release');
      await Token1.connect(carol).askRelease(0, alice.address);
      aliceEthBalance = await ethers.provider.getBalance(alice.address);
      console.log('Alice has now ',utils.formatEther(aliceEthBalance));
    });
    describe("Other NFT functions", async function () {
      it("Should mint new fraktal", async function () {
        const mintTx2 = await market.connect(bob).mint(testUri);
        const tokenAddress2 = await awaitTokenAddress(mintTx2);
        Token2 = TokenLogicContract.attach(tokenAddress2);
        console.log(
          `Deployed a new ERC1155 FraktalNFT at: ${Token2.address}`,
        );
        const tokenUri = await Token2.uri(0);
        expect(tokenUri).to.equal(testUri);
        let bobBalance = await Token2.balanceOfBatch([bob.address,bob.address], [0,1]);
        expect(bobBalance[0]).to.equal(ethers.BigNumber.from("1"));
        expect(bobBalance[1]).to.equal(ethers.BigNumber.from("0"));
        let marketBalanceT2 = await Token2.balanceOfBatch([market.address,market.address], [0,1]);
        expect(marketBalanceT2[0]).to.equal(ethers.BigNumber.from("0"));
        expect(marketBalanceT2[1]).to.equal(ethers.BigNumber.from("10000"));
      });
      it('Should get the fraktal in the market and return the fraktions', async function () {
        console.log('Bob fraktionalize its token');
        await market.connect(bob).fraktionalize(1);
        marketBalanceT2 = await Token2.balanceOfBatch([market.address, market.address], [0,1]);
        let bobBalance = await Token2.balanceOfBatch([bob.address,bob.address], [0,1]);
        expect(marketBalanceT2[0]).to.equal(ethers.BigNumber.from('1'));
        expect(marketBalanceT2[1]).to.equal(ethers.BigNumber.from('0'));
        expect(bobBalance[0]).to.equal(ethers.BigNumber.from('0'));
        expect(bobBalance[1]).to.equal(ethers.BigNumber.from('10000'));
      });
      it('Should get the fraktions in the market and return the fraktal', async function () {
        console.log('Bob defraktionalize its fraktions');
        await market.connect(bob).defraktionalize(1);
        marketBalanceT2 = await Token2.balanceOfBatch([market.address, market.address], [0,1]);
        let bobBalance = await Token2.balanceOfBatch([bob.address,bob.address], [0,1]);
        expect(marketBalanceT2[0]).to.equal(ethers.BigNumber.from('0'));
        expect(marketBalanceT2[1]).to.equal(ethers.BigNumber.from('10000'));
        expect(bobBalance[0]).to.equal(ethers.BigNumber.from('1'));
        expect(bobBalance[1]).to.equal(ethers.BigNumber.from('0'));
      });
      it('Should go back and fraktionalize again', async function () {
        console.log('Bob fraktionalize its token');
        await market.connect(bob).fraktionalize(1);
        marketBalanceT2 = await Token2.balanceOfBatch([market.address, market.address], [0,1]);
        let bobBalance = await Token2.balanceOfBatch([bob.address,bob.address], [0,1]);
        expect(marketBalanceT2[0]).to.equal(ethers.BigNumber.from('1'));
        expect(marketBalanceT2[1]).to.equal(ethers.BigNumber.from('0'));
        expect(bobBalance[0]).to.equal(ethers.BigNumber.from('0'));
        expect(bobBalance[1]).to.equal(ethers.BigNumber.from('10000'));
      });
      it("Should allow transfers of fraktions", async function () {
        console.log('Bob sends 1k fraktions to Alice');
        await Token2.connect(bob).safeTransferFrom(bob.address, alice.address, ethers.BigNumber.from(1), ethers.BigNumber.from(1000), emptyData);
        console.log('Bob sends 5k fraktions to Carol');
        await Token2.connect(bob).safeTransferFrom(bob.address, carol.address, ethers.BigNumber.from(1), ethers.BigNumber.from(5000), emptyData);
        console.log('Carol sends 2k fraktions to Alice');
        await Token2.connect(carol).safeTransferFrom(carol.address, alice.address, ethers.BigNumber.from(1), ethers.BigNumber.from(2000), emptyData);
        console.log('Alice sends 1k fraktions to Bob');
        await Token2.connect(alice).safeTransferFrom(alice.address, bob.address, ethers.BigNumber.from(1), ethers.BigNumber.from(1000), emptyData);

        const bobBalance = await Token2.balanceOf(bob.address, 1);
        const aliceBalance = await Token2.balanceOf(alice.address, 1);
        const carolBalance = await Token2.balanceOf(carol.address, 1);
        expect(bobBalance).to.equal(ethers.BigNumber.from("5000"));
        expect(aliceBalance).to.equal(ethers.BigNumber.from("2000"));
        expect(carolBalance).to.equal(ethers.BigNumber.from("3000"));
      });
      it("Should not allow to move more than balance", async function () {
        const initialOwnerBalance = await Token2.balanceOf(bob.address, 0);
        await expect(
          Token2.connect(bob).safeTransferFrom(bob.address,alice.address,1,5001,emptyData)
        ).to.be.revertedWith("caller < unlocked shares.");
        expect(await Token2.balanceOf(bob.address, 0)).to.equal(
          initialOwnerBalance
        );
      });
      it("Should not allow to move the nft", async function () {
        const initialOwnerBalance = await Token2.balanceOf(bob.address, 0);
        await expect(
          Token2.connect(bob).safeTransferFrom(bob.address,alice.address,0,1,emptyData)
        ).to.be.revertedWith("caller has not transfer approval");
        expect(await Token2.balanceOf(bob.address, 0)).to.equal(
          initialOwnerBalance
        );
      });
      it("Should allow to lock and unlock fraktions", async function () {
        console.log('Bob locks 1k to Alice');
        await Token2.connect(bob).lockSharesTransfer(1000, alice.address);
        console.log('Alice locks 2k to Carol');
        await Token2.connect(alice).lockSharesTransfer(2000, carol.address);
        console.log('Carol locks 3k to Alice');
        await Token2.connect(carol).lockSharesTransfer(3000, alice.address);
        const bobLocks = await Token2.getLocked(bob.address);
        const aliceLocks = await Token2.getLocked(alice.address);
        const carolLocks = await Token2.getLocked(carol.address);
        expect(aliceLocks).to.equal(ethers.BigNumber.from("2000"));
        expect(bobLocks).to.equal(ethers.BigNumber.from("1000"));
        expect(carolLocks).to.equal(ethers.BigNumber.from("3000"));
        const aliceLocked = await Token2.getLockedTo(alice.address);
        const bobLocked = await Token2.getLockedTo(bob.address);
        const carolLocked = await Token2.getLockedTo(carol.address);
        expect(aliceLocked).to.equal(ethers.BigNumber.from("4000"));
        expect(bobLocked).to.equal(ethers.BigNumber.from("0"));
        expect(carolLocked).to.equal(ethers.BigNumber.from("2000"));
        console.log('Bob unlocks 1k');
        await Token2.connect(bob).unlockSharesTransfer(1000, alice.address);
        console.log('Alice unlocks 2k');
        await Token2.connect(alice).unlockSharesTransfer(2000, carol.address);
        console.log('Carol unlocks 3k');
        await Token2.connect(carol).unlockSharesTransfer(3000, alice.address);
        const bobunLocks = await Token2.getLocked(bob.address);
        const aliceunLocks = await Token2.getLocked(alice.address);
        const carolunLocks = await Token2.getLocked(carol.address);
        expect(aliceunLocks).to.equal(ethers.BigNumber.from("0"));
        expect(bobunLocks).to.equal(ethers.BigNumber.from("0"));
        expect(carolunLocks).to.equal(ethers.BigNumber.from("0"));
        const aliceunLocked = await Token2.getLockedTo(alice.address);
        const bobunLocked = await Token2.getLockedTo(bob.address);
        const carolunLocked = await Token2.getLockedTo(carol.address);
        expect(aliceunLocked).to.equal(ethers.BigNumber.from("0"));
        expect(bobunLocked).to.equal(ethers.BigNumber.from("0"));
        expect(carolunLocked).to.equal(ethers.BigNumber.from("0"));
      });
      it("Should allow to transfer nft it 10k fraktions consent where", async function (){
        console.log('Bob locks 5k to Carol');
        await Token2.connect(bob).lockSharesTransfer(5000, carol.address);
        console.log('Alice locks 2k to Carol');
        await Token2.connect(alice).lockSharesTransfer(2000, carol.address);
        console.log('Carol locks 3k to itself');
        await Token2.connect(carol).lockSharesTransfer(3000, carol.address);
        const carolunLocked = await Token2.getLockedTo(carol.address);
        expect(carolunLocked).to.equal(ethers.BigNumber.from('10000'));
        await expect(
          Token2.connect(bob).safeTransferFrom(bob.address,alice.address,0,1,emptyData)
          ).to.be.revertedWith("caller has not transfer approval");
        console.log('whoever transfers the nft from the market to Carol');
        await Token2.connect(carol).safeTransferFrom(market.address,carol.address,0,1,emptyData);
        const bobNftBalance = await Token2.balanceOf(bob.address, 0);
        const carolNftBalance = await Token2.balanceOf(carol.address, 0);
        expect(bobNftBalance).to.equal(ethers.BigNumber.from('0'));
        expect(carolNftBalance).to.equal(ethers.BigNumber.from('1'));
      });
    });

    // aDD!!
    // lock other NFT's (ERC721 + ERC1155)
    // buy out function
  });
});
