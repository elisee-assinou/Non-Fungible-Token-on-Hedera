import dotenv from "dotenv";
import {
    AccountCreateTransaction,
    Client,
    Hbar,
    PrivateKey,
    TokenCreateTransaction,
    TokenInfoQuery,
    TokenMintTransaction,
    TokenSupplyType,
    TokenType,
    TokenAssociateTransaction,
    TransferTransaction,
    AccountBalanceQuery,
    TokenId
} from "@hashgraph/sdk";

dotenv.config();

class HederaNftService {
    constructor() {
        this.operatorId = process.env.OPERATOR_ID;
        this.operatorKey = process.env.OPERATOR_KEY;
        this.client = null;

        if (!this.operatorKey || !this.operatorId) {
            throw new Error("Please set OPERATOR_ID and OPERATOR_KEY in your .env file");
        }

        console.log("HederaNftService initialized");
    }

    /**
     * Obtenir le client Hedera (singleton pattern)
     */
    getClient() {
        if (!this.client) {
            this.client = Client.forTestnet();
            this.client.setOperator(this.operatorId, this.operatorKey);
            this.client.setDefaultMaxTransactionFee(new Hbar(50));
            this.client.setDefaultMaxQueryPayment(new Hbar(30));
            console.log("Client Hedera connecté");
        }
        return this.client;
    }

    /**
     * Fermeture de la connexion client
     */
    close() {
        if (this.client) {
            this.client.close();
            this.client = null;
            console.log("Client Hedera fermé");
        }
    }

    /**
     * Create an account
     * @param {number} initialBalance - Balance initiale en HBAR
     * @returns {Object} Account data
     */
    async createAccount(initialBalance = 100) {
        try {
            const client = this.getClient();

            console.log("Creating account...");

            // Create new keys
            const privateKey = PrivateKey.generateED25519();
            const publicKey = privateKey.publicKey;

            // Account creation transaction
            const transaction = await new AccountCreateTransaction()
                .setKey(publicKey) // Correction: setKey au lieu de setKeyWithoutAlias
                .setInitialBalance(new Hbar(initialBalance))
                .execute(client);

            const receipt = await transaction.getReceipt(client);
            const accountId = receipt.accountId;
            const status = receipt.status;

            console.log("Account created successfully!");
            console.log("Account ID:", accountId?.toString());
            console.log("Status:", status?.toString());
            console.log("Balance:", initialBalance, "HBAR");

            return {
                accountId: accountId,
                privateKey: privateKey,
                publicKey: publicKey,
                status: status,
                balance: initialBalance,
            };

        } catch (error) {
            console.error("Error creating account:", error.message);
            throw error;
        }
    }

