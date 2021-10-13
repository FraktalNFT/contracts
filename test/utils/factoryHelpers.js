const { ethers } = require('hardhat');
const { log } = require('./testUtils');

const factoryContract = async () =>
  await ethers.getContractFactory('FraktalFactory');

const implementationContract = async () =>
  await ethers.getContractFactory('FraktalNFT');

const splitterFactoryContract = async () =>
  await ethers.getContractFactory('PaymentSplitterUpgradeable');

const marketContract = async () =>
  await ethers.getContractFactory('FraktalMarket');

const getDeployedContract = async (contractName, contract, params) => {
  let deployContract;
  if (params) {
    deployContract = await contract.deploy(...params);
  } else {
    deployContract = await contract.deploy();
  }
  log(`${contractName} deployed to: ${deployContract.address}`);
  return deployContract;
};

module.exports = {
  factoryContract,
  implementationContract,
  splitterFactoryContract,
  marketContract,
  getDeployedContract,
};
