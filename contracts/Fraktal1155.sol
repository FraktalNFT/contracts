pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Fraktal1155 is ERC1155PresetMinterPauser  {
  uint256[] public subIds;
  uint256[] public amounts;

  mapping (address => uint) public lockedShares; 
  mapping (address =>  mapping (address => uint)) public transferVotes;
  mapping (address => uint) lockedToTotal;
  mapping (address => uint256) dividends; 

  constructor(string memory _urlIpfs) public ERC1155PresetMinterPauser(_urlIpfs) {
    subIds = [0,1];
    amounts = [1,10000];
    mintBatch(tx.origin, subIds, amounts, '');       }

  function safeTransferFrom(
      address to,
      address from,
      uint256 tokenId, // this is subId
      uint256 amount,
      bytes memory data
      )
    public
    override
    {
      require(to != address(0), "ERC1155: transfer to the zero address");
      if(tokenId == 0){
        require(
            (lockedToTotal[to] > 9999),
            "ERC1155: caller has not transferLocked this many shares to this transfer."
            );
      }
      else{
        require(
            (balanceOf(from, tokenId) - lockedShares[from] >= amount),
            "Fraktal ERC1155: caller does not have this many unlocked shares."
            );
      }
      _safeTransferFrom(from, to, tokenId, amount, data);
    }

  function getLocked(address _who) public view returns(uint256){
    return(lockedShares[_who]); //tx.origin
  }
  function getLockedTo(address _to) public view returns(uint256){
    return(lockedToTotal[_to]);
  }
  function lockSharesTransfer(uint numShares, address _to) public {
    require(balanceOf(tx.origin, 1) - lockedShares[tx.origin] >= numShares,"Not enough shares");

    lockedShares[tx.origin] += numShares;
    transferVotes[tx.origin][_to] += numShares;
    lockedToTotal[_to] += numShares;
  }

  function unlockSharesTransfer(uint numShares, address _to) public {
    require(transferVotes[tx.origin][_to] >= numShares, 'You dont have so many shares locked'); 
    lockedShares[tx.origin] -= numShares;
    transferVotes[tx.origin][_to] -= numShares;
    lockedToTotal[_to] -= numShares;
  }
}

