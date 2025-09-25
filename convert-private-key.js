#!/usr/bin/env node

/**
 * Script to convert Solana private key from byte array format to base58 format
 */

const bs58 = require('bs58');

function convertByteArrayToBase58(byteArray) {
    try {
        // If input is a string representation of an array, parse it
        if (typeof byteArray === 'string') {
            // Remove brackets and whitespace, then split by comma
            const cleaned = byteArray.replace(/[\[\]\s]/g, '');
            if (cleaned) {
                byteArray = cleaned.split(',').map(Number);
            }
        }
        
        // Validate that we have exactly 64 bytes for a Solana private key
        if (!Array.isArray(byteArray) || byteArray.length !== 64) {
            throw new Error('Invalid byte array length. Expected 64 bytes for Solana private key.');
        }
        
        // Validate that all elements are valid bytes (0-255)
        for (let i = 0; i < byteArray.length; i++) {
            if (!Number.isInteger(byteArray[i]) || byteArray[i] < 0 || byteArray[i] > 255) {
                throw new Error(`Invalid byte value at index ${i}: ${byteArray[i]}`);
            }
        }
        
        // Convert byte array to Buffer
        const buffer = Buffer.from(byteArray);
        
        // Encode to base58
        const base58Key = bs58.encode(buffer);
        
        return base58Key;
    } catch (error) {
        console.error('Error converting private key:', error.message);
        return null;
    }
}

function convertBase58ToByteArray(base58Key) {
    try {
        // Decode base58 to buffer
        const buffer = bs58.decode(base58Key);
        
        // Convert buffer to byte array
        const byteArray = Array.from(buffer);
        
        return byteArray;
    } catch (error) {
        console.error('Error converting private key:', error.message);
        return null;
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage:');
        console.log('  node convert-private-key.js "byte1,byte2,byte3,..."');
        console.log('  node convert-private-key.js "[byte1, byte2, byte3, ...]"');
        console.log('  node convert-private-key.js --to-bytes base58Key');
        console.log('\nExamples:');
        console.log('  node convert-private-key.js "56,129,44,148,156,125,108,198,204,32,29,5,8,208,198,36,94,156,22,184,235,14,130,63,243,146,133,147,95,243,186,172,6,110,87,220,223,179,19,183,129,15,99,203,31,79,50,146,139,90,121,18,186,231,187,214,58,218,234,37,25,186,138,43"');
        console.log('  node convert-private-key.js --to-bytes "3xYCBoiHCrFDm9CycpvpFcR4JGVaiVoDTyLQEy1rJE6h9SCr4otTEipWHDmcPsoBBvEDVUzrfZbp8Bp6b1rjCAz"');
        return;
    }
    
    if (args[0] === '--to-bytes') {
        // Convert from base58 to byte array
        const base58Key = args[1];
        if (!base58Key) {
            console.error('Please provide a base58 private key');
            return;
        }
        
        const byteArray = convertBase58ToByteArray(base58Key);
        if (byteArray) {
            console.log('Base58 private key:');
            console.log(base58Key);
            console.log('\nConverted to byte array:');
            console.log(JSON.stringify(byteArray));
            console.log('[' + byteArray.join(', ') + ']');
        }
    } else {
        // Convert from byte array to base58
        const input = args.join(' ');
        const base58Key = convertByteArrayToBase58(input);
        
        if (base58Key) {
            console.log('Byte array:');
            console.log(input);
            console.log('\nConverted to base58:');
            console.log(base58Key);
        }
    }
}

// If this script is run directly, execute main function
if (require.main === module) {
    main();
}

module.exports = {
    convertByteArrayToBase58,
    convertBase58ToByteArray
};