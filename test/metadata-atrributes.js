const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Checks for ERC721", function () {
  it("Should have symbol F + formersymbol + # + id", async function () {
    const FraktalNFT = await ethers.getContractFactory("FraktalNFT");
    const fraktalNFT = await FraktalNFT.deploy();
    await fraktalNFT.deployed();

    const PaymentSplitterUpgradeable = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    const paymentSplitterUpgradeable = await PaymentSplitterUpgradeable.deploy();
    await paymentSplitterUpgradeable.deployed();

    const FraktalFactory = await ethers.getContractFactory("FraktalFactory");
    const fraktalFactory = await FraktalFactory.deploy(fraktalNFT.address,paymentSplitterUpgradeable.address);
    await fraktalFactory.deployed();

    const SampleERC721 = await ethers.getContractFactory("SampleERC721");
    const erc721 = await SampleERC721.deploy();
    await erc721.deployed();

    const name = await erc721.name();
    const sym = await erc721.symbol();
    // console.log(`Imported :${name}(${sym})`);

    await erc721.setApprovalForAll(fraktalFactory.address,true);
    
    const id = 1;
    const tx = await fraktalFactory.importERC721(erc721.address,id,8000);

    // console.log(((await tx.wait()).events).find(e => e.event == "ERC721Locked"));

    const eventArgs = ((await tx.wait()).events).find(e => e.event == "ERC721Locked").args;
    // console.log(eventArgs);

    const erc721Fraktal = await FraktalNFT.attach(eventArgs.fraktal);
    const newName = await erc721Fraktal.name();
    const newSym = await erc721Fraktal.symbol();
    // console.log(`Fraktal :${newName}(${newSym})`);
    
    expect(newSym).to.be.equal("F"+sym+"#"+(id.toString()));
  });
  it("Should have same URI as imported NFT", async function () {
    const FraktalNFT = await ethers.getContractFactory("FraktalNFT");
    const fraktalNFT = await FraktalNFT.deploy();
    await fraktalNFT.deployed();

    const PaymentSplitterUpgradeable = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    const paymentSplitterUpgradeable = await PaymentSplitterUpgradeable.deploy();
    await paymentSplitterUpgradeable.deployed();

    const FraktalFactory = await ethers.getContractFactory("FraktalFactory");
    const fraktalFactory = await FraktalFactory.deploy(fraktalNFT.address,paymentSplitterUpgradeable.address);
    await fraktalFactory.deployed();

    const SampleERC721 = await ethers.getContractFactory("SampleERC721");
    const erc721 = await SampleERC721.deploy();
    await erc721.deployed();

    const name = await erc721.name();
    const sym = await erc721.symbol();

    await erc721.setApprovalForAll(fraktalFactory.address,true);
    
    const id = 1;
    const tx = await fraktalFactory.importERC721(erc721.address,id,8000);
    const eventArgs = ((await tx.wait()).events).find(e => e.event == "ERC721Locked").args;

    const erc721Fraktal = await FraktalNFT.attach(eventArgs.fraktal);

    expect(await erc721.tokenURI(1)).to.be.equal(await erc721Fraktal.uri(0));

  });
});
