const { ethers } = require('hardhat');

const awaitTokenAddress = async (tx) => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface([
    'event Minted(address creator,string urlIpfs,address tokenAddress,uint nftId)',
  ]);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find((e) => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.tokenAddress;
};

const awaitERC721TokenAddress = async (tx) => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event NewToken(address token)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find((e) => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.token;
};

const getPaymentSplitterAddress = async (tx) => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface([
    'event NewRevenueAdded(address payer, address revenueChannel, uint256 amount, bool sold)',
  ]);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find((e) => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.revenueChannel;
};

module.exports = {
  awaitTokenAddress,
  awaitERC721TokenAddress,
  getPaymentSplitterAddress,
};
