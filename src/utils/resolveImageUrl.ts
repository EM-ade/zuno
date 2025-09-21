const PINATA_GATEWAY = (process.env.NEXT_PUBLIC_PINATA_GATEWAY as string) || 'turquoise-cheerful-angelfish-408.mypinata.cloud';

export function resolveImageUrl(u?: string) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  if (u.startsWith('ipfs://')) {
    const cid = u.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  return u;
}
