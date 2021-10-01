// const { ethers } = require("hardhat");
const { utils } = ethers;


export function toPay(qty, price) {
  const priceN = utils.formatEther(price);
  const toPayWei = priceN * parseFloat(qty);
  const toPayFixed = toPayWei + 0.0000000001; // sum a little for errors in gas??? CAUTION
  // if(logs) console.log('total ',toPayWfees);
  return utils.parseEther(toPayFixed.toString());
}
