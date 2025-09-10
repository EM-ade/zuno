"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

interface Props {
  src: string; // can be http(s) url, ipfs://CID or raw CID
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

function extractCid(input: string): string | null {
  if (!input) return null;
  // ipfs://<cid>
  if (input.startsWith('ipfs://')) {
    return input.replace('ipfs://', '').replace(/^ipfs\//, '');
  }
  // raw CID (46+ alphanumeric-like)
  if (/^\w{46,}$/.test(input)) return input;
  // gateway url -> try to extract after /ipfs/
  const m = input.match(/\/ipfs\/([A-Za-z0-9]+(?:[A-Za-z0-9_\-])+)/);
  if (m && m[1]) return m[1];
  return null;
}

export default function ImageWithFallback({ src, alt, width, height, className, priority }: Props) {
  const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || '';
  const cid = extractCid(src);

  const sources = useMemo(() => {
    if (cid) {
      const account = pinataGateway ? `https://${pinataGateway}/ipfs/${cid}` : null;
      // Prefer signed URL first for private assets, then fall back to gateways
      return [
        '__SIGNED__',
        account,
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
      ].filter(Boolean) as string[];
    }
    // if src is a full http(s) URL not matching ipfs pattern, just use it
    return [src];
  }, [cid, pinataGateway, src]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const currentKey = sources[currentIndex];
  const currentSrc = currentKey === '__SIGNED__' ? (signedUrl || null) : (currentKey ?? null);

  // When targeting the signed URL slot and we don't have it yet, request it immediately
  useEffect(() => {
    let cancelled = false;
    const fetchSigned = async () => {
      if (currentKey === '__SIGNED__' && cid && !signedUrl) {
        try {
          const res = await fetch(`/api/pinata/signed-url?cid=${encodeURIComponent(cid)}&ttl=300`);
          const json = await res.json();
          if (!cancelled && json?.success && json?.signedUrl) {
            setSignedUrl(json.signedUrl as string);
          }
        } catch (_) {
          // ignore, onError will advance
        }
      }
    };
    fetchSigned();
    return () => { cancelled = true; };
  }, [currentKey, cid, signedUrl]);

  return (
    currentSrc ? (
      <Image
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        onError={() => {
          if (currentIndex < sources.length - 1) setCurrentIndex((i) => i + 1);
        }}
      />
    ) : (
      <div className={className} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="h-6 w-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    )
  );
}
