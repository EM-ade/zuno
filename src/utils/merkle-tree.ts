import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';
import { PublicKey } from '@solana/web3.js';

/**
 * Generate a Merkle tree from a list of addresses
 * @param addresses List of wallet addresses
 * @returns Merkle tree and root
 */
export function generateMerkleTree(addresses: string[]): {
  tree: MerkleTree;
  root: Buffer;
  proofs: Map<string, Buffer[]>;
} {
  // Convert addresses to buffers
  const leaves = addresses.map(addr => {
    try {
      // Try to parse as Solana public key
      const pubkey = new PublicKey(addr);
      return pubkey.toBuffer();
    } catch (error) {
      // If not a valid Solana address, hash the string
      return keccak256(addr);
    }
  });

  // Create Merkle tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot();
  
  // Generate proofs for each address
  const proofs = new Map<string, Buffer[]>();
  addresses.forEach((addr, index) => {
    const leaf = leaves[index];
    const proof = tree.getProof(leaf);
    proofs.set(addr, proof.map((p: { data: Buffer }) => p.data));
  });

  return { tree, root, proofs };
}

/**
 * Verify if an address is part of the allow list
 * @param address Wallet address to verify
 * @param proof Merkle proof for the address
 * @param root Merkle root
 * @returns Boolean indicating if address is in the allow list
 */
export function verifyAddressInAllowList(
  address: string,
  proof: Buffer[],
  root: Buffer
): boolean {
  try {
    // Convert address to buffer
    const leaf = new PublicKey(address).toBuffer();
    
    // Create Merkle tree for verification
    const tree = new MerkleTree([], keccak256);
    
    // Verify the proof
    return tree.verify(proof, leaf, root);
  } catch (error) {
    console.error('Error verifying address in allow list:', error);
    return false;
  }
}