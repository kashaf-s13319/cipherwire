# Security Specification: CipherWire Real-Time Messaging

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be read, created, or modified by the authenticated user whose `request.auth.uid == userId`.
2. **PII Isolation Invariant**: PII (`email`, `privacySettings`) in `/users/{userId}` is strictly private. Only the user themselves can read or write their user document.
3. **Public Profile Invariant**: `/publicProfiles/{userId}` can only be written by `request.auth.uid == userId`. Any signed-in user can read public profiles to obtain display names and E2EE public keys.
4. **Anti-Scraping Email Invariant**: `/emailLookups/{lookupKey}` forbids `allow list: if false;`. Only direct point queries `allow get` are permitted to prevent collection dumping or email directory scraping.
5. **Friend Request Integrity**:
   - `fromUid` must match `request.auth.uid`.
   - Users cannot send friend requests to themselves (`fromUid != toUid`).
   - Only the sender or recipient can view or update a friend request.
   - Status transitions can only be: pending -> accepted / rejected / cancelled.
6. **Conversation Membership Invariant**:
   - Access to `/conversations/{conversationId}` and messages at `/conversations/{conversationId}/messages/{messageId}` is strictly restricted to participants whose UID is in `participantUids`.
   - Messages can only be created with `senderId == request.auth.uid`.
   - Plaintext messages are rejected; `ciphertext` and `iv` fields must be present and bounded.
7. **Temporal & Key Integrity**:
   - `createdAt` is immutable and cannot be rewritten on updates.
   - IDs must conform to `^[a-zA-Z0-9_\\-]+$` and size <= 128.
   - Document sizes, string lengths, and payload boundaries are strictly enforced.

---

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Payload 1: Impersonated Profile Creation**
   - User `attacker_123` tries to create `/users/victim_456` with victim's UID.
2. **Payload 2: Email Scraping via Collection List**
   - User tries to run `list` query on `/emailLookups` without specific docId.
3. **Payload 3: Self-Targeted Friend Request**
   - User `user_1` attempts to create friend request to themselves (`fromUid == "user_1" && toUid == "user_1"`).
4. **Payload 4: Third-Party Friend Request Spoofing**
   - User `attacker_123` sends friend request claiming `fromUid: "alice_456"`.
5. **Payload 5: Unauthorized Conversation Eavesdropping**
   - User `attacker_123` attempts to read `/conversations/alice_bob/messages/{msgId}` when neither sender nor recipient.
6. **Payload 6: Message Sender Forgery**
   - User `attacker_123` writes message to conversation with `senderId: "alice_456"`.
7. **Payload 7: Unbounded Payload Flood Attack**
   - Attacker attempts to post a message with `ciphertext` exceeding 65,536 characters.
8. **Payload 8: Path Traversal / Poisoned ID**
   - Attacker attempts to write to `/conversations/../../system_config`.
9. **Payload 9: Ghost Field Injection (Anti-Update-Gap)**
   - Attacker updates public profile with unexpected privilege field `{ isAdmin: true, role: "superuser" }`.
10. **Payload 10: Status Reversal Attack**
    - Recipient attempts to update an already accepted/cancelled friend request back to pending.
11. **Payload 11: Unauthenticated Read**
    - Unauthenticated client attempts to query any message or user profile.
12. **Payload 12: Friendship Forgery**
    - Attacker attempts to inject `/friends/{friendshipId}` between two users without an accepted friend request or where attacker is not a member.
