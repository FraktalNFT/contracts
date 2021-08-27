// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

contract FraktalNFT is ERC1155Upgradeable { // has to be burnable (to buy out functionality ;)
    struct Proposal {
      uint256 value;
      uint voteCount;
    }
    /* uint public percenteage; // % of owners that decide the sell out (is it changeable for each token?) add functions then! */
    uint256 public maxPriceRegistered;
    bool sold;
    address[] public revenues;

    mapping(address => Proposal) public offers;
    mapping (address => uint) public lockedShares;
    mapping (address => uint) lockedToTotal;

    event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event NewRevenueAdded(address payer, address revenueChannel, uint256 amount);
    event OfferMade(address offerer, uint256 value);
    event ItemSold(address buyer);
    event unLockedSharesForTransfer(address shareOwner, address to, uint numShares);
    constructor() initializer {}

    function init(address _creator, string calldata uri)
        external
        initializer
    {
      /* percenteage = 60; */
        sold = false;
        maxPriceRegistered = 0;
        __ERC1155_init(uri);
        _mint(_creator, 0, 1, '');
        _mint(_msgSender(), 1, 10000, '');
    }

// User Functions
///////////////////////////
    function lockSharesTransfer(uint numShares, address _to) public {
      require(balanceOf(_msgSender(), 1) - lockedShares[_msgSender()] >= numShares,"Not enough shares");
      Proposal storage prop = offers[_to];
      if (prop.value > 0) {
        prop.voteCount += numShares;
        if (prop.voteCount > 8000) {
          sold = true;
          emit ItemSold(_to);
        }
      }
      lockedShares[_msgSender()] += numShares;
      lockedToTotal[_to] += numShares;
      emit LockedSharesForTransfer(_msgSender(), _to, numShares);
    }

    // deleted numShares.. check it out for crossed votes!
    function unlockSharesTransfer(address _to) public {
      /* require(lockedShares[_msgSender()] > 0, 'You dont have locked'); */
      Proposal storage prop = offers[_to];
      require(sold == false);
      uint balance = lockedShares[_msgSender()];
      if (prop.value > 0) {
        prop.voteCount -= balance;
      }
      lockedShares[_msgSender()] -= balance;
      lockedToTotal[_to] -= balance;
      emit unLockedSharesForTransfer( _msgSender(), _to, 0);
    }

    function makeOffer(uint256 _value) public payable {
      require(msg.value >= _value, 'No pay');
      Proposal storage prop = offers[_msgSender()];
      address payable offerer = payable(_msgSender());
      if (_value != 0) {
        require(_value >= maxPriceRegistered, 'Min offer');
        require(msg.value >= _value - prop.value);
      } else {
          offerer.transfer(prop.value);
      }
      offers[_msgSender()] = Proposal({
        value: _value,
        voteCount: 0
        });
      emit OfferMade(_msgSender(), _value);
    }

    function createRevenuePayment(address[] memory _addresses, uint256[] memory _fraktions, address buyer) public payable returns (address revenueContract){
      PaymentSplitter newRevenue = new PaymentSplitter(_addresses, _fraktions);
      uint256 amount;
      if(sold == true){
        amount = offers[buyer].value;
      }else{
        amount = msg.value;
      }
      payable(newRevenue).transfer(amount);
      revenueContract = address(newRevenue);
      revenues.push(revenueContract);
      emit NewRevenueAdded(_msgSender(), revenueContract, msg.value);
    }

// Overrided functions
////////////////////////////////
    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory tokenId,uint256[] memory amount, bytes memory data)
        internal virtual override
    {
        super._beforeTokenTransfer(operator,from, to, tokenId,amount,data);
        if(from != address(0)){ // avoid minting transfers
          if(tokenId[0] == 0){ // nft transfer (subid 0)
            if(sold == false){
              require((lockedToTotal[to] > 9999), "not approval");
            }
          }
          else{
            require(
              (balanceOf(from, tokenId[0]) - lockedShares[from] >= amount[0]),
                "send amount wrong"
            );
          }
          if (data.length > 0) {
            uint256 price = toUint256(data);
            if(price > maxPriceRegistered) {
              maxPriceRegistered = price;
            }
          }
      }
    }
// Helpers
////////////////////////////
  function toUint256(bytes memory _bytes)
    internal
    pure
    returns (uint256 value) {
      assembly {
        value := mload(add(_bytes, 0x20))
      }
  }
// Getters
///////////////////////////
    function getLocked(address _who) public view returns(uint256){
      return(lockedShares[_who]);
    }
    function getLockedTo(address _to) public view returns(uint256){
      return(lockedToTotal[_to]);
    }
    function getOffer(address offerer) public view returns(uint256){
      return(offers[offerer].value);
    }
    function getVotes(address offerer) public view returns(uint256){
      return(offers[offerer].voteCount);
    }
    function getSold() public view returns(bool){
      return(sold);
    }
    /* function getMinOffer() public view returns(uint256){
      return(maxPriceRegistered);
    } */
}
