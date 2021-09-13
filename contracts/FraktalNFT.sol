// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import "./PaymentSplitterUpgradeable.sol";
import "./EnumerableSet.sol";
import "./EnumerableMap.sol";
import '@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol';
contract FraktalNFT is ERC1155Upgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    address revenueChannelImplementation;
    bool fraktionalized;
    bool public sold;
    mapping (address => uint) public lockedShares;
    mapping (address => uint) public lockedToTotal;
    EnumerableSet.AddressSet private holders;
    EnumerableMap.UintToAddressMap private revenues;

    event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event unLockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event ItemSold(address buyer);
    event NewRevenueAdded(address payer, address revenueChannel, uint256 amount, bool sold);

    constructor() initializer {}

    function init(address _creator, string calldata uri, address _revenueChannelImplementation)
        external
        initializer
    {
        __ERC1155_init(uri);
        _mint(_msgSender(), 0, 1, '');
        _mint(_creator, 1, 10000, '');
        fraktionalized = true;
        sold = false;
        revenueChannelImplementation = _revenueChannelImplementation;
        holders.add(_creator);
    }


  // User Functions
  ///////////////////////////
    function fraktionalize(address _to, uint _tokenId) public {
      require(this.balanceOf(_msgSender(), 0) == 1, 'not owner');
      require(fraktionalized == false, 'fraktionalized');
      fraktionalized = true;
      _mint(_to, _tokenId, 10000, 'fraktions');
    }
    function defraktionalize(uint _tokenId) public {
      fraktionalized = false;
      _burn(_msgSender(), _tokenId, 10000); // "ERC1155: burn amount exceeds balance"
    }
    function soldBurn(address owner, uint256 _tokenId, uint256 bal) public {
      _burn(owner, _tokenId, bal);
      // check out balances of fraktions and set fraktionalize = false ??
    }
    function lockSharesTransfer(address from, uint numShares, address _to) public {
      if(from != _msgSender()){
          require(isApprovedForAll(from, _msgSender()), 'not approved'); // _msgSender should be the market (or approved)
      }
      require(balanceOf(from, 1) - lockedShares[from] >= numShares,"Not shares");
      lockedShares[from] += numShares;
      lockedToTotal[_to] += numShares;
      emit LockedSharesForTransfer(from, _to, numShares);
    }

    function unlockSharesTransfer(address _to) public {
      uint balance = lockedShares[_msgSender()];
      lockedShares[_msgSender()] -= balance;
      lockedToTotal[_to] -= balance;
      emit unLockedSharesForTransfer( _msgSender(), _to, 0);
    }

    function createRevenuePayment() public payable returns (address _clone){
      cleanUpHolders();
      address[] memory owners = holders.values();
      uint256 listLength = holders.length();
      uint256[] memory fraktions = new uint256[](listLength);
      for (uint i=0; i<listLength; i++){
          fraktions[i]=this.balanceOf(owners[i], 1);
        }
      _clone = ClonesUpgradeable.clone(revenueChannelImplementation);
      address payable revenueContract = payable(_clone);
      PaymentSplitterUpgradeable(revenueContract).init(owners, fraktions, sold);
      revenueContract.transfer(msg.value);
      uint256 index = revenues.length();
      revenues.set(index, _clone);
      emit NewRevenueAdded(_msgSender(), revenueContract, msg.value, sold);
    }

    function sellItem() public payable {
      require(this.balanceOf(_msgSender(),0) == 1, 'not owner'); // its the market as intermediary
      sold = true;
      emit ItemSold(_msgSender()); // this is not the buyer!!
    }

    function cleanUpHolders() public
    {
      uint256 listLength = holders.length();
      address[] memory remove = new address[](listLength);
      uint16 removeIndex = 0;
      for (uint i=0; i<listLength; i++){
        uint256 bal = this.balanceOf(holders.at(i), 1);//
        if(bal < 1){
          remove[removeIndex]= holders.at(i);
          removeIndex++;
        }
      }
      for (uint i=0; i<removeIndex; i++){
        holders.remove(remove[i]);
      }
    }

// Overrided functions
////////////////////////////////
    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory tokenId,uint256[] memory amount, bytes memory data)
        internal virtual override
    {
        super._beforeTokenTransfer(operator,from, to, tokenId,amount,data);
        if(from != address(0) && to != address(0)){ // avoid mint & burn transfers
          if(tokenId[0] == 0){ // nft transfer (subid 0)
            if(fraktionalized == true && sold == false){
              require((lockedToTotal[to] > 9999), "not approval");
            }
          }
          else{
            require(
              (balanceOf(from, tokenId[0]) - lockedShares[from] >= amount[0]),
                "amount wrong"
            );
            //require(sold != true, 'item is sold'); // sold items block the transfer of fraktions
          }
          holders.add(to);
        }
    }

  // Getters (which ones are needed?)
  ///////////////////////////
  function getRevenue(uint256 index) public view returns(address){
    return revenues.get(index);
  }
}
// Helpers (send to a library?)
////////////////////////////
/* function toUint256(bytes memory _bytes)
internal
pure
returns (uint256 value) {
assembly {
value := mload(add(_bytes, 0x20))
}
} */
