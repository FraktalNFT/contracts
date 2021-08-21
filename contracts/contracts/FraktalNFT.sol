// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract FraktalNFT is ERC1155Upgradeable { // has to be burnable (to buy out functionality ;)
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    struct Proposal {
      address offerer;
      uint256 value;
      uint voteCount; // 10k max
    }
    uint public percenteage; // % of owners that decide the sell out (is it changeable for each token?) add functions then!
    PaymentSplitter[] public revenues;

    /* Proposal[] public offers; */
    mapping(address => Proposal) public offers;

    mapping (address => uint) private lockedShares;
    mapping (address => uint) lockedToTotal;

    event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event UnlockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event TokenTransfered(address sender, address recipient, uint tokenId, uint256 numberOfShares);
    event NewRevenueAdded(address payer, uint256 amount);
    event OfferMade(address offerer, uint256 value);
    event OfferUpdated(address offerer,uint256 value);

    constructor() initializer {}

    function init(address _creator, string calldata uri)
        external
        initializer
    {
        percenteage = 60;
        __ERC1155_init(uri);
        _mint(_creator, 0, 1, '');
        _mint(_msgSender(), 1, 10000, '');
    }

// Specific Functions
///////////////////////////
    /* function voteOffer(address _offerer) public {
      Proposal storage prop = offers[_offerer];
      prop.voteCount += this.balanceOf(_msgSender(), 1);
      if (prop.voteCount > 100*percenteage) {
        console.log('should fire buy out');
      }
    } */



    function lockSharesTransfer(uint numShares, address _to) public {
      require(balanceOf(_msgSender(), 1) - lockedShares[_msgSender()] >= numShares,"Not enough shares");
      lockedShares[_msgSender()] += numShares;
      lockedToTotal[_to] += numShares;
      emit LockedSharesForTransfer(_msgSender(), _to, numShares);
    }

    function unlockSharesTransfer(uint numShares, address _to) public {
      require(lockedShares[_msgSender()] >= numShares, 'You dont have locked');
      lockedShares[_msgSender()] -= numShares;
      lockedToTotal[_to] -= numShares;
      emit UnlockedSharesForTransfer( _msgSender(), _to, numShares);
    }

    function makeOffer(uint256 _value) public payable {
      require(msg.value >= _value, 'you forgot to pay');
      offers[_msgSender()] = Proposal({
        offerer: _msgSender(),
        value: _value,
        voteCount: 0
        });
        emit OfferMade(_msgSender(), _value);
      }
    function modifyOffer(address _offerer, uint256 _value) public payable{
      Proposal storage prop = offers[_offerer];
      require(prop.offerer == _msgSender(), 'You are not the owner of this offer');
      address payable offerer = payable(_msgSender());
      if (_value > prop.value) {
        require(msg.value >= _value - prop.value);
        } else {
          offerer.transfer(prop.value - _value);
        }
        prop.value = _value;
        emit OfferUpdated(_offerer, _value);
      }
    function createRevenuePayment(address[] memory _addresses, uint256[] memory _fraktions) public payable {
      PaymentSplitter newRevenue = new PaymentSplitter(_addresses, _fraktions);
      address paymentContract = address(newRevenue);
      payable(paymentContract).transfer(msg.value);
      revenues.push(newRevenue);
      emit NewRevenueAdded(_msgSender(), msg.value);
    }
    function askRelease(uint256 _index, address payable _to) public {
      revenues[_index].release(_to);
    }
    // Overrided functions
    ////////////////////////////////
    function safeTransferFrom(
          address from,
          address to,
          uint256 tokenId,
          uint256 amount,
          bytes memory data
      )
          public
          virtual
          override
      {
          require(to != address(0), "Zero address");
          if(tokenId == 0){
            require(
              (lockedToTotal[to] > 9999),
                "caller has not transfer approval"
            );
            }
          else{
            require(
              (balanceOf(from, tokenId) - lockedShares[from] >= amount),
                "caller < unlocked shares."
            );
          }
          _safeTransferFrom(from, to, tokenId, amount, data);
          emit TokenTransfered(_msgSender(), to, tokenId, amount);
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
}
