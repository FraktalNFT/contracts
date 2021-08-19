// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
/* import '@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol'; */
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract FraktalNFT is ERC1155Upgradeable { // has to be burnable (to buy out functionality ;)
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    /* address public PaymentSplitterImplementation; */
    uint256[] public subIds;
    uint256[] public amounts;

    // trying tracking payments
    /* EnumerableMap.UintToAddressMap private revenues; */
    // we need to track the owners of tokens
    /* EnumerableMap.UintToAddressMap private owners;
    mapping(address => uint) public ownerIndex;
    mapping(address => uint) public ownerBalance; */

    PaymentSplitter[] public revenues;
    mapping (address => uint) public lockedShares; //private
    mapping (address => uint) lockedToTotal;

    event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event UnlockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event TokenTransfered(address sender, address recipient, uint tokenId, uint256 numberOfShares);
    event NewRevenueAdded(address payer, uint256 amount);

    constructor() initializer {}

    function init(address _creator, string calldata uri)
        external
        initializer
    {
        subIds = [0,1];
        amounts = [1,10000];
        __ERC1155_init(uri);
//--------------
        _mint(_creator, subIds[0], amounts[0], '');
        _mint(_msgSender(), subIds[1], amounts[1], '');
        /* uint256 index = owners.length();
        ownerIndex[_msgSender()] = index;
        owners.set(index, _msgSender());
        ownerBalance[_msgSender()] = 10000; */
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
            /* if(ownerBalance[to] == 0) {
              uint256 index = owners.length();
              owners.set(index, to);
              ownerIndex[to] = index;
            } */
            /* if(ownerBalance[from] - amount == 0){
              owners.remove(ownerIndex[from]);
              delete ownerIndex[from];
            } */
            /* ownerBalance[to] += amount;
            ownerBalance[from] -= amount; */
          }
          _safeTransferFrom(from, to, tokenId, amount, data);
          emit TokenTransfered(_msgSender(), to, tokenId, amount);
      }
// Specific Functions
///////////////////////////
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

    function createRevenuePayment(address[] memory _addresses, uint256[] memory _fraktions) public payable {
      // improve this with upgradeable clones??
      PaymentSplitter newRevenue = new PaymentSplitter(_addresses, _fraktions);
      address paymentContract = address(newRevenue);
      payable(paymentContract).transfer(msg.value);
      revenues.push(newRevenue);
      /* revenues[index].receive(msg.value); */
      emit NewRevenueAdded(_msgSender(), msg.value);
    }
    function askRelease(uint256 _index, address payable _to) public {
      revenues[_index].release(_to);
    }

    /* function payRevenue() public payable {
       uint listMax = owners.length();
       require(listMax > 1, 'Just one owner');
       address[] memory listOfOwners = new address[](listMax);
       uint256[] memory listOfBalances = new uint256[](listMax);
       uint256 resultIndex = 0;
       for (uint256 i = 1; i < listMax - 1 ; i++) {
         (bool content,address account) = owners.tryGet(i);
         if(content && ownerBalance[account] > 0) {
             listOfOwners[resultIndex] = account;
             listOfBalances[resultIndex] = ownerBalance[account];
             resultIndex++;
         }
       }
    }
    */
    /* PaymentSplitter newRev = new PaymentSplitter(listOfOwners, listOfBalances); */
    /* revenues.push(newRev); */
    /* This will be extremely expensive for large sets. It is recommended */
    /* to do off chain */

// should be added:
// Offers and vote over (with gaining full accountability on win)

// Getters
///////////////////////////
    function getLocked(address _who) public view returns(uint256){
      return(lockedShares[_who]);
    }
    function getLockedTo(address _to) public view returns(uint256){
      return(lockedToTotal[_to]);
    }

    /* function getOwnersAt(uint index) public view returns(uint256, address){
      return (owners.at(index));
    }
    function getOwners(uint index) public view returns(address){
      return (owners.get(index));
    }
    function getOwnersLength() public view returns(uint256){
      return(owners.length());
    }
    function getOwnerIndex(address account) public view returns(uint256){
      return(ownerIndex[account]);
    } */
}
