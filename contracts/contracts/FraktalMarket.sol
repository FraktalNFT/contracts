pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: UNLICENSED

import './FraktalNFT.sol';
import 'hardhat/console.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import '@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol';
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract FraktalMarket is Ownable, ReentrancyGuard, ERC1155Holder, ERC721Holder{
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    address public Fraktalimplementation;
    address public zeroAddress;
    uint256 public fee;
    uint256 private feesAccrued;

    struct Listing {
      uint256 tokenId;
      uint256 price;
      uint256 numberOfShares;
      string typeList;
    }
    EnumerableMap.UintToAddressMap private fraktalNFTs;
    mapping(uint256=> mapping(address => Listing)) listings;
    mapping (uint256 => address) public creators;
    mapping (address => uint256) public sellersBalance;
    mapping (address => address) public lockedERC721s;
    mapping (address => uint) public lockedERC721indexes;

    event Minted(address creator,string urlIpfs,address tokenAddress,uint nftId);
    event Bought(address buyer,address seller, uint tokenId, uint256 numberOfShares);
    event FeeUpdated(uint256 newFee);
    event ItemListed(address owner, uint256 tokenId, uint256 price, uint256 amountOfShares, string typeList);
    event ItemPriceUpdated(address owner, uint256 tokenId, uint256 newPrice);
    event ERC721Locked(address locker, address tokenAddress, address fraktal, uint256 tokenId);
    constructor(address _implementation) {
        Fraktalimplementation = _implementation;
        fee = 1;
        zeroAddress = address(0);
    }

// Admin Functions
//////////////////////////////////
    function setFee(uint256 _newFee) external onlyOwner {
      require(_newFee >= 0, "FraktalMarket: negative fee not acceptable");
      fee = _newFee;
      emit FeeUpdated(_newFee);
    }
    function withdrawAccruedFees() external onlyOwner nonReentrant returns (bool){
      address addr1 = _msgSender();
      address payable wallet = payable(addr1); // Correct since Solidity >= 0.6.0
      wallet.transfer(feesAccrued);
      feesAccrued = 0;
      return true;
    }

// Users Functions
//////////////////////////////////
    function mint(string memory urlIpfs) external returns (address _clone) {
      _clone = ClonesUpgradeable.clone(Fraktalimplementation);
      FraktalNFT(_clone).init(_msgSender(), urlIpfs);
      uint256 index = fraktalNFTs.length();
      creators[index] = _msgSender();
      fraktalNFTs.set(index, _clone);
      emit Minted(_msgSender(), urlIpfs, _clone,index);
    }
    function rescueEth() public nonReentrant {
      require(sellersBalance[_msgSender()] > 0, 'You dont have any to claim');
      address addr1 = _msgSender();
      address payable seller = payable(addr1); // Correct since Solidity >= 0.6.0
      seller.transfer(sellersBalance[_msgSender()]);
      sellersBalance[_msgSender()] == 0;
    }
    function buy(address from, uint256 _tokenId, uint256 _numberOfShares)
      external
      payable
      nonReentrant
    {
      Listing storage listing = listings[_tokenId][from];
      require(listing.numberOfShares > 0, 'There are no Fraktions in sale');
      require(listing.numberOfShares >= _numberOfShares, 'Not enough Fraktions on sale');
      uint256 buyPrice = (listing.price * _numberOfShares);
      uint256 totalFees = buyPrice * fee / 100;
      uint256 totalForSeller = buyPrice - totalFees;
      require(msg.value > buyPrice, "FraktalMarket: insufficient funds");
      require(
        listing.numberOfShares >= _numberOfShares,
        "FraktalMarket: requested shares amount exceeds balance"
      );
// old contract
//      require(FraktalNFT(fraktalNFTs.get(_tokenId)).balanceOf(from,1) >= _numberOfShares, "Owner has not enough shares to sell");
      listing.numberOfShares = listing.numberOfShares - _numberOfShares;
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(address(this), _msgSender(), 1, _numberOfShares,'');
      feesAccrued += msg.value - totalForSeller;
      sellersBalance[from] += totalForSeller;
      emit Bought(_msgSender(), from, _tokenId, _numberOfShares);
    }

    function fraktionalize(uint256 _tokenId) public {
      FraktalNFT(fraktalNFTs.get(_tokenId)).lockSharesTransfer(10000, address(this));
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(_msgSender(), address(this),0,1,'');
      FraktalNFT(fraktalNFTs.get(_tokenId)).unlockSharesTransfer(10000, address(this));
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(address(this),_msgSender(),1,10000,'');
    }
    function defraktionalize(uint256 _tokenId) public {
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(_msgSender(), address(this),1,10000,'');
      FraktalNFT(fraktalNFTs.get(_tokenId)).lockSharesTransfer(10000, _msgSender());
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(address(this), _msgSender(), 0, 1, '');
      FraktalNFT(fraktalNFTs.get(_tokenId)).unlockSharesTransfer(10000, _msgSender());
    }

    function listItem(
      uint256 _tokenId,
      uint256 _price,
      uint256 _numberOfShares,
      string memory _type
    ) external returns (bool) {
        FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(_msgSender(),address(this),1,_numberOfShares,'');
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

    // make it also for ERC1155
    function claimERC721(uint _tokenId) external {
      address fraktalAddress = fraktalNFTs.get(_tokenId);
      address collateralNft = lockedERC721s[fraktalAddress];
      uint256 index = lockedERC721indexes[collateralNft];
      address operator = _msgSender();
      console.log(
          'Address whitdrawing ERC721: %s and index: %s and burning: %s',
          collateralNft,
          index,
          fraktalAddress
      );
      console.log('a call made by %s', operator);
      ERC721Upgradeable(collateralNft).transferFrom(address(this), _msgSender(), index);
      FraktalNFT(fraktalAddress).lockSharesTransfer(10000, address(this));
      FraktalNFT(fraktalAddress).safeTransferFrom(_msgSender(), address(this),0,1,'');
      fraktalNFTs.set(_tokenId, zeroAddress);
    }
    function importERC721(address _tokenAddress, uint256 _tokenId) external returns (address _clone) {
      string memory uri = ERC721Upgradeable(_tokenAddress).tokenURI(_tokenId);
      ERC721Upgradeable(_tokenAddress).transferFrom(_msgSender(), address(this), _tokenId);
      _clone = this.mint(uri);
      lockedERC721s[_clone] = _tokenAddress;
      lockedERC721indexes[_tokenAddress] = _tokenId;
      uint256 index = fraktalNFTs.length() - 1 ;
      FraktalNFT(fraktalNFTs.get(index)).safeTransferFrom(address(this), _msgSender(), 1, 10000, '');
      emit ERC721Locked(_msgSender(), _tokenAddress, _clone, _tokenId);
    }

    function updatePrice(uint256 _tokenId, uint256 _newPrice) external {
      Listing storage listing = listings[_tokenId][_msgSender()];
      require(listing.numberOfShares > 0, 'There is no list with that ID and your account');
      listing.price = _newPrice;
      emit ItemPriceUpdated(_msgSender(), _tokenId, _newPrice);
    }

    function unlistItem(uint256 _tokenId) external {
      uint amount = getListingAmount(_msgSender(), _tokenId);
      require(amount > 0, 'You have no listed Fraktions with this id');
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(address(this),_msgSender(),1, amount,'');
      delete listings[_tokenId][_msgSender()];
      emit ItemListed(_msgSender(), _tokenId, 0, 0, '');
    }
// GETTERS
//////////////////////////////////
    function getFee() public view returns(uint256){
      return(fee);
    }
    function getListingPrice(address _listOwner, uint _tokenId) public view returns(uint256){
      return listings[_tokenId][_listOwner].price;
    }
    function getListingAmount(address _listOwner, uint _tokenId) public view returns(uint256){
      return listings[_tokenId][_listOwner].numberOfShares;
    }
    function getFraktalAddress(uint _tokenId) public view returns(address){
      return address(fraktalNFTs.get(_tokenId));
    }
    function getFraktalsLength() public view returns(uint256){
      return(fraktalNFTs.length());
    }
    function getSellerBalance(address _who) public view returns(uint256){
      return(sellersBalance[_who]);
    }
    function getERC721Collateral(address _tokenId) public view returns(address){
      return(lockedERC721s[_tokenId]);
    }

}
