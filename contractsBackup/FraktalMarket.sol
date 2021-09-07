pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: UNLICENSED

import './FraktalNFT.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import '@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol';
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EnumerableMap.sol";

contract FraktalMarket is Ownable, ReentrancyGuard, ERC1155Holder, ERC721Holder{
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    address public Fraktalimplementation;
    address public revenueChannelImplementation;
    address public zeroAddress;
    uint256 public fee;
    uint256 private feesAccrued;
    struct Proposal {
      uint256 value;
      uint voteCount;
    }
    struct Listing {
      uint256 tokenId;
      uint256 price;
      uint16 numberOfShares;
    }
    EnumerableMap.UintToAddressMap private fraktalNFTs;
    mapping(uint256=> mapping(address => Listing)) listings;
    mapping (address => uint256) public sellersBalance;
    mapping (address => address) public lockedERC721s;
    mapping (address => uint) public lockedERC721indexes;
    mapping (address => uint256) public maxPriceRegistered;
    mapping (address => mapping(address => Proposal)) public offers;
    mapping (address => address) public lockedERC1155s;
    mapping (address => uint) public lockedERC1155indexes;


    event Minted(address creator,string urlIpfs,address tokenAddress,uint nftId);
    event Bought(address buyer,address seller, uint tokenId, uint16 numberOfShares);
    event FeeUpdated(uint256 newFee);
    event ItemListed(address owner, uint256 tokenId, uint256 price, uint256 amountOfShares);
    event ItemPriceUpdated(address owner, uint256 tokenId, uint256 newPrice);
    event FraktalClaimed(address owner, uint256 tokenId);
    event ERC721Locked(address locker, address tokenAddress, address fraktal, uint256 tokenId);
    event ERC721UnLocked(address owner, uint256 tokenId, address collateralNft, uint256 index);
    event ERC1155Locked(address locker, address tokenAddress, address fraktal, uint256 tokenId);
    event ERC1155UnLocked(address owner, address tokenAddress, address collateralNft, uint256 index);
    event SellerPaymentPull(address seller, uint256 balance);
    event AdminWithdrawFees(uint256 feesAccrued);
    event Fraktionalized(address tokenAddress);
    event Defraktionalized(address tokenAddress);
    event OfferMade(address offerer, address tokenAddress, uint256 value);
    event RevenuesProtocolUpgraded(address _newAddress);
    event FraktalProtocolUpgraded(address _newAddress);

    constructor(address _implementation, address _revenueChannelImplementation) {
        Fraktalimplementation = _implementation;
        revenueChannelImplementation = _revenueChannelImplementation;
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
      address payable wallet = payable(addr1);
      wallet.transfer(feesAccrued);
      emit AdminWithdrawFees(feesAccrued);
      feesAccrued = 0;
      return true;
    }
    // finish this.. (could be an array to have history)
    function setFraktalImplementation(address _newAddress) external onlyOwner {
      Fraktalimplementation = _newAddress;
      emit FraktalProtocolUpgraded(_newAddress);
    }
    function setRevenueImplementation(address _newAddress) external onlyOwner {
      revenueChannelImplementation = _newAddress;
      emit RevenuesProtocolUpgraded(_newAddress);
    }

// Users Functions
//////////////////////////////////
    function mint(string memory urlIpfs) external returns (address _clone) {
      _clone = ClonesUpgradeable.clone(Fraktalimplementation);
      FraktalNFT(_clone).init(_msgSender(), urlIpfs, revenueChannelImplementation);
      uint256 index = fraktalNFTs.length();
      fraktalNFTs.set(index, _clone);
      maxPriceRegistered[_clone] = 0;
      emit Minted(_msgSender(), urlIpfs, _clone,index);
    }


    function rescueEth() public nonReentrant {
      require(sellersBalance[_msgSender()] > 0, 'You dont have any to claim');
      address payable seller = payable(_msgSender());
      uint256 balance = sellersBalance[_msgSender()];
      seller.transfer(balance);
      sellersBalance[_msgSender()] = 0;
      emit SellerPaymentPull(_msgSender(), balance);
    }
    function buyFraktions(address from, uint256 _tokenId, uint16 _numberOfShares)
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
      listing.numberOfShares = listing.numberOfShares - _numberOfShares;
      if(listing.price*10000 > maxPriceRegistered[fraktalNFTs.get(_tokenId)]) {
        maxPriceRegistered[fraktalNFTs.get(_tokenId)] = listing.price*10000;
      }
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(
        address(this),
        _msgSender(),
        1,
        _numberOfShares,
        ""
      );
      feesAccrued += msg.value - totalForSeller;
      sellersBalance[from] += totalForSeller;
      emit Bought(_msgSender(), from, _tokenId, _numberOfShares);
    }

    function fraktionalize(uint256 _tokenId) public {
      address tokenAddress = fraktalNFTs.get(_tokenId);
      FraktalNFT(tokenAddress).safeTransferFrom(_msgSender(), address(this),0,1,'');
      FraktalNFT(tokenAddress).fraktionalize(_msgSender(), 1);
      emit Fraktionalized(tokenAddress);
    }
    function defraktionalize(uint256 _tokenId) public {
      address tokenAddress = fraktalNFTs.get(_tokenId);
      FraktalNFT(tokenAddress).safeTransferFrom(_msgSender(), address(this),1,10000,'');
      FraktalNFT(tokenAddress).defraktionalize(1);
      FraktalNFT(tokenAddress).safeTransferFrom(address(this), _msgSender(), 0, 1, '');
      emit Defraktionalized(tokenAddress);
    }
    function claimFraktal(uint _tokenId) external {
      // how do i control that is sended to the buyer??? (i can send it in the buyout flow)
      FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(address(this),_msgSender(),0,1,'');
      emit FraktalClaimed(_msgSender(), _tokenId);
    }

    function listItem(
      uint256 _tokenId,
      uint256 _price,
      uint16 _numberOfShares
    ) external returns (bool) {
        Listing memory listed = listings[_tokenId][_msgSender()];
        require(listed.numberOfShares == 0, 'unlist first');
        FraktalNFT(fraktalNFTs.get(_tokenId)).safeTransferFrom(_msgSender(),address(this),1,_numberOfShares,'');
        Listing memory listing =
        Listing({
          tokenId: _tokenId,
          price: _price,
          numberOfShares: _numberOfShares
        });
      listings[_tokenId][_msgSender()] = listing; // wouldn't this clash if its called and it exists?
      emit ItemListed(_msgSender(), _tokenId, _price, _numberOfShares);
      return true;
    }

    function makeOffer(address tokenAddress, uint256 _value) public payable {
      require(msg.value >= _value, 'No pay');
      Proposal storage prop = offers[_msgSender()][tokenAddress];
      address payable offerer = payable(_msgSender());
      if (_value > prop.value) {
        require(_value >= maxPriceRegistered[tokenAddress],'Min offer');
        require(msg.value >= _value - prop.value);
      } else {
          offerer.transfer(prop.value);
      }
      offers[_msgSender()][tokenAddress] = Proposal({
        value: _value,
        voteCount: 0
        });
      emit OfferMade(_msgSender(), tokenAddress, _value);
    }

    function voteOffer(address offerer, address tokenAddress) public {
      Proposal storage offer = offers[offerer][tokenAddress];
      // careful here.. i dont keep votes by person and they could unlock and vote again
      uint256 votesAvailable = FraktalNFT(tokenAddress).balanceOf(_msgSender(), 1) - FraktalNFT(tokenAddress).lockedShares(_msgSender());
      offer.voteCount += votesAvailable;
      if(offer.voteCount >= 8000){
        FraktalNFT(tokenAddress).sellItem{value:offer.value}();
        // also.. what to do with listed fraktions?? 
        /* address payable = payable(offer.offerer); */
        /* FraktalNFT(tokenAddress).safeTransferFrom(address(this), offer.offerer, 0, 1, ""); */
      }
    }

    function claimERC721(uint _tokenId) external {
      address fraktalAddress = fraktalNFTs.get(_tokenId);
      address collateralNft = lockedERC721s[fraktalAddress];
      uint256 index = lockedERC721indexes[collateralNft];
      ERC721Upgradeable(collateralNft).transferFrom(address(this), _msgSender(), index);
      /* FraktalNFT(fraktalAddress).lockSharesTransfer(10000, address(this)); */
      FraktalNFT(fraktalAddress).safeTransferFrom(_msgSender(), address(this),0,1,'');
      fraktalNFTs.set(_tokenId, zeroAddress);
      emit ERC721UnLocked(_msgSender(), _tokenId, collateralNft, index);
    }
    function importERC721(address _tokenAddress, uint256 _tokenId) external returns (address _clone) {
      string memory uri = ERC721Upgradeable(_tokenAddress).tokenURI(_tokenId);
      ERC721Upgradeable(_tokenAddress).transferFrom(_msgSender(), address(this), _tokenId);
      _clone = this.mint(uri);
      lockedERC721s[_clone] = _tokenAddress;
      lockedERC721indexes[_tokenAddress] = _tokenId;
      uint256 index = fraktalNFTs.length() - 1 ;
      FraktalNFT(fraktalNFTs.get(index)).setApprovalForAll(_msgSender(), true);
      FraktalNFT(fraktalNFTs.get(index)).safeTransferFrom(address(this), _msgSender(), 1, 10000, '');
      emit ERC721Locked(_msgSender(), _tokenAddress, _clone, _tokenId);
    }
    function claimERC1155(uint _tokenId) external {
      address fraktalAddress = fraktalNFTs.get(_tokenId);
      address collateralNft = lockedERC1155s[fraktalAddress];
      uint256 index = lockedERC1155indexes[collateralNft];
      ERC1155Upgradeable(collateralNft).safeTransferFrom(address(this), _msgSender(), index,1,'');
      FraktalNFT(fraktalAddress).safeTransferFrom(_msgSender(), address(this),0,1,'');
      fraktalNFTs.set(_tokenId, zeroAddress);
      emit ERC1155UnLocked(_msgSender(), fraktalAddress, collateralNft, _tokenId);
    }
    function importERC1155(address _tokenAddress, uint256 _tokenId) external returns (address _clone) {
      string memory uri = ERC1155Upgradeable(_tokenAddress).uri(_tokenId);
      ERC1155Upgradeable(_tokenAddress).safeTransferFrom(_msgSender(), address(this), _tokenId, 1, '');
      _clone = this.mint(uri);
      lockedERC1155s[_clone] = _tokenAddress;
      lockedERC1155indexes[_tokenAddress] = _tokenId;
      uint256 index = fraktalNFTs.length() - 1 ;
      FraktalNFT(fraktalNFTs.get(index)).setApprovalForAll(_msgSender(), true);
      FraktalNFT(fraktalNFTs.get(index)).safeTransferFrom(address(this), _msgSender(), 1, 10000, '');
      emit ERC1155Locked(_msgSender(), _tokenAddress, _clone, _tokenId);
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
      emit ItemListed(_msgSender(), _tokenId, 0, 0);
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
    function getERC721Collateral(address _tokenId) public view returns(address){
      return(lockedERC721s[_tokenId]);
    }
    function getERC1155Collateral(address _tokenId) public view returns(address){
      return(lockedERC1155s[_tokenId]);
    }
    function getFraktalsLength() public view returns(uint256){
      return(fraktalNFTs.length());
    }
    function getSellerBalance(address _who) public view returns(uint256){
      return(sellersBalance[_who]);
    }
    function getOffer(address offerer, address tokenAddress) public view returns(uint256){
      return(offers[offerer][tokenAddress].value);
    }
    function getVotes(address offerer, address tokenAddress) public view returns(uint256){
      return(offers[offerer][tokenAddress].voteCount);
    }
}

// Helpers
//////////////////////////
    /* function toBytes(uint256 value)
      internal
      pure
      returns (bytes memory _bytes) {
        _bytes = new bytes(32);
        assembly { mstore(add(_bytes, 32), value) }
    } */
