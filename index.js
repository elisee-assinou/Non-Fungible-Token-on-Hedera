import HederaNftService from './src/HederaNftService.js';
import { IPFS_CID_COLLECTION, COLLECTION_INFO } from './src/data/ipfs-cid.js';

async function main() {
    const nftService = new HederaNftService();

    try {
        console.log('Starting NFT creation and transfer demo with IPFS...\n');
        console.log('Collection info:');
        console.log('- Name:', COLLECTION_INFO.name);
        console.log('- Symbol:', COLLECTION_INFO.symbol);
        console.log('- Total CIDs:', COLLECTION_INFO.totalCIDs);
        console.log();

        // Step 1: Create two accounts
        console.log('1. Creating accounts...');
        console.log('Creating University account (Treasury)...');
        const university = await nftService.createAccount(500);
        console.log('Alice account created:', university.accountId.toString());

        console.log('Creating Bob account (Receiver)...');
        const bob = await nftService.createAccount(150);
        console.log('Bob account created:', bob.accountId.toString());
        console.log();

        // Step 2: Create an NFT token with Alice as treasury
        console.log('2. Creating NFT token with Alice as treasury...');
        const token = await nftService.createNFTToken(university, {
            name: COLLECTION_INFO.name,
            symbol: COLLECTION_INFO.symbol,
            maxSupply: COLLECTION_INFO.maxSupply
        });
        console.log('Token created:', token.tokenId.toString());
        console.log();

        // Step 3: Mint NFTs from IPFS to Alice
        console.log('3. Minting NFTs from IPFS to Alice...');
        const mintResult = await nftService.mintNFTs(token, IPFS_CID_COLLECTION);
        console.log('NFTs minted successfully to Alice!');
        console.log('Serial numbers:', mintResult.serials.map(s => s.toString()));
        console.log();

        // Step 4: Check balances before transfer
        console.log('4. Checking balances before transfer...');
        const aliceBalanceBefore = await nftService.getAccountBalance(alice);
        const bobBalanceBefore = await nftService.getAccountBalance(bob);
        console.log('Alice NFTs before:', Object.keys(aliceBalanceBefore.tokens).length > 0 ? aliceBalanceBefore.tokens : 'None');
        console.log('Bob NFTs before:', Object.keys(bobBalanceBefore.tokens).length > 0 ? bobBalanceBefore.tokens : 'None');
        console.log();

        // Step 5: Transfer first NFT from Alice to Bob
        console.log('5. Transferring first NFT from Alice to Bob...');
        const transferResult = await nftService.transferNFTWithBalanceCheck(
            token.tokenId,
            university,
            bob,
            mintResult.serials[0]
        );
        console.log('Transfer completed successfully!');
        console.log('Transferred NFT serial:', transferResult.summary.serialNumber);
        console.log();

        // Step 6: Check balances after transfer
        console.log('6. Final balances after transfer...');
        const universityBalanceAfter = await nftService.getAccountBalance(university);
        const bobBalanceAfter = await nftService.getAccountBalance(bob);
        console.log('Alice NFTs after:', Object.keys(universityBalanceAfter.tokens).length > 0 ? universityBalanceAfter.tokens : 'None');
        console.log('Bob NFTs after:', Object.keys(bobBalanceAfter.tokens).length > 0 ? bobBalanceAfter.tokens : 'None');
        console.log();

        // Summary
        console.log('=== FINAL SUMMARY ===');
        console.log('Alice account:', university.accountId.toString());
        console.log('Bob account:', bob.accountId.toString());
        console.log('Token ID:', token.tokenId.toString());
        console.log('Total NFTs created:', mintResult.count);
        console.log('NFTs remaining with Alice:', Object.values(universityBalanceAfter.tokens)[0] || 0);
        console.log('NFTs transferred to Bob:', Object.values(bobBalanceAfter.tokens)[0] || 0);
        console.log('Transferred serial number:', transferResult.summary.serialNumber);
        console.log('Transfer success:', transferResult.summary.success);
        console.log('==================\n');

        console.log('All operations completed successfully!');
        console.log('- Created 2 accounts');
        console.log('- Created 1 NFT token');
        console.log('- Minted', mintResult.count, 'NFTs with IPFS metadata');
        console.log('- Transferred 1 NFT between accounts');

        return {
            university,
            bob,
            token,
            mintResult,
            transferResult
        };

    } catch (error) {
        console.error('Error during demo:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        nftService.close();
    }
}

// Run the main function
main();