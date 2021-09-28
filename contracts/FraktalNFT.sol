// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import "./PaymentSplitterUpgradeable.sol";
import "./EnumerableSet.sol";
import "./EnumerableMap.sol";
contract FraktalNFT is ERC1155Upgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    address revenueChannelImplementation;
    bool fraktionalized;//fraktionalization could also be an index (sub Id) of fraktions in current valid power
    bool public sold;// sold will be the variable that changes power (to the buyer not specified) and allows re-fraktionalization
    uint256 public fraktionsIndex;// keep it in a new variable
    uint16 public majority; // amount threshold on voting power
    uint256[] public initialIndexes;
    uint256[] public amounts;
    mapping (uint => bool) public indexUsed;//keep track of used indexes (if existent, and reused, dilutes amount)
    mapping(uint256=> mapping(address => uint)) lockedShares;
    /* mapping (address => uint) public lockedShares; */
    mapping(uint256=> mapping(address => uint)) lockedToTotal;
    /* mapping (address => uint) public lockedToTotal; */
    EnumerableSet.AddressSet private holders;
    EnumerableMap.UintToAddressMap private revenues;

    event LockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event unLockedSharesForTransfer(address shareOwner, address to, uint numShares);
    event ItemSold(address buyer, uint256 indexUsed);
    event NewRevenueAdded(address payer, address revenueChannel, uint256 amount, bool sold);
    event Fraktionalized(address holder, address minter, uint256 index);
    event MajorityValueChanged(uint16 newValue);

    constructor() initializer {}

    function init(address _creator, address _revenueChannelImplementation, string calldata uri, uint16 _majority)
        external
        initializer
    {
        /* initialIndexes = [0, 1]; */
        /* amounts = [1, 10000]; */
        /* _mintBatch(_creator, initialIndexes, amounts, ''); */
        __ERC1155_init(uri);
        _mint(_creator, 0, 1, '');//sends the 'nft' to the caller of the function
        /* _mint(_creator, 1, 10000, '');// sends the fraktions to the 'creator' (allow multiple inputs and balances in fraktionalize) */
        fraktionalized = false;
        sold = false;
        /* fraktionsIndex = 1; */
        majority = _majority;
        revenueChannelImplementation = _revenueChannelImplementation;
        holders.add(_creator);
    }


  // User Functions
  ///////////////////////////
    function fraktionalize(address _to, uint _tokenId) public {
      // allow multiple input address to send the fraktions?
      require(_tokenId != 0, 'Not fraktionalizable');
      require(this.balanceOf(_msgSender(), 0) == 1, 'not owner');
      require(fraktionalized == false, 'fraktionalized');
      require(indexUsed[_tokenId] == false, 'index used');
      fraktionalized = true;
      sold = false;
      fraktionsIndex = _tokenId;
      _mint(_to, _tokenId, 10000, 'fraktions');
      emit Fraktionalized(_msgSender(), _to, _tokenId);
    }
    function setMajority(uint16 newValue) public {
      require(this.balanceOf(_msgSender(),0) == 1, 'not owner');
      majority = newValue;
      emit MajorityValueChanged(newValue);
    }
    function defraktionalize() public {
      fraktionalized = false;
      _burn(_msgSender(), fraktionsIndex, 10000);
    }
    function soldBurn(address owner, uint256 _tokenId, uint256 bal) public {
      _burn(owner, _tokenId, bal);
    }
    function lockSharesTransfer(address from, uint numShares, address _to) public {
      if(from != _msgSender()){
          require(isApprovedForAll(from, _msgSender()), 'not approved'); // _msgSender should be the 'market' (or approved)
      }
      require(balanceOf(from, 1) - lockedShares[fraktionsIndex][from] >= numShares,"Not balance");
      lockedShares[fraktionsIndex][from] += numShares;
      lockedToTotal[fraktionsIndex][_to] += numShares;
      emit LockedSharesForTransfer(from, _to, numShares);
    }

    function unlockSharesTransfer(address _to) public {
      require(!sold, 'item sold');
      uint balance = lockedShares[fraktionsIndex][_msgSender()];
      lockedShares[fraktionsIndex][_msgSender()] -= balance;
      lockedToTotal[fraktionsIndex][_to] -= balance;
      emit unLockedSharesForTransfer( _msgSender(), _to, 0);
    }

    function createRevenuePayment() public payable returns (address _clone){
      cleanUpHolders();
      address[] memory owners = holders.values();
      uint256 listLength = holders.length();
      uint256[] memory fraktions = new uint256[](listLength);
      for (uint i=0; i<listLength; i++){
          fraktions[i]=this.balanceOf(owners[i], fraktionsIndex);
        }
      _clone = ClonesUpgradeable.clone(revenueChannelImplementation);
      address payable revenueContract = payable(_clone);
      PaymentSplitterUpgradeable(revenueContract).init(owners, fraktions, fraktionsIndex, sold);
      revenueContract.transfer(msg.value);
      uint256 index = revenues.length();
      revenues.set(index, _clone);
      emit NewRevenueAdded(_msgSender(), revenueContract, msg.value, sold);
    }

    function sellItem() public payable {
      require(this.balanceOf(_msgSender(),0) == 1, 'not owner'); // its the market as intermediary
      sold = true;
      // fraktionalize should be then be false
      fraktionalized = false;
      // and lock the index for future fraktionalizations
      indexUsed[fraktionsIndex] = true;
      emit ItemSold(_msgSender(), fraktionsIndex); // this is not the buyer!!
    }

    function cleanUpHolders() public
    {
      uint256 listLength = holders.length();
      address[] memory remove = new address[](listLength);
      uint16 removeIndex = 0;
      for (uint i=0; i<listLength; i++){
        uint256 bal = this.balanceOf(holders.at(i), fraktionsIndex);//
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
              require((lockedToTotal[fraktionsIndex][to] > 9999), "not approval");
            }
          }
          else{
            require(
              (balanceOf(from, tokenId[0]) - lockedShares[fraktionsIndex][from] >= amount[0]),
                "amount wrong"
            );
            //require(sold != true, 'item is sold'); // sold items block the transfer of fraktions (does not allow to release payment.. and burn them)
          }
          holders.add(to);
        }
    }

  // Getters (which ones are needed?)
  ///////////////////////////
  function getRevenue(uint256 index) public view returns(address){
    return revenues.get(index);
  }
  function getFraktions(address who) public view returns(uint){
    return this.balanceOf(who, fraktionsIndex);
  }
  function getLockedShares(uint256 index, address who) public view returns(uint){
    return lockedShares[index][who];
  }
  function getLockedToTotal(uint256 index, address who) public view returns(uint){
    return lockedToTotal[index][who];
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
