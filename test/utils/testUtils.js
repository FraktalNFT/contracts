const { ethers } = require('hardhat');
const { utils } = ethers;

const logs = false;
const emptyData = '0x000000000000000000000000000000000000dEaD';
const emptyAddress = '0x0000000000000000000000000000000000000000';
const testUri = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
const item1price = utils.parseEther('0.02');
const newPrice = utils.parseEther('0.025');

const log = (message) => {
  if (logs) {
    console.log(message);
  }
};

module.exports = {
  log,
  logs,
  emptyData,
  emptyAddress,
  testUri,
  item1price,
  newPrice,
};
