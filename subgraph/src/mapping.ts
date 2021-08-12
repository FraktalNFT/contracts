import {
  Address,
  BigInt,
  Bytes,
  json,
  log,
  // JSONValue,
  // Value
} from '@graphprotocol/graph-ts';
import {
  Minted,
  TokenTransfered,
  ItemListed,
  ItemPriceUpdated,
  Bought
} from "../generated/YourContract/fraktalMarket";
import { addQm } from '@graphprotocol/graph-ts/helper-functions';

import { FraktalNFT, User, ListItem, FraktionsBalance } from "../generated/schema"

class NFTInfo {
  name: string;
  description: string;
  image: string;
}

export function handleMinted(event: Minted): void {
  let senderString = event.params.creator.toHexString()
  let user = User.load(senderString)
  if (user == null) {
    user = new User(senderString)
    user.balance = BigInt.fromI32(0)
  }
  let fraktalString = event.params.nftId.toHexString()
  let fraktalNft = new FraktalNFT(fraktalString)
  fraktalNft.marketId = event.params.nftId - BigInt.fromI32(1)
  fraktalNft.creator = senderString
  fraktalNft.owner = senderString
  fraktalNft.hash = event.params.urlIpfs
  let fraktionsString = senderString+'-'+fraktalString
  let fraktions = new FraktionsBalance(fraktionsString)
  fraktions.amount = BigInt.fromI32(10000)
  fraktions.owner = senderString
  fraktions.nft = fraktalString
  fraktalNft.createdAt = event.block.timestamp
  fraktalNft.transactionHash = event.transaction.hash.toHex()
  fraktions.save()
  fraktalNft.save()
  user.save()
}

export function handleBought(event: Bought): void {
  // event Bought(address buyer,address seller, uint tokenId, uint numberOfShares);
    let fraktalId = event.params.tokenId + BigInt.fromI32(1)
    let fraktalString = fraktalId.toHexString()
    let buyerString = event.params.buyer.toHexString()
    let user = User.load(buyerString)
    if (user == null) {
      user = new User(buyerString)
      user.balance = BigInt.fromI32(0)
      user.save()
    }
    let sellerString = event.params.seller.toHexString()
    let buyerBalance = FraktionsBalance.load(buyerString+'-'+fraktalString)
    if (buyerBalance == null) {
      buyerBalance = new FraktionsBalance(buyerString+'-'+fraktalString)
      buyerBalance.amount = BigInt.fromI32(0)
      buyerBalance.nft = fraktalString
      buyerBalance.owner = buyerString
    }
    let sellerBalance = FraktionsBalance.load(sellerString+'-'+fraktalString)
    buyerBalance.amount += event.params.numberOfShares
    sellerBalance.amount -= event.params.numberOfShares
    let sellerUser = User.load(sellerString)
    let listedItemId = sellerString+'-'+fraktalString
    let listedItem = ListItem.load(listedItemId)
    let value = event.params.numberOfShares * listedItem.price
    sellerUser.balance += value
    listedItem.balance += value
    listedItem.amount -= event.params.numberOfShares

    buyerBalance.save()
    sellerBalance.save()
    sellerUser.save()
    listedItem.save()
}

export function handleItemListed(event: ItemListed): void {
  // event ItemListed(address owner,uint256 tokenId, uint256 price, uint256 amountOfShares, string typeList);
    let fraktalId = event.params.tokenId + BigInt.fromI32(1)
    let fraktalString = fraktalId.toHexString()
    let senderString = event.params.owner.toHexString()
    let listedItemId = senderString+'-'+fraktalString

    let listedItem = new ListItem(listedItemId)
    listedItem.fraktal = fraktalString
    listedItem.seller = senderString
    listedItem.balance = BigInt.fromI32(0)
    listedItem.price = event.params.price
    listedItem.amount = event.params.amountOfShares
    listedItem.type = event.params.typeList
    listedItem.save()
}

export function handleItemPriceUpdated(event: ItemPriceUpdated): void {
  // event ItemPriceUpdated(address owner, uint256 tokenId, uint256 newPrice);
    let fraktalId = event.params.tokenId + BigInt.fromI32(1)
    let fraktalString = fraktalId.toHexString()
    let ownerString = event.params.owner.toHexString()

    let listedItemId = ownerString+'-'+fraktalString
    let listedItem = ListItem.load(listedItemId)
    if(listedItem){
      listedItem.price = event.params.newPrice
      listedItem.save()
    }
}


export function handleTokenTransfered(event: TokenTransfered): void {
  // address sender, address recipient, uint tokenId, uint tokenSubId, uint256 numberOfShares
  let fraktalId = event.params.tokenId + BigInt.fromI32(1)
  let fraktalString = fraktalId.toHexString()
  let fraktalNft = FraktalNFT.load(fraktalString)
  if (fraktalNft) {
    let senderString = event.params.sender.toHexString()
    let user = User.load(senderString)
    if (user == null) {
      user = new User(senderString)
      user.balance = BigInt.fromI32(0)
    }
    let recipientString = event.params.recipient.toHexString()
    let userRecipient = User.load(recipientString)
    if (userRecipient == null) {
      userRecipient = new User(recipientString)
      userRecipient.balance = BigInt.fromI32(0)
    }
    if (event.params.tokenSubId == BigInt.fromI32(0)){
      fraktalNft.owner = recipientString
    } else if (event.params.tokenSubId == BigInt.fromI32(1)) {
      let senderFraktions = FraktionsBalance.load(senderString+'-'+fraktalString)
      let receiverFraktions = FraktionsBalance.load(recipientString+'-'+fraktalString)
      if (receiverFraktions == null) {
        receiverFraktions = new FraktionsBalance(recipientString+'-'+fraktalString)
        receiverFraktions.nft = fraktalString
        receiverFraktions.amount = BigInt.fromI32(0)
        receiverFraktions.owner = recipientString
      }
      senderFraktions.amount -= event.params.numberOfShares
      receiverFraktions.amount += event.params.numberOfShares
      senderFraktions.save()
      receiverFraktions.save()
    }
    user.save()
    userRecipient.save()
    fraktalNft.save()
  }
}
