const { utils } = require('ethers');
const { log } = require('./testUtils');

const toPay = (qty, price) => {
  const priceN = utils.formatEther(price);
  const toPayWei = priceN * parseFloat(qty);
  // TODO sum a little for errors in gas??? CAUTION
  const toPayFixed = toPayWei;// + 0.0000000001;
  log(`total: ${toPayFixed}`);
  return utils.parseEther(toPayFixed.toString());
};

module.exports = {
  toPay,
};
