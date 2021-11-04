// const { expect, it, describe, before } = require('chai');
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  awaitERC721TokenAddress,
  awaitTokenAddress,
} = require("./utils/txHelpers");
const { log, emptyAddress, testUri } = require("./utils/testUtils");

describe("Fraktal Factory", function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;

  let Token;
  // TODO use a FraktalNFT (Token) to import it as any other ERC1155
  // let TokenERC1155;
  let TokenFromERC1155;
  let erc721Factory;
  let ERC721LogicContract;
  let TokenERC721;
  let Token2ERC721;
  let TokenFromERC721;
  let Token2FromERC721;
  let Token3FromERC721;
  let Token4FromERC721;
  let Token5FromERC721;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

  before("Getting accounts", async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    log(`Alice address: ${alice.address}`);
    log(`Bob address: ${bob.address}`);
    log(`Carol address: ${carol.address}`);
    // create the ERC721 to import in tests
    ERC721LogicContract = await ethers.getContractFactory(
      "TestTokenUpgradeable"
    );
    const erc721Contract = await ERC721LogicContract.deploy();
    await erc721Contract.deployed();
    const ERC721FactoryContract = await ethers.getContractFactory(
      "TestTokenFactory"
    );
    erc721Factory = await ERC721FactoryContract.deploy(erc721Contract.address);
    await erc721Factory.deployed();
    log(`ERC721 factory deployed to: ${erc721Factory.address}`);
    log("Alice mints an ERC721");
    let mintERC721Tx = await erc721Factory
      .connect(alice)
      .createTestToken("alice NFT", "ANFT");
    const nftAddress = await awaitERC721TokenAddress(mintERC721Tx);
    let mintERC721Tx2 = await erc721Factory
      .connect(bob)
      .createTestToken("bob NFT", "BNFT");
    const nftAddress2 = await awaitERC721TokenAddress(mintERC721Tx2);


    FraktalImplementationContract = await ethers.getContractFactory(
      "FraktalNFT"
    );
    logicContract = await FraktalImplementationContract.deploy();
    await logicContract.deployed();
    log(`FraktalNFT deployed to: ${logicContract.address}`);
    PaymentSplitterLogicContract = await ethers.getContractFactory(
      "PaymentSplitterUpgradeable"
    );
    psLogicContract = await PaymentSplitterLogicContract.deploy();
    await psLogicContract.deployed();
    log(`Payment Splitter deployed to: ${psLogicContract.address}`);

    TokenERC721 = ERC721LogicContract.attach(nftAddress);
    Token2ERC721 = ERC721LogicContract.attach(nftAddress2);
    log(`Deployed a new ERC721 contract at: ${TokenERC721.address}`);
    await TokenERC721.connect(alice).mint();
    await TokenERC721.connect(bob).mint();
    await TokenERC721.connect(carol).mint();
    await Token2ERC721.connect(alice).mint();
    await Token2ERC721.connect(alice).mint();
    await Token2ERC721.connect(bob).mint();

    let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
    expect(aliceERC721Balance).to.equal(ethers.BigNumber.from("1"));
    let tokenERC721owner = await TokenERC721.ownerOf(1);
    log(`owner of ERC721 tokenId 1: ${tokenERC721owner}`);
    expect(tokenERC721owner).to.equal(alice.address);
  });

  describe("Deployment", async function () {
    it("Should deploy to the correct owner", async function () {
      const FactoryContract = await ethers.getContractFactory("FraktalFactory");
      factory = await FactoryContract.deploy(emptyAddress, emptyAddress);
      await factory.deployed();
      log(`Factory deployed to: ${factory.address}`);
      log(`Factory owner: ${await factory.owner()}`);
      expect(await factory.owner()).to.equal(owner.address);
    });
    it("Set the Fraktal implementation", async function () {
      await expect(
        factory.connect(alice).setFraktalImplementation(logicContract.address)
      ).to.be.reverted;
      await factory
        .connect(owner)
        .setFraktalImplementation(logicContract.address);
      expect(await factory.Fraktalimplementation()).to.be.equal(
        logicContract.address
      );
    });
    it("Set the Payment Splitter implementation", async function () {
      await expect(
        factory.connect(alice).setRevenueImplementation(psLogicContract.address)
      ).to.be.reverted;
      await factory
        .connect(owner)
        .setRevenueImplementation(psLogicContract.address);
      expect(await factory.revenueChannelImplementation()).to.be.equal(
        psLogicContract.address
      );
    });
  });
  describe("Functions", async function () {
    it("Should mint a Fraktal to the minter", async function () {
      const mintTx = await factory.connect(alice).mint(testUri, 8000);
      const token1Address = await awaitTokenAddress(mintTx);
      Token = FraktalImplementationContract.attach(token1Address);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token.address}`);
      let balances = await Token.balanceOfBatch(
        [alice.address, alice.address, factory.address, factory.address],
        [0, 1, 0, 1]
      );
      expect(balances[0]).to.equal(ethers.BigNumber.from("1"));
      expect(balances[1]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[2]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[3]).to.equal(ethers.BigNumber.from("0"));
    });
    it("Should allow to lock ERC721 tokens to the FraktalFactory.", async function () {
      log("Alice approves the factory");
      await TokenERC721.connect(alice).approve(factory.address, 1);
      await TokenERC721.connect(bob).approve(factory.address, 2);
      await TokenERC721.connect(carol).approve(factory.address, 3);
      await Token2ERC721.connect(alice).approve(factory.address, 1);
      await Token2ERC721.connect(alice).approve(factory.address, 2);
      await Token2ERC721.connect(bob).approve(factory.address, 3);

      log("Alice imports its ERC721");
      let importERC721Tx = await factory
        .connect(alice)
        .importERC721(TokenERC721.address, 1, 4000);
      let importERC721Tx2 = await factory
        .connect(bob)
        .importERC721(TokenERC721.address, 2, 5000);
      let importERC721Tx3 = await factory
        .connect(carol)
        .importERC721(TokenERC721.address, 3, 6000);
      let importERC721Tx4 = await factory
        .connect(alice)
        .importERC721(Token2ERC721.address, 1, 7000);
      let importERC721Tx5 = await factory
        .connect(alice)
        .importERC721(Token2ERC721.address, 2, 8000);
      let importERC721Tx6 = await factory
        .connect(bob)
        .importERC721(Token2ERC721.address, 3, 9000);

      const importTokenAddress = await awaitTokenAddress(importERC721Tx);
      const importTokenAddress2 = await awaitTokenAddress(importERC721Tx2);
      const importTokenAddress3 = await awaitTokenAddress(importERC721Tx3);
      const importTokenAddress4 = await awaitTokenAddress(importERC721Tx4);
      const importTokenAddress5 = await awaitTokenAddress(importERC721Tx5);
      const importTokenAddress6 = await awaitTokenAddress(importERC721Tx6);

      // let test1 = await factory.getFraktalAddress(0);
      // log('test1',test1)
      // let test2 = await factory.getFraktalAddress(1);
      // log('test2',test2)
      // let test3 = await factory.getFraktalAddress(2);
      // log('test3',test3)

      TokenFromERC721 =
        FraktalImplementationContract.attach(importTokenAddress);
      log(`Deployed a new ERC1155 FraktalNFT at: ${TokenFromERC721.address}`);
      Token2FromERC721 =
        FraktalImplementationContract.attach(importTokenAddress2);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token2FromERC721.address}`);
      Token3FromERC721 =
        FraktalImplementationContract.attach(importTokenAddress3);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token3FromERC721.address}`);
      Token4FromERC721 =
        FraktalImplementationContract.attach(importTokenAddress4);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token4FromERC721.address}`);
      Token5FromERC721 =
        FraktalImplementationContract.attach(importTokenAddress5);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token5FromERC721.address}`);
      Token6FromERC721 =
        FraktalImplementationContract.attach(importTokenAddress6);
      log(`Deployed a new ERC1155 FraktalNFT at: ${Token6FromERC721.address}`);

      let tokenERC721owner = await TokenERC721.ownerOf(1);
      expect(tokenERC721owner).to.equal(factory.address);
      let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
      expect(aliceERC721Balance).to.equal(ethers.BigNumber.from("0"));
      log(`owner of ERC721 tokenId 1: ${tokenERC721owner}`);
      const importTokenUri = await TokenFromERC721.uri(0);
      const erc721uri = await TokenERC721.tokenURI(1);
      expect(importTokenUri).to.equal(erc721uri);
      let aliceImportBalance = await Token.balanceOfBatch(
        [alice.address, alice.address],
        [0, 1]
      );
      expect(aliceImportBalance[0]).to.equal(ethers.BigNumber.from("1"));
      expect(aliceImportBalance[1]).to.equal(ethers.BigNumber.from("0"));
      let collateralAddress = await factory.getERC721Collateral(TokenFromERC721.address);
      log('collateral of 0 ',collateralAddress)
      let collateralAddress1 = await factory.getERC721Collateral(Token2FromERC721.address);
      log('collateral of 1 ',collateralAddress1)
      let collateralAddress2 = await factory.getERC721Collateral(Token3FromERC721.address);
      log('collateral of 2 ',collateralAddress2)
      // log(`collateralAddress: ${collateralAddress}`);
      // expect(collateralAddress).to.equal(TokenERC721.address);
      fraktalsTotal = await factory.getFraktalsLength();
      log('total locked',fraktalsTotal);
    });
/////////////////////////////////////////////////////////////////////

    it("Should allow to whitdraw the locked nft", async function () {
      log("Alice allows the factory");
      await TokenFromERC721.connect(alice).setApprovalForAll(
        factory.address,
        true
      );
      await Token2FromERC721.connect(bob).setApprovalForAll(
        factory.address,
        true
      );
      await Token3FromERC721.connect(carol).setApprovalForAll(
        factory.address,
        true
      );
      await Token4FromERC721.connect(alice).setApprovalForAll(
        factory.address,
        true
      );
      await Token5FromERC721.connect(alice).setApprovalForAll(
        factory.address,
        true
      );
      await Token6FromERC721.connect(bob).setApprovalForAll(
        factory.address,
        true
      );
      log("Alice whitdraws its ERC721");
      await factory.connect(alice).claimERC721(1);
      await factory.connect(bob).claimERC721(2);
      await factory.connect(carol).claimERC721(3);
      await factory.connect(alice).claimERC721(4);
      await factory.connect(alice).claimERC721(5);
      await factory.connect(bob).claimERC721(6);

      let aliceBal1 = await TokenERC721.balanceOf(alice.address);
      let aliceBal2 = await Token2ERC721.balanceOf(alice.address);
      let bobBal1 = await TokenERC721.balanceOf(bob.address);
      let bobBal2 = await Token2ERC721.balanceOf(bob.address);
      let carolBal1 = await TokenERC721.balanceOf(carol.address);
      expect(aliceBal1).to.equal(ethers.BigNumber.from("1"));
      expect(aliceBal2).to.equal(ethers.BigNumber.from("2"));
      expect(bobBal1).to.equal(ethers.BigNumber.from("1"));
      expect(bobBal2).to.equal(ethers.BigNumber.from("1"));
      expect(carolBal1).to.equal(ethers.BigNumber.from("1"));

      let itemAbandoned = await factory.getFraktalAddress(0);
      log(`Fraktal new address: ${itemAbandoned}`);
      let itemAbandonedCollateral = await factory.getERC721Collateral(TokenFromERC721.address);
      log(`Collateral address: ${itemAbandonedCollateral}`);
      let aliceBalance = await TokenFromERC721.balanceOfBatch(
        [alice.address, alice.address],
        [0, 1]
      );
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from("0"));
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from("0"));
    });
    it("Should allow to lock ERC1155 tokens to the FraktalFactory.", async function () {
      log("Alice approves the factory");
      await Token.connect(alice).setApprovalForAll(factory.address, 1);
      log("Alice imports its ERC1155");
      let importERC1155Tx = await factory
        .connect(alice)
        .importERC1155(Token.address, 0, 6000);
      const importTokenAddress = await awaitTokenAddress(importERC1155Tx);
      TokenFromERC1155 =
        FraktalImplementationContract.attach(importTokenAddress);
      log(`Deployed a new ERC1155 FraktalNFT at: ${TokenFromERC1155.address}`);
      let aliceTokenBalance = await Token.balanceOf(alice.address, 0);
      expect(aliceTokenBalance).to.equal(ethers.BigNumber.from("0"));
      const importedTokenUri = await TokenFromERC1155.uri(0);
      const newFraktaluri = await Token.uri(0);
      expect(importedTokenUri).to.equal(newFraktaluri);
      let aliceImportBalance = await TokenFromERC1155.balanceOfBatch(
        [alice.address, alice.address],
        [0, 1]
      );
      expect(aliceImportBalance[0]).to.equal(ethers.BigNumber.from("1"));
      expect(aliceImportBalance[1]).to.equal(ethers.BigNumber.from("0"));
      let fraktalsTotal = await factory.getFraktalsLength();
      log('total locked',fraktalsTotal);

    });
    it("Should allow to whitdraw the locked nft", async function () {
      log("Alice allows the market");
      await TokenFromERC1155.connect(alice).setApprovalForAll(
        factory.address,
        true
      );
      log("Alice whitdraws its ERC1155");
      await factory.connect(alice).claimERC1155(7);
      let aliceERC1155Balance = await Token.balanceOf(alice.address, 0);
      let aliceBalance = await TokenFromERC1155.balanceOfBatch(
        [alice.address, alice.address],
        [0, 1]
      );
      expect(aliceERC1155Balance).to.equal(ethers.BigNumber.from("1"));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from("0"));
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from("0"));
    });
  });
});