    /**
     * Create NFT Token
     * @param {Object} treasuryAccount - Account object from createAccount
     * @param {Object} tokenConfig - Optional token configuration
     * @returns {Object} Token data with info from API
     */
    async createNFTToken(treasuryAccount, tokenConfig = {}) {
        try {
            const client = this.getClient();

            // Configuration par défaut avec possibilité de surcharge
            const config = {
                name: "diploma",
                symbol: "GRAD",
                maxSupply: 250,
                ...tokenConfig // Permet de surcharger les valeurs par défaut
            };

            console.log("Creating NFT token...");
            console.log("Name:", config.name);
            console.log("Symbol:", config.symbol);
            console.log("Max Supply:", config.maxSupply);

            // Create NFT token transaction
            const transaction = await new TokenCreateTransaction()
                .setTokenName(config.name)
                .setTokenSymbol(config.symbol)
                .setTokenType(TokenType.NonFungibleUnique)
                .setDecimals(0)
                .setInitialSupply(0)
                .setTreasuryAccountId(treasuryAccount.accountId)
                .setSupplyType(TokenSupplyType.Finite)
                .setMaxSupply(config.maxSupply)
                .setSupplyKey(treasuryAccount.privateKey)
                .freezeWith(client);

            // Sign and execute transaction
            const signedTx = await transaction.sign(treasuryAccount.privateKey);
            const response = await signedTx.execute(client);
            const receipt = await response.getReceipt(client);
            const tokenId = receipt.tokenId;
            const status = receipt.status;

            console.log("NFT Token created successfully!");
            console.log("Token ID:", tokenId?.toString());
            console.log("Status:", status?.toString());

            // Query pour récupérer les vraies infos du token
            console.log("Fetching token information from API...");
            const tokenInfo = await new TokenInfoQuery()
                .setTokenId(tokenId)
                .execute(client);

            // Afficher les infos récupérées
            console.log("Token Information:");
            console.log("Name:", tokenInfo.name);
            console.log("Symbol:", tokenInfo.symbol);
            console.log("Type:", tokenInfo.tokenType?.toString());
            console.log("Max Supply:", tokenInfo.maxSupply?.toString());
            console.log("Treasury:", tokenInfo.treasuryAccountId?.toString());

            // Return structuré avec vraies données de l'API
            return {
                // Données de base
                tokenId: tokenId,
                status: status,

                // Vraies infos de l'API Hedera
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                tokenType: tokenInfo.tokenType,
                decimals: tokenInfo.decimals,
                totalSupply: tokenInfo.totalSupply,
                maxSupply: tokenInfo.maxSupply,
                supplyType: tokenInfo.supplyType,
                treasuryAccountId: tokenInfo.treasuryAccountId,
                supplyKey: tokenInfo.supplyKey,
                creationTime: tokenInfo.creationTime,

                // Garder la référence du treasury account
                treasuryAccount: treasuryAccount
            };

        } catch (error) {
            console.error("Error creating NFT token:", error.message);
            throw error;
        }
    }

