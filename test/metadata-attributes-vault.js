const { expect } = require("chai");
const { ethers,upgrades } = require("hardhat");

describe("Checks for ERC721", function () {
  it("Should have symbol F + formersymbol + # + id", async function () {
    const FraktalNFT = await ethers.getContractFactory("FraktalNFT");
    const fraktalNFT = await FraktalNFT.deploy();
    await fraktalNFT.deployed();

    const PaymentSplitterUpgradeable = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    const paymentSplitterUpgradeable = await PaymentSplitterUpgradeable.deploy();
    await paymentSplitterUpgradeable.deployed();

    const FraktalFactory = await ethers.getContractFactory("FraktalFactory");
    const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalNFT.address,paymentSplitterUpgradeable.address]);
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
    const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalNFT.address,paymentSplitterUpgradeable.address]);
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
  it("Should able to receive NFTs and claim as fraktal owner", async function () {
    const [owner] = await ethers.getSigners();
    const FraktalNFT = await ethers.getContractFactory("FraktalNFT");
    const fraktalNFT = await FraktalNFT.deploy();
    await fraktalNFT.deployed();

    const PaymentSplitterUpgradeable = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    const paymentSplitterUpgradeable = await PaymentSplitterUpgradeable.deploy();
    await paymentSplitterUpgradeable.deployed();

    const FraktalFactory = await ethers.getContractFactory("FraktalFactory");
    const fraktalFactory = await upgrades.deployProxy(FraktalFactory,[fraktalNFT.address,paymentSplitterUpgradeable.address]);
    await fraktalFactory.deployed();

    const SampleERC721 = await ethers.getContractFactory("SampleERC721");
    const erc721 = await SampleERC721.deploy();
    await erc721.deployed();

    //prepare for airdrop tokens!
    const airdropERC721 = await SampleERC721.deploy();
    await airdropERC721.deployed();
    const SampleERC1155 = await ethers.getContractFactory("SampleERC1155");
    const airdropERC1155 = await SampleERC1155.deploy();
    await airdropERC1155.deployed();

    await erc721.setApprovalForAll(fraktalFactory.address,true);
    
    const id = 1;
    const tx = await fraktalFactory.importERC721(erc721.address,id,8000);
    const eventArgs = ((await tx.wait()).events).find(e => e.event == "ERC721Locked").args;

    const erc721Fraktal = await FraktalNFT.attach(eventArgs.fraktal);

    //airdrop erc721
    // console.log("Owner of airdrop",await airdropERC721.ownerOf(1));
    await (airdropERC721['safeTransferFrom(address,address,uint256)'](owner.address,erc721Fraktal.address,1))
    // console.log("After airdrop",await airdropERC721.ownerOf(1));

    //airdrop erc1155
    // console.log("FraktalNFT airdrop amount before airdrop:",(await airdropERC1155.balanceOf(erc721Fraktal.address,1)).toString());
    await airdropERC1155.safeTransferFrom(owner.address,erc721Fraktal.address,1,1,[]);
    // console.log("FraktalNFT airdrop amount after airdrop:",(await airdropERC1155.balanceOf(erc721Fraktal.address,1)).toString());

    //claim airdropped tokens
    // console.log("Claim as airdrop Fraktal owner");
    await erc721Fraktal.claimContainedERC721(airdropERC721.address,1)
    // console.log("Owner or ERC721 airdrop:",await airdropERC721.ownerOf(1));
    expect(await airdropERC721.ownerOf(1)).to.be.equal(owner.address);


    await erc721Fraktal.claimContainedERC1155(airdropERC1155.address,1)
    // console.log("Owner of ERC1155 airdrop amount:",(await airdropERC1155.balanceOf(owner.address,1)).toString());
    expect(await airdropERC1155.balanceOf(owner.address,1)).to.be.equal(1);

    console.log(await erc721.ownerOf(1));
    console.log(await erc721Fraktal.isApprovedForAll(owner.address,fraktalFactory.address));
    await erc721.setApprovalForAll(fraktalFactory.address,true)
    console.log(await erc721Fraktal.isApprovedForAll(owner.address,fraktalFactory.address));
    console.log("fraltal",erc721Fraktal.address);
    console.log("collateral erc721", erc721.address);
    console.log("factory", fraktalFactory.address);
    console.log("fraktion index", await erc721Fraktal.fraktionsIndex());
    await fraktalFactory.claimERC721(0);
  });
});
