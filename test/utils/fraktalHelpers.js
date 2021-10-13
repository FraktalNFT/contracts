const { awaitTokenAddress } = require('./txHelpers');
const { testUri, log } = require('./testUtils');

const mintFraktal = async (factory, implementation, user) => {
  const mintTx = await factory.connect(user).mint(testUri, 8000);
  const tokenAddress = await awaitTokenAddress(mintTx);
  const token = implementation.attach(tokenAddress);
  log(`Deployed a new ERC1155 FraktalNFT at: ${token.address}`);
  return token;
};

module.exports = {
  mintFraktal,
};
