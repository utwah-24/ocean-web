# Messaging API Documentation

## Overview
The messaging feature provides real-time chat functionality between users in the Ocean app. It includes REST API endpoints for managing conversations and messages, as well as WebSocket connections for real-time message delivery and updates.

## Base Configuration

### Environment Variables
- `API_BASE_URL`: Base URL for REST API endpoints (e.g., `https://sagenashi.com/api/v3`)
- `PUSHER_HOST`: WebSocket server host (default: `10.22.229.207`)
- `PUSHER_PORT`: WebSocket server port (default: `6001`)
- `PUSHER_KEY`: WebSocket app key (default: `local`)
- `APP_STORAGE_URL`: Base URL for file storage (for message attachments)

### Authentication
All REST API endpoints require Bearer token authentication:
```
Authorization: Bearer {token}
```

The token is retrieved from `SharedPreferences` with key `'token'`.

---

## REST API Endpoints

### 1. Get User Conversations

Retrieves all conversations for a specific user.

**Endpoint:** `GET /chat/conversations/{userId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
- `userId` (integer, required): The ID of the user whose conversations to retrieve

**Response (200/201 OK):**

The API can return data in two formats:

**Format 1: Nested data structure**
```json
{
  "data": [
    {
      "id": 1,
      "participants": [
        {
          "id": 1,
          "name": "John Doe",
          "phone": "255123456789",
          "email": "john@example.com"
        },
        {
          "id": 2,
          "name": "Jane Smith",
          "phone": "255987654321",
          "email": "jane@example.com"
        }
      ],
      "last_message": {
        "id": 100,
        "content": "Hello!",
        "created_at": "2025-01-01T12:00:00Z",
        "sender_id": 1
      },
      "is_read": false,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T12:00:00Z"
    }
  ]
}
```

**Format 2: Direct list**
```json
[
  {
    "id": 1,
    "participants": [...],
    "last_message": {...},
    "is_read": false
  }
]
```

**Processed Response:**
The client processes the response and adds:
- `other_user`: The participant who is not the current user
- `participants`: List of all participants
- `is_read`: Boolean indicating if the conversation has been read

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `500 Internal Server Error`: Server error

---

### 2. Get Conversation Messages

Retrieves all messages for a specific conversation.

**Endpoint:** `GET /chat/conversations/{conversationId}/messages/{userId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
- `conversationId` (integer, required): The ID of the conversation
- `userId` (integer, required): The ID of the user requesting messages

**Response (200/201 OK):**

**Format 1: Nested data structure**
```json
{
  "data": [
    {
      "id": 1,
      "conversation_id": 1,
      "sender_id": 1,
      "content": "Hello!",
      "file": null,
      "file_type": null,
      "file_name": null,
      "created_at": "2025-01-01T12:00:00Z",
      "is_read": true,
      "sender": {
        "id": 1,
        "name": "John Doe",
        "phone": "255123456789"
      }
    },
    {
      "id": 2,
      "conversation_id": 1,
      "sender_id": 2,
      "content": "Hi there!",
      "file": "storage/messages/file_123.jpg",
      "file_type": "image/jpeg",
      "file_name": "photo.jpg",
      "created_at": "2025-01-01T12:05:00Z",
      "is_read": false,
      "sender": {
        "id": 2,
        "name": "Jane Smith",
        "phone": "255987654321"
      }
    }
  ]
}
```

**Format 2: Direct list**
```json
[
  {
    "id": 1,
    "conversation_id": 1,
    "sender_id": 1,
    "content": "Hello!",
    "created_at": "2025-01-01T12:00:00Z",
    "is_read": true
  }
]
```

**Message Object Structure:**
```typescript
{
  id: number;                    // Message ID
  conversation_id: number;       // Conversation ID
  sender_id: number;             // Sender user ID
  content: string;               // Message text content
  file?: string | null;          // File URL (if attachment exists)
  file_type?: string | null;     // MIME type (e.g., "image/jpeg", "video/mp4")
  file_name?: string | null;     // Original filename
  created_at: string;            // ISO 8601 timestamp
  is_read: boolean;              // Read status
  sender?: {                     // Sender user object (optional)
    id: number;
    name: string;
    phone: string;
    email?: string;
  }
}
```

**File URL Processing:**
- If `file` doesn't start with `http`, it's prepended with `APP_STORAGE_URL`
- Format: `{APP_STORAGE_URL}/{file.replaceFirst('storage/', '')}`

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `404 Not Found`: Conversation not found or user doesn't have access
- `500 Internal Server Error`: Server error

---

### 3. Send Message

Sends a new message to a conversation. Supports text messages and file attachments.

**Endpoint:** `POST /chat/send/{conversationId}`

**Headers:**
```
Authorization: Bearer {token}
Accept: application/json
Content-Type: multipart/form-data
```

**Path Parameters:**
- `conversationId` (integer, required): The ID of the conversation

**Request Body (multipart/form-data):**
- `sender_id` (string, required): The ID of the message sender
- `content` (string, required): The message text content
- `file` (file, optional): File attachment (image, video, document, etc.)

**Example Request:**
```
POST /chat/send/1
Authorization: Bearer {token}
Content-Type: multipart/form-data

sender_id: 1
content: Hello, this is a message!
file: [binary file data]
```

**Response (200/201 OK):**
```json
{
  "data": {
    "id": 101,
    "conversation_id": 1,
    "sender_id": 1,
    "content": "Hello, this is a message!",
    "file": "storage/messages/file_123.jpg",
    "file_type": "image/jpeg",
    "file_name": "photo.jpg",
    "created_at": "2025-01-01T12:30:00Z",
    "is_read": false,
    "sender": {
      "id": 1,
      "name": "John Doe"
    }
  }
}
```

**Response Processing:**
- The client parses the response and ensures `id`, `conversation_id`, and `sender_id` are integers
- Returns a `Message` object

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `400 Bad Request`: Invalid request data (missing sender_id or content)
- `404 Not Found`: Conversation not found
- `500 Internal Server Error`: Server error

---

### 4. Mark Messages as Read

Marks all messages in a conversation as read for a specific user.

**Endpoint:** `POST /chat/conversations/{conversationId}/read/{userId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
- `conversationId` (integer, required): The ID of the conversation
- `userId` (integer, required): The ID of the user marking messages as read

**Request Body:**
None (userId is in the URL path)

**Response (200/201 OK):**
```json
{
  "status": "success",
  "message": "Messages marked as read"
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `404 Not Found`: Conversation not found
- `500 Internal Server Error`: Server error

---

### 5. Create Conversation

Creates a new conversation between two users. If a conversation already exists, it may return the existing conversation.

**Endpoint:** `POST /chat/conversation`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "sender_id": 1,
  "receiver_id": 2
}
```

**Request Parameters:**
- `sender_id` (integer, required): The ID of the user initiating the conversation
- `receiver_id` (integer, required): The ID of the other participant

**Response (200/201 OK):**
```json
{
  "data": {
    "conversation_id": 1,
    "id": 1,
    "sender_id": 1,
    "receiver_id": 2,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Alternative Response Structure:**
```json
{
  "id": 1,
  "sender_id": 1,
  "receiver_id": 2,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `400 Bad Request`: Invalid request data
- `500 Internal Server Error`: Server error

**Error Response Format:**
```json
{
  "status": "error",
  "message": "Error description",
  "code": 400
}
```

---

### 6. Delete Message

Deletes a specific message from a conversation.

**Endpoint:** `DELETE /chat/messages/{messageId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
- `messageId` (integer, required): The ID of the message to delete

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Message deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `403 Forbidden`: User doesn't have permission to delete this message
- `404 Not Found`: Message not found
- `500 Internal Server Error`: Server error

---

### 7. Delete Conversation

Deletes a conversation for a specific user. This may be a soft delete (hides conversation from user) or hard delete depending on backend implementation.

**Endpoint:** `DELETE /chat/conversations/{conversationId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
- `conversationId` (integer, required): The ID of the conversation to delete

**Request Body:**
```json
{
  "user_id": 1
}
```

**Request Parameters:**
- `user_id` (integer, required): The ID of the user deleting the conversation

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Conversation deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication token is missing or invalid
- `404 Not Found`: Conversation not found
- `500 Internal Server Error`: Server error

---

## WebSocket API

The messaging feature uses WebSocket connections for real-time message delivery and conversation updates. The WebSocket implementation follows a Pusher-compatible protocol.

### WebSocket Connection

**Connection URL:**
```
ws://{PUSHER_HOST}:{PUSHER_PORT}/app/{PUSHER_KEY}
```

**Example:**
```
ws://10.22.229.207:6001/app/local
```

### Connection Methods

#### 1. Connect to Conversation Chat

Connects to a specific conversation channel for real-time message updates.

**Method:** `connectToChat(conversationId)`

**Channel Subscription:**
After connecting, subscribe to the conversation channel:
```json
{
  "event": "pusher:subscribe",
  "data": {
    "channel": "chat.{conversationId}"
  }
}
```

**Example:**
```json
{
  "event": "pusher:subscribe",
  "data": {
    "channel": "chat.1"
  }
}
```

**Events Received:**
- New messages in the conversation
- Message read receipts
- Typing indicators (if implemented)
- Message updates/deletions

---

#### 2. Connect to User Conversations Updates

Connects to a user-specific channel for conversation list updates (new conversations, conversation updates, etc.).

**Method:** `connectToConversationsUpdates(userId)`

**Channel Subscription:**
After connecting, subscribe to the user's conversation channel:
```json
{
  "event": "pusher:subscribe",
  "data": {
    "channel": "chat.{userId}"
  }
}
```

**Example:**
```json
{
  "event": "pusher:subscribe",
  "data": {
    "channel": "chat.1"
  }
}
```

**Events Received:**
- New conversation created
- Conversation updates
- New messages in any conversation
- Conversation deleted

---

### WebSocket Message Format

**Incoming Messages:**
```json
{
  "event": "message.sent",
  "channel": "chat.1",
  "data": {
    "id": 101,
    "conversation_id": 1,
    "sender_id": 2,
    "content": "New message!",
    "created_at": "2025-01-01T12:30:00Z",
    "is_read": false
  }
}
```

**Typing Indicator (if implemented):**
```json
{
  "event": "typing",
  "channel": "chat.1",
  "data": {
    "user_id": 2,
    "is_typing": true
  }
}
```

**Message Read Receipt:**
```json
{
  "event": "message.read",
  "channel": "chat.1",
  "data": {
    "conversation_id": 1,
    "user_id": 2,
    "read_at": "2025-01-01T12:35:00Z"
  }
}
```

---

## Data Models

### Message Model

```dart
class Message {
  final int id;
  final int conversationId;
  final int senderId;
  final String content;
  final String? file;              // File URL
  final String? fileType;          // MIME type
  final String? fileName;          // Original filename
  final DateTime createdAt;
  final bool isRead;
  final Map<String, dynamic>? sender;  // Sender user object
  MessageStatus status;            // sent, delivered, read
}
```

**Message Status Enum:**
```dart
enum MessageStatus {
  sent,      // Message sent but not delivered
  delivered, // Message delivered but not read
  read       // Message read by recipient
}
```

**Helper Properties:**
- `hasFile`: Returns `true` if message has a file attachment
- `isImage`: Returns `true` if file is an image
- `isVideo`: Returns `true` if file is a video

**File Handling:**
- Files are cached locally using `flutter_cache_manager`
- Local file path can be retrieved via `getLocalFilePath()`

---

### Conversation Model

```dart
{
  "id": 1,
  "participants": [
    {
      "id": 1,
      "name": "John Doe",
      "phone": "255123456789",
      "email": "john@example.com"
    }
  ],
  "other_user": {              // Added by client
    "id": 2,
    "name": "Jane Smith"
  },
  "last_message": {
    "id": 100,
    "content": "Hello!",
    "created_at": "2025-01-01T12:00:00Z",
    "sender_id": 1
  },
  "is_read": false,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "status": "error",
  "message": "Error description",
  "code": 400
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or token expired
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `500 Internal Server Error`: Server error

### Client-Side Error Handling

The client handles errors as follows:

1. **Authentication Errors (401):**
   - Throws exception: `"Unauthorized. Please check your authentication token."`
   - User should be prompted to re-authenticate

2. **Network Errors:**
   - Throws exception with error message
   - User should be notified of connection issues

3. **Parsing Errors:**
   - Throws exception: `"Failed to parse server response"`
   - Logs the raw response for debugging

---

## File Attachments

### Supported File Types

The messaging system supports various file types:
- **Images**: JPEG, PNG, GIF, WebP, etc.
- **Videos**: MP4, MOV, AVI, etc.
- **Documents**: PDF, DOC, DOCX, etc.
- **Other**: Any file type can be attached

### File Upload Process

1. User selects a file
2. File is sent as `multipart/form-data` with the message
3. Server stores the file and returns the file URL
4. File URL is included in the message response
5. Client caches the file locally for offline access

### File URL Format

- **Relative URL**: `storage/messages/file_123.jpg`
- **Full URL**: `{APP_STORAGE_URL}/messages/file_123.jpg`

The client automatically converts relative URLs to full URLs using `APP_STORAGE_URL`.

---

## Best Practices

### 1. Authentication
- Always include the Bearer token in the Authorization header
- Handle token expiration gracefully
- Re-authenticate when receiving 401 errors

### 2. Real-time Updates
- Use WebSocket connections for real-time message delivery
- Subscribe to conversation channels when viewing a conversation
- Subscribe to user channels for conversation list updates
- Handle WebSocket disconnections and reconnect automatically

### 3. Message Loading
- Load messages in batches/pages for better performance
- Cache messages locally for offline access
- Update message read status when user views conversation

### 4. File Handling
- Cache files locally to reduce bandwidth usage
- Show loading indicators while files are being uploaded
- Handle file upload errors gracefully

### 5. Error Handling
- Always check response status codes
- Provide user-friendly error messages
- Log errors for debugging purposes

---

## Implementation Notes

### Response Structure Flexibility

The API can return data in two formats:
1. **Nested structure**: `{ "data": [...] }`
2. **Direct list**: `[...]`

The client handles both formats automatically.

### Date Format

All timestamps are in ISO 8601 format:
- Format: `YYYY-MM-DDTHH:mm:ssZ`
- Example: `2025-01-01T12:00:00Z`
- Client converts to local time automatically

### User ID in URLs

Some endpoints include `userId` in the URL path for:
- Security: Ensures user can only access their own data
- Filtering: Server can filter results based on user
- Authorization: Server can verify user permissions

---

## Example Usage Flow

### 1. Creating a New Conversation

```dart
// Step 1: Create conversation
final conversation = await chatService.createConversation(
  senderId: currentUserId,
  receiverId: otherUserId,
);

final conversationId = conversation['data']['conversation_id'] ?? 
                       conversation['id'];

// Step 2: Connect to WebSocket for real-time updates
final wsChannel = await chatService.connectToChat(conversationId);

// Step 3: Load existing messages
final messages = await chatService.getConversationMessages(
  conversationId, 
  currentUserId
);

// Step 4: Send first message
final message = await chatService.sendMessage(
  conversationId: conversationId,
  senderId: currentUserId,
  content: "Hello!",
);
```

### 2. Sending a Message with File

```dart
final file = File('/path/to/image.jpg');

final message = await chatService.sendMessage(
  conversationId: conversationId,
  senderId: currentUserId,
  content: "Check out this image!",
  file: file,
);
```

### 3. Marking Messages as Read

```dart
await chatService.markMessagesAsRead(
  conversationId, 
  currentUserId
);
```

### 4. Listening for Real-time Messages

```dart
final wsChannel = await chatService.connectToChat(conversationId);

wsChannel.stream.listen((message) {
  final data = json.decode(message);
  
  if (data['event'] == 'message.sent') {
    final messageData = json.decode(data['data']);
    final newMessage = Message.fromJson(messageData);
    // Add message to UI
  }
});
```

---

## Testing

### Test Endpoints

Use the following test scenarios:

1. **Create Conversation:**
   - Test with valid user IDs
   - Test with non-existent user IDs
   - Test creating duplicate conversation

2. **Send Message:**
   - Test text-only message
   - Test message with image attachment
   - Test message with video attachment
   - Test message with document attachment

3. **Get Messages:**
   - Test with valid conversation ID
   - Test with invalid conversation ID
   - Test with unauthorized user

4. **WebSocket:**
   - Test connection establishment
   - Test message delivery
   - Test connection reconnection

---

## Version History

- **v1.0**: Initial messaging API implementation
- Supports text messages and file attachments
- Real-time updates via WebSocket
- Conversation and message management

---

*Last Updated: January 2025*
