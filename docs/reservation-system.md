# NFT Reservation System Documentation

## Overview

The NFT Reservation System is designed to prevent race conditions and ensure fair distribution of NFTs during minting. It reserves random NFTs for a limited time (10 minutes) to ensure that users can complete their purchases without conflicts.

## System Components

### Database Tables

1. **reservation_tokens**
   - Stores reservation sessions with expiration times
   - Tracks buyer information and reservation quantities

2. **nft_reservations**
   - Links reserved items to reservation tokens
   - Tracks confirmation status of reservations

### Database Functions

1. **reserve_nfts**
   - Reserves a specified quantity of random unminted NFTs for a buyer
   - Creates a 10-minute reservation window
   - Returns reservation token and reserved item details

2. **confirm_reservation**
   - Confirms a reservation after successful payment
   - Marks reserved items as minted
   - Expires the reservation token immediately

3. **release_expired_reservations**
   - Releases reservations that have expired (older than 10 minutes)
   - Makes items available for other users

## Workflow

### 1. Reservation Phase

```sql
SELECT * FROM reserve_nfts(
  p_collection_id := 'collection-uuid',
  p_buyer_wallet := 'buyer-wallet-address',
  p_quantity := 2
);
```

This returns:
- Reservation token
- Reserved item IDs and names
- Success status and message

### 2. Payment Processing

The client processes the payment using the reservation token to ensure the same items are minted.

### 3. Confirmation Phase

```sql
SELECT * FROM confirm_reservation(
  p_reservation_token := 'reservation-token',
  p_transaction_signature := 'transaction-signature'
);
```

This:
- Marks items as minted
- Links items to the buyer
- Expires the reservation

### 4. Expiration Handling

Expired reservations are automatically released:
```sql
SELECT * FROM release_expired_reservations();
```

## Application Layer Usage

### Reserving NFTs

```typescript
const reservationResult = await SupabaseService.reserveNFTs(
  collectionId,
  buyerWallet,
  quantity,
  optionalReservationToken
);
```

### Confirming Reservations

```typescript
const confirmResult = await SupabaseService.confirmReservation(
  reservationToken,
  transactionSignature
);
```

### Releasing Expired Reservations

```typescript
const releaseResult = await SupabaseService.releaseExpiredReservations();
```

## Error Handling

The system handles several error cases:

1. **Insufficient NFTs**: Returns error when not enough unminted items are available
2. **Expired Reservations**: Automatically releases expired reservations
3. **Database Conflicts**: Uses atomic operations to prevent race conditions
4. **Network Issues**: Includes retry logic for blockchain operations

## Testing

### Database Tests

Run `test/database-reservation-test.sql` to verify:
- Table creation and structure
- Function existence and operation
- Reservation flow from start to finish

### Application Tests

Run `test/app-reservation-test.ts` to verify:
- Application layer integration
- Error handling
- Reservation lifecycle management

## Maintenance

### Regular Cleanup

The system should regularly run `release_expired_reservations()` to clean up expired reservations.

### Monitoring

Monitor:
- Reservation success rates
- Expiration rates
- Database performance
- Blockchain confirmation times

## Security Considerations

1. **Reservation Tokens**: Generated as UUIDs to prevent guessing
2. **Expiration**: 10-minute window prevents indefinite holding
3. **Atomic Operations**: Database functions use transactions to ensure consistency
4. **Idempotency**: Operations can be safely retried without side effects