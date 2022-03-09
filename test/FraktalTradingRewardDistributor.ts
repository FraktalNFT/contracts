// @ts-nocheck
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "js-sha3";
import {parseEther} from "ethers/lib/utils";
import {MockFrak, TradingRewardsDistributor} from "../typechain";

function computeHash(user: string, amount: string) {
    return Buffer.from(utils.solidityKeccak256(["address", "uint256"], [user, amount]).slice(2), "hex");
}

let admin, accounts
let mockFrak: MockFrak
let tradingRewardsDistributor: TradingRewardsDistributor
let tree: any, hexRoot: any

describe("TradingRewardDistributor", function () {
    beforeEach(async function () {
        [admin, ...accounts] = await ethers.getSigners()
        const MockFrack = await ethers.getContractFactory("MockFrak");
        mockFrak = (await MockFrack.deploy()) as MockFrak;
        await mockFrak.deployed()

        const TradingRewardDistributor = await ethers.getContractFactory("TradingRewardsDistributor");
        tradingRewardsDistributor = (await TradingRewardDistributor.connect(admin).deploy(mockFrak.address)) as TradingRewardsDistributor;
        await tradingRewardsDistributor.deployed();

        // mint mock token
        await mockFrak.mint(admin.address, parseEther("1000000").toString())
        await mockFrak.connect(admin).transfer(tradingRewardsDistributor.address, parseEther("10000"))
    });

    describe("#1 - Regular claims work as expected", async function () {
        it("Claim - Users can claim", async function () {
            // Users 1 to 4
            const json = {
                [accounts[0].address]: parseEther("5000").toString(),
                [accounts[1].address]: parseEther("3000").toString(),
                [accounts[2].address]: parseEther("1000").toString(),
                [accounts[3].address]: parseEther("1000").toString(),
            };

            tree = new MerkleTree(
                Object.entries(json).map((data) => computeHash(...data)),
                keccak256,
                { sortPairs: true }
            );

            // Compute the root of the tree
            hexRoot = tree.getHexRoot();

            let tx = await tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("5000"));
            expect(tx).to.emit(tradingRewardsDistributor, "UpdateTradingRewards").withArgs("1")

            await tradingRewardsDistributor.connect(admin).unpauseDistribution();

            // All users except the 4th one claims
            for (const [index, [user, value]] of Object.entries(Object.entries(json))) {
                if (user == accounts[3].address) {
                    break;
                }
                // Compute the proof for the user
                const hexProof = tree.getHexProof(computeHash(user, value as string), index);

                // Verify leaf is matched in the tree with the computed root
                assert.equal(tree.verify(hexProof, computeHash(user, value as string), hexRoot), true);

                // Check user status
                let claimStatus = await tradingRewardsDistributor.canClaim(user, value as string, hexProof);
                assert.equal(claimStatus[0], true);
                assert.equal(claimStatus[1].toString(), value);

                tx = await tradingRewardsDistributor.connect(accounts[index]).claim(value as string, hexProof);
                expect(tx).to.emit(tradingRewardsDistributor, "RewardsClaim").withArgs(user, "1", value)

                claimStatus = await tradingRewardsDistributor.canClaim(user, value as string, hexProof);
                assert.equal(claimStatus[0], false);
                assert.equal(claimStatus[1].toString(), parseEther("0").toString());

                assert.equal((await tradingRewardsDistributor.amountClaimedByUser(user)).toString(), value);

                // Cannot double claim

                await expect(
                    tradingRewardsDistributor.connect(accounts[index]).claim(value as string, hexProof)
                ).to.revertedWith("Rewards: Already claimed");
            }

            // Transfer funds to the mockLooksRareToken
            await mockFrak.connect(admin).transfer(tradingRewardsDistributor.address, parseEther("10000"));

            // Users 1 to 4 (10k rewards added)
            const jsonRound2 = {
                [accounts[0].address]: parseEther("8000").toString(),
                [accounts[1].address]: parseEther("6000").toString(),
                [accounts[2].address]: parseEther("3000").toString(),
                [accounts[3].address]: parseEther("3000").toString(),
            };

            tree = new MerkleTree(
                Object.entries(jsonRound2).map((data) => computeHash(...data)),
                keccak256,
                { sortPairs: true }
            );

            // Compute the root of the tree
            hexRoot = tree.getHexRoot();

            tx = await tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("8000"));
            expect(tx).to.emit(tradingRewardsDistributor, "UpdateTradingRewards").withArgs("2");

            // All users except the 4th one claims
            for (const [index, [user, value]] of Object.entries(Object.entries(jsonRound2))) {
                if (user == accounts[3].address) {
                    break;
                }

                // Compute the proof for the user
                const hexProof = tree.getHexProof(computeHash(user, value), index);

                // Verify leaf is matched in the tree with the computed root
                assert.equal(tree.verify(hexProof, computeHash(user, value), hexRoot), true);

                // Fetch the amount previous claimed by the user and deduct the amount they will received
                const amountPreviouslyClaimed = await tradingRewardsDistributor.amountClaimedByUser(user);
                const expectedAmountToReceive = BigNumber.from(value).sub(BigNumber.from(amountPreviouslyClaimed.toString()));

                // Check user status
                let claimStatus = await tradingRewardsDistributor.canClaim(user, value, hexProof);
                assert.equal(claimStatus[0], true);
                assert.equal(claimStatus[1].toString(), expectedAmountToReceive.toString());

                tx = await tradingRewardsDistributor.connect(accounts[index]).claim(value, hexProof);
                expect(tx).to.emit(tradingRewardsDistributor, "RewardsClaim").withArgs(user, "2", expectedAmountToReceive.toString())

                claimStatus = await tradingRewardsDistributor.canClaim(user, value, hexProof);
                assert.equal(claimStatus[0], false);
                assert.equal(claimStatus[1].toString(), parseEther("0").toString());

                assert.equal((await tradingRewardsDistributor.amountClaimedByUser(user)).toString(), value);

                // Cannot double claim
                await expect(
                    tradingRewardsDistributor.connect(accounts[index]).claim(value, hexProof),
                ).to.revertedWith("Rewards: Already claimed");
            }

            // User (accounts[3]) claims for two periods
            const lateClaimer = accounts[3].address;
            const expectedAmountToReceive = parseEther("3000");

            // Compute the proof for the user4
            const hexProof = tree.getHexProof(computeHash(lateClaimer, expectedAmountToReceive.toString()), "3");

            // Verify leaf is matched in the tree with the computed root
            assert.equal(tree.verify(hexProof, computeHash(lateClaimer, expectedAmountToReceive.toString()), hexRoot), true);

            tx = await tradingRewardsDistributor.connect(accounts[3]).claim(expectedAmountToReceive, hexProof);
            expect(tx).to.emit(tradingRewardsDistributor, "RewardsClaim").withArgs(lateClaimer, "2", expectedAmountToReceive.toString())
        });

        it("Claim - Users cannot claim with wrong proofs", async () => {
            // Users 1 to 4
            const json = {
                [accounts[0].address]: parseEther("5000").toString(),
                [accounts[1].address]: parseEther("3000").toString(),
                [accounts[2].address]: parseEther("1000").toString(),
                [accounts[3].address]: parseEther("1000").toString(),
            };

            // Compute tree
            tree = new MerkleTree(
                Object.entries(json).map((data) => computeHash(...data)),
                keccak256,
                { sortPairs: true }
            );

            // Compute the root of the tree
            hexRoot = tree.getHexRoot();

            const user1 = accounts[0].address;
            const user2 = accounts[1].address;
            const notEligibleUser = accounts[10].address;

            const expectedAmountToReceiveForUser1 = parseEther("5000");
            const expectedAmountToReceiveForUser2 = parseEther("3000");

            // Compute the proof for user1/user2
            const hexProof1 = tree.getHexProof(computeHash(user1, expectedAmountToReceiveForUser1.toString()), "0");
            const hexProof2 = tree.getHexProof(computeHash(user2, expectedAmountToReceiveForUser2.toString()), "1");

            // Owner adds trading rewards and unpause distribution
            await tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("5000"));
            await tradingRewardsDistributor.connect(admin).unpauseDistribution();

            // 1. Verify leafs for user1/user2 are matched in the tree with the computed root
            assert.equal(
                tree.verify(hexProof1, computeHash(user1, expectedAmountToReceiveForUser1.toString()), hexRoot),
                true
            );

            assert.equal(
                tree.verify(hexProof2, computeHash(user2, expectedAmountToReceiveForUser2.toString()), hexRoot),
                true
            );

            // 2. User2 cannot claim with proof of user1
            assert.equal(
                tree.verify(hexProof1, computeHash(user2, expectedAmountToReceiveForUser1.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(user2, expectedAmountToReceiveForUser2, hexProof1))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[1]).claim(expectedAmountToReceiveForUser2, hexProof1)
            ).to.revertedWith("Rewards: Invalid proof");

            // 3. User1 cannot claim with proof of user2
            assert.equal(
                tree.verify(hexProof2, computeHash(user1, expectedAmountToReceiveForUser2.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(user1, expectedAmountToReceiveForUser2, hexProof2))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[0]).claim(expectedAmountToReceiveForUser1, hexProof2),
            ).to.revertedWith("Rewards: Invalid proof");

            // 4. User1 cannot claim with amount of user2
            assert.equal(
                tree.verify(hexProof1, computeHash(user1, expectedAmountToReceiveForUser2.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(user1, expectedAmountToReceiveForUser2, hexProof1))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[0]).claim(expectedAmountToReceiveForUser2, hexProof1)
            ).to.revertedWith("Rewards: Invalid proof");

            // 5. User2 cannot claim with amount of user1
            assert.equal(
                tree.verify(hexProof2, computeHash(user2, expectedAmountToReceiveForUser1.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(user2, expectedAmountToReceiveForUser1, hexProof2))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[1]).claim(expectedAmountToReceiveForUser1, hexProof2 ),
            ).to.revertedWith("Rewards: Invalid proof");

            // 6. Non-eligible user cannot claim with proof/amount of user1
            assert.equal(
                tree.verify(hexProof1, computeHash(notEligibleUser, expectedAmountToReceiveForUser1.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(notEligibleUser, expectedAmountToReceiveForUser1, hexProof1))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[10]).claim(expectedAmountToReceiveForUser1, hexProof1),
            ).to.revertedWith("Rewards: Invalid proof");

            // 7. Non-eligible user cannot claim with proof/amount of user1
            assert.equal(
                tree.verify(hexProof2, computeHash(notEligibleUser, expectedAmountToReceiveForUser2.toString()), hexRoot),
                false
            );

            assert.equal(
                (await tradingRewardsDistributor.canClaim(notEligibleUser, expectedAmountToReceiveForUser2, hexProof2))[0],
                false
            );

            await expect(
                tradingRewardsDistributor.connect(accounts[10]).claim(expectedAmountToReceiveForUser2, hexProof2),
            ).to.revertedWith("Rewards: Invalid proof");
        });

        it("Claim - User cannot claim if error in tree computation due to amount too high", async () => {
            // Users 1 to 4
            const json = {
                [accounts[0].address]: parseEther("5000").toString(),
                [accounts[1].address]: parseEther("3000").toString(),
                [accounts[2].address]: parseEther("1000").toString(),
                [accounts[3].address]: parseEther("1000").toString(),
            };

            // Compute tree
            tree = new MerkleTree(
                Object.entries(json).map((data) => computeHash(...data)),
                keccak256,
                { sortPairs: true }
            );

            // Compute the root of the tree
            hexRoot = tree.getHexRoot();

            const user1 = accounts[0].address;
            const expectedAmountToReceiveForUser1 = parseEther("5000");

            // Compute the proof for user1/user2
            const hexProof1 = tree.getHexProof(computeHash(user1, expectedAmountToReceiveForUser1.toString()), "0");

            // Owner adds trading rewards and unpause distribution
            await tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("4999.9999"));
            await tradingRewardsDistributor.connect(admin).unpauseDistribution();

            await expect(
                tradingRewardsDistributor.connect(accounts[0]).claim(expectedAmountToReceiveForUser1, hexProof1),
            ).to.revertedWith("Rewards: Amount higher than max");
        });
    });

    describe("#2 - Owner functions", async () => {
        it("Owner - Owner cannot withdraw immediately after pausing", async () => {
            const depositAmount = parseEther("10000");

            // Transfer funds to the mockLooksRareToken
            await mockFrak.connect(admin).transfer(tradingRewardsDistributor.address, depositAmount);

            let tx = await tradingRewardsDistributor.connect(admin).unpauseDistribution();
            expect(tx).to.emit(tradingRewardsDistributor, "Unpaused");

            tx = await tradingRewardsDistributor.connect(admin).pauseDistribution();
            expect(tx).to.emit(tradingRewardsDistributor, "Paused");

            await expect(
                tradingRewardsDistributor.connect(admin).withdrawTokenRewards(depositAmount),
            ).to.revertedWith("Owner: Too early to withdraw");

            const lastPausedTimestamp = await tradingRewardsDistributor.lastPausedTimestamp();
            const BUFFER_ADMIN_WITHDRAW = await tradingRewardsDistributor.BUFFER_ADMIN_WITHDRAW();

            // Jump in time to the period where it becomes possible to claim
            await time.increaseTo(lastPausedTimestamp.add(BUFFER_ADMIN_WITHDRAW + 1000).toString());

            tx = await tradingRewardsDistributor.connect(admin).withdrawTokenRewards(depositAmount);
            expect(tx).to.emit(tradingRewardsDistributor, "TokenWithdrawnOwner").withArgs(depositAmount.toString())
        });

        it("Owner - Owner cannot set twice the same Merkle Root", async () => {
            // Users 1 to 4
            const json = {
                [accounts[0].address]: parseEther("5000").toString(),
                [accounts[1].address]: parseEther("3000").toString(),
                [accounts[2].address]: parseEther("1000").toString(),
                [accounts[2].address]: parseEther("1000").toString(),
            };

            tree = new MerkleTree(
                Object.entries(json).map((data) => computeHash(...data)),
                keccak256,
                { sortPairs: true }
            );

            // Compute the root of the tree
            hexRoot = tree.getHexRoot();

            await tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("5000"));
            await tradingRewardsDistributor.connect(admin).unpauseDistribution();

            await expectRevert(
                tradingRewardsDistributor.connect(admin).updateTradingRewards(hexRoot, parseEther("5000")),
                "Owner: Merkle root already used"
            );
        });
    });
});