contract Contract is Ownable, ReentrancyGuard, ERC1155Holder {
  Fraktal1155[] public fraktalNFTs;
  mapping (uint256 => address) public creators;
  mapping (address => mapping (uint256 => uint256)) public sellersBalance;

  uint256 public fee;

  struct Listing {
    uint256 tokenId;
    uint256 price;
    uint256 numberOfShares;
    string typeList;
  }

  event Minted( address creator,string urlIpfs ,uint nftId);
  /* event TransferedContractOwner(); */
  event Bought(address buyer,address seller, uint tokenId, uint256 numberOfShares);
  event FeeUpdated(uint256 newFee);
  event ItemListed(address owner, uint256 tokenId, uint256 price, uint256 amountOfShares, string typeList);
  event ItemPriceUpdated(address owner, uint256 tokenId, uint256 newPrice);
  /* Events on tokens will be only to retrieve operation status.. subgraph won't point to each of them.*/
  event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
  event UnlockedSharesForTransfer(address shareOwner, address to, uint numShares);
  event TokenTransfered(address sender, address recipient, uint tokenId, uint tokenSubId, uint256 numberOfShares);

  function mint(string memory urlIpfs ) public {
    Fraktal1155 newFrak = new Fraktal1155(urlIpfs);
    creators[fraktalNFTs.length] = _msgSender();
    fraktalNFTs.push(newFrak);
    emit Minted(_msgSender(), urlIpfs, fraktalNFTs.length);
  }
  function makeSafeTransfer(address _to, uint _tokenId,uint _subId, uint256 _amount) public {
    fraktalNFTs[_tokenId].safeTransferFrom(_to,_msgSender(), _subId, _amount, '');
    emit TokenTransfered(_msgSender(), _to, _tokenId, _subId, _amount);
  }
  function lockShares(uint _tokenId, uint256 _amount, address _to) public {
    fraktalNFTs[_tokenId].lockSharesTransfer(_amount, _to);
    emit LockedSharesForTransfer(_msgSender(), _to, _amount);
  }
  function unlockShares(uint _tokenId, uint256 _amount, address _to) public {
    fraktalNFTs[_tokenId].unlockSharesTransfer(_amount, _to);
    emit UnlockedSharesForTransfer(_msgSender(), _to, _amount);
  }

  // set fee for owner
  function setFee(uint256 _newFee) external onlyOwner {
    require(_newFee >= 0, "FraktalMarket: negative fee not acceptable");
    fee = _newFee;
    emit FeeUpdated(_newFee);
  }

  function buy(address from, uint256 _tokenId, uint256 _numberOfShares)
    external
    payable
    nonReentrant
  {
    Listing storage listing = listings[_tokenId][from];
    uint256 totalPrice = (listing.price * _numberOfShares) + fee;//
    require(msg.value > totalPrice, "FraktalMarket: insufficient funds");
    require(
      listing.numberOfShares >= _numberOfShares,
      "FraktalMarket: requestd shares amount exceeds balance"
    );
    require(fraktalNFTs[_tokenId].balanceOf(from,1) >= _numberOfShares, "Owner has not enough shares to sell");
    listing.numberOfShares = listing.numberOfShares - _numberOfShares;
    fraktalNFTs[_tokenId].safeTransferFrom(_msgSender(), from, 1, _numberOfShares,'');
    sellersBalance[from][_tokenId] += (listing.price * _numberOfShares);
    emit Bought(_msgSender(), from, _tokenId, _numberOfShares);
  }

  function rescueEth(uint _tokenId) public {
    require(sellersBalance[_msgSender()][_tokenId] > 0, 'You dont have any to claim');
    address addr1 = msg.sender;
    address payable seller = payable(addr1); // Correct since Solidity >= 0.6.0
    seller.transfer(sellersBalance[_msgSender()][_tokenId]);
    sellersBalance[_msgSender()][_tokenId] == 0;
  }

  mapping(uint256=> mapping(address => Listing)) listings;
  function listItem( // owner needs to do approval for the market to handle the tokens listed
    uint256 _tokenId,
    uint256 _price, // in gwei?
    uint256 _numberOfShares,
    string memory _type
  ) external returns (bool) {
    require(fraktalNFTs[_tokenId].balanceOf(address(this), 0)==1, 'You need to put the nft in escrow to list the fraktals');
    require(fraktalNFTs[_tokenId].balanceOf(_msgSender(),1)-fraktalNFTs[_tokenId].getLocked(_msgSender()) >=_numberOfShares, 'You dont have enough fraktals');
      Listing memory listing =
      Listing({
        tokenId: _tokenId,
        price: _price,
        numberOfShares: _numberOfShares,
        typeList: _type
      });
    listings[_tokenId][_msgSender()] = listing;
    emit ItemListed(_msgSender(), _tokenId, _price, _numberOfShares, _type);
    return true;
  }

  function claimNft(uint _tokenId) external {
    require(fraktalNFTs[_tokenId].balanceOf(address(this), 0) == 1, 'This item is not for sale');
    fraktalNFTs[_tokenId].safeTransferFrom(_msgSender(), address(this),0,1,'');
  }

  function updatePrice(uint256 _tokenId, uint256 _newPrice) external {
    Listing storage listing = listings[_tokenId][_msgSender()];
    require(listing.numberOfShares > 0, 'No amount is listed!');
    listing.price = _newPrice;
    emit ItemPriceUpdated(_msgSender(), _tokenId, _newPrice);
  }

  function unlistItem(uint256 _tokenId) external {
    delete listings[_tokenId][_msgSender()];
    emit ItemListed(_msgSender(), _tokenId, 0, 0, '');
  }

  /* Getters */

  function getLockedShares(address _whom, uint _tokenId) public view returns(uint256){
    return fraktalNFTs[_tokenId].getLocked(_whom);
  }
  function getLockedTo(uint _tokenId, address _to) public view returns(uint256){
    return fraktalNFTs[_tokenId].getLockedTo(_to);
  }
  function getListingPrice(address _listOwner, uint _tokenId) public view returns(uint256){
    return listings[_tokenId][_listOwner].price;
  }
  function getListingAmount(address _listOwner, uint _tokenId) public view returns(uint256){
    return listings[_tokenId][_listOwner].numberOfShares;
  }
  function getFraktalAddress(uint _tokenId) public view returns(address){
    return address(fraktalNFTs[_tokenId]);
  }
  function getFraktalsLength() public view returns(uint256){
    return(fraktalNFTs.length);
  }
  function getBalanceOf(address _who, uint _id) public view returns(uint256){
    return(fraktalNFTs[_id].balanceOf(_who, 1));
  }
  function gotNFT(address _who, uint _id) public view returns(uint256){
    return(fraktalNFTs[_id].balanceOf(_who, 0));
  }
  function getTicketUri(uint _id) public view returns(string memory){
    return(fraktalNFTs[_id].uri(0));
  }
}