    /**
     * Mint NFTs
     * @param {Object} tokenData - Token object from createNFTToken
     * @param {Array|Object} metadataArray - Metadata for NFTs
     * @returns {Object} Mint result with serial numbers
     */
    async mintNFTs(tokenData, metadataArray) {
        try {
            const client = this.getClient();

            // S'assurer que metadataArray est un tableau
            const metadatas = Array.isArray(metadataArray) ? metadataArray : [metadataArray];

            console.log("Minting", metadatas.length, "NFT(s)...");

            // Convertir les métadonnées en Buffer
            const metadataBuffers = metadatas.map(metadata => {
                const metadataString = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
                return Buffer.from(metadataString);
            });

            // Mint transaction
            const transaction = await new TokenMintTransaction()
                .setTokenId(tokenData.tokenId)
                .setMetadata(metadataBuffers)
                .freezeWith(client);

            // Utiliser la bonne référence pour signer
            const signedTransaction = await transaction.sign(tokenData.treasuryAccount.privateKey);
            const response = await signedTransaction.execute(client);
            const receipt = await response.getReceipt(client);

            const serials = receipt.serials;

            console.log("NFT(s) minted successfully!");
            console.log("Serial Numbers:", serials?.map(s => s.toString()));

            // Return structuré
            return {
                serials: serials,
                status: receipt.status,
                tokenId: tokenData.tokenId,
                count: serials?.length || 0,
                mintedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error("Error minting NFTs:", error.message);
            throw error;
        }
    }

    /**
     * Helper method - Get essential token information
     * @param {string} tokenId - Token ID
     * @returns {Object} Essential token info
     */
    async getTokenBasicInfo(tokenId) {
        try {
            const client = this.getClient();

            console.log("Getting token info for:", tokenId?.toString());

            const tokenInfo = await new TokenInfoQuery()
                .setTokenId(tokenId)
                .execute(client);

            return {
                tokenId: tokenInfo.tokenId?.toString(),
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                type: tokenInfo.tokenType?.toString(),
                totalSupply: tokenInfo.totalSupply?.toString(),
                maxSupply: tokenInfo.maxSupply?.toString(),
                treasury: tokenInfo.treasuryAccountId?.toString()
            };
        } catch (error) {
            console.error("Error getting token basic info:", error.message);
            throw error;
        }
    }

    /**
     * Associate a token with an account (required before receiving NFTs)
     * @param {Object} account - Account object
     * @param {string} tokenId - Token ID to associate
     * @returns {Object} Association result
     */
    async associateTokenToAccount(account, tokenId) {
        try {
            const client = this.getClient();

            console.log("Associating token", tokenId?.toString(), "to account", account.accountId?.toString());

            const transaction = await new TokenAssociateTransaction()
                .setAccountId(account.accountId)
                .setTokenIds([tokenId])
                .freezeWith(client);

            const signedTx = await transaction.sign(account.privateKey);
            const response = await signedTx.execute(client);
            const receipt = await response.getReceipt(client);

            console.log("Token association successful!");
            console.log("Status:", receipt.status?.toString());

            return {
                status: receipt.status,
                accountId: account.accountId,
                tokenId: tokenId,
                associatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error("Error associating token to account:", error.message);
            throw error;
        }
    }

    /**
     * Get account balance (HBAR + tokens)
     * @param {string|Object} account - Account ID string or account object
     * @returns {Object} Account balance information
     */
    async getAccountBalance(account) {
        try {
            const client = this.getClient();
            const accountId = typeof account === 'string' ? account : account.accountId;

            console.log("Getting balance for account:", accountId?.toString());

            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(client);

            const result = {
                accountId: accountId?.toString(),
                hbarBalance: balance.hbars?.toString(),
                tokens: {}
            };

            // Convertir les tokens en format lisible
            if (balance.tokens && balance.tokens.size > 0) {
                balance.tokens.forEach((amount, tokenId) => {
                    result.tokens[tokenId.toString()] = amount.toString();
                });
            }

            console.log("Account Balance:");
            console.log("HBAR:", result.hbarBalance);
            console.log("Tokens:", Object.keys(result.tokens).length > 0 ? result.tokens : "None");

            return result;

        } catch (error) {
            console.error("Error getting account balance:", error.message);
            throw error;
        }
    }

    /**
     * Transfer NFT from one account to another
     * @param {string} tokenId - Token ID
     * @param {Object} fromAccount - Sender account object
     * @param {Object} toAccount - Receiver account object
     * @param {number} serialNumber - NFT serial number
     * @returns {Object} Transfer result
     */
    async transferNFT(tokenId, fromAccount, toAccount, serialNumber) {
        try {
            const client = this.getClient();

            console.log("Transferring NFT...");
            console.log("Token ID:", tokenId?.toString());
            console.log("Serial Number:", serialNumber);
            console.log("From:", fromAccount.accountId?.toString());
            console.log("To:", toAccount.accountId?.toString());

            // Create transfer transaction
            const transaction = await new TransferTransaction()
                .addNftTransfer(tokenId, serialNumber, fromAccount.accountId, toAccount.accountId)
                .freezeWith(client);

            // Sign with both accounts (sender and receiver)
            const signedTx = await transaction
                .sign(fromAccount.privateKey)
                .sign(toAccount.privateKey);

            const response = await signedTx.execute(client);
            const receipt = await response.getReceipt(client);

            console.log("NFT transfer successful!");
            console.log("Status:", receipt.status?.toString());

            return {
                status: receipt.status,
                tokenId: tokenId,
                serialNumber: serialNumber,
                fromAccount: fromAccount.accountId?.toString(),
                toAccount: toAccount.accountId?.toString(),
                transferredAt: new Date().toISOString()
            };

        } catch (error) {
            console.error("Error transferring NFT:", error.message);
            throw error;
        }
    }

    /**
     * Complete NFT transfer workflow with balance checks
     * @param {string} tokenId - Token ID
     * @param {Object} fromAccount - Sender account
     * @param {Object} toAccount - Receiver account
     * @param {number} serialNumber - NFT serial number
     * @returns {Object} Complete transfer result with before/after balances
     */
    async transferNFTWithBalanceCheck(tokenId, fromAccount, toAccount, serialNumber) {
        try {
            console.log("Starting NFT transfer with balance checks...\n");

            // Step 1: Check balances before transfer
            console.log("BEFORE TRANSFER:");
            const beforeBalanceFrom = await this.getAccountBalance(fromAccount);
            const beforeBalanceTo = await this.getAccountBalance(toAccount);
            console.log();

            // Step 2: Associate token to receiver if needed
            try {
                await this.associateTokenToAccount(toAccount, tokenId);
                console.log();
            } catch (error) {
                if (error.message.includes("TOKEN_ALREADY_ASSOCIATED")) {
                    console.log("Token already associated to receiver account");
                    console.log();
                } else {
                    throw error;
                }
            }

            // Step 3: Execute transfer
            const transferResult = await this.transferNFT(tokenId, fromAccount, toAccount, serialNumber);
            console.log();

            // Step 4: Check balances after transfer
            console.log("AFTER TRANSFER:");
            const afterBalanceFrom = await this.getAccountBalance(fromAccount);
            const afterBalanceTo = await this.getAccountBalance(toAccount);

            // Summary
            const result = {
                transferResult: transferResult,
                balances: {
                    before: {
                        sender: beforeBalanceFrom,
                        receiver: beforeBalanceTo
                    },
                    after: {
                        sender: afterBalanceFrom,
                        receiver: afterBalanceTo
                    }
                },
                summary: {
                    tokenId: tokenId?.toString(),
                    serialNumber: serialNumber,
                    from: fromAccount.accountId?.toString(),
                    to: toAccount.accountId?.toString(),
                    success: transferResult.status?.toString() === "SUCCESS"
                }
            };

            console.log("\nTransfer completed successfully!");
            console.log("Summary:");
            console.log("Token transferred:", result.summary.tokenId);
            console.log("Serial Number:", result.summary.serialNumber);
            console.log("From account:", result.summary.from);
            console.log("To account:", result.summary.to);
            console.log("Success:", result.summary.success);

            return result;

        } catch (error) {
            console.error("Error in transfer workflow:", error.message);
            throw error;
        }
    }

    /**
     * Complete workflow - Create account, token and mint NFTs
     * @param {Object} tokenConfig - Token configuration
     * @param {Array} metadataArray - NFT metadata
     * @param {number} initialBalance - Initial account balance
     * @returns {Object} Complete workflow result
     */
    async createCompleteNFTCollection(tokenConfig = {}, metadataArray = [], initialBalance = 100) {
        try {
            console.log("Starting complete NFT workflow...\n");

            // Step 1: Create an account
            const account = await this.createAccount(initialBalance);
            console.log();

            // Step 2: Create a token
            const tokenData = await this.createNFTToken(account, tokenConfig);
            console.log();

            // Step 3: Mint NFTs (si metadata fournie)
            let mintResult = null;
            if (metadataArray.length > 0) {
                mintResult = await this.mintNFTs(tokenData, metadataArray);
                console.log();
            }

            // Summary
            const result = {
                account: account,
                tokenData: tokenData,
                mintResult: mintResult,
                summary: {
                    accountId: account.accountId?.toString(),
                    tokenId: tokenData.tokenId?.toString(),
                    nftCount: mintResult?.count || 0,
                    serials: mintResult?.serials?.map(s => s.toString()) || []
                }
            };

            console.log("Workflow completed successfully!");
            console.log("Summary:");
            console.log("Account ID:", result.summary.accountId);
            console.log("Token ID:", result.summary.tokenId);
            if (mintResult) {
                console.log("NFTs minted:", result.summary.nftCount);
                console.log("Serial Numbers:", result.summary.serials);
            }

            return result;

        } catch (error) {
            console.error("Error in complete workflow:", error.message);
            throw error;
        }
    }
}

export default HederaNftService;
