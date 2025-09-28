# Favr App - Complete System Flowchart

## Main User Journey & System Architecture

```mermaid
flowchart TD
    %% User Entry Points
    A[User Opens Favr App] --> B{First Time User?}
    B -->|Yes| C[Landing Page]
    B -->|No| D{Authenticated?}
    
    %% Authentication Flow
    C --> E[Sign Up / Sign In]
    E --> F[Complete Onboarding]
    F --> G[Age Verification 18+]
    G --> H[Country Selection]
    H --> I[Location Permission]
    I --> J[Notification Permission]
    
    %% Main App Flow
    D -->|Yes| K[Home Dashboard]
    D -->|No| E
    J --> K
    
    %% Core Features
    K --> L{User Action}
    L -->|Browse Favors| M[Explore Page]
    L -->|Post Favor| N[Create Favor Form]
    L -->|View Profile| O[User Profile]
    L -->|Check Messages| P[Chat List]
    
    %% Favor Discovery & Interaction
    M --> Q[Location-Based Search]
    Q --> R[Display Nearby Favors]
    R --> S{User Selects Favor}
    S --> T[Favor Detail Page]
    T --> U{User Decision}
    U -->|Accept Favor| V[Create Chat Room]
    U -->|Bookmark| W[Save to Bookmarks]
    U -->|Like| X[Add to Likes]
    
    %% Favor Creation Flow
    N --> Y[AI Content Moderation]
    Y -->|Approved| Z[Save to Database]
    Y -->|Rejected| AA[Show Moderation Message]
    Z --> BB[Notify Nearby Users]
    BB --> CC[Push Notifications Sent]
    
    %% Chat & Communication
    V --> DD[Real-time Chat Interface]
    DD --> EE[WebSocket Connection]
    EE --> FF{Message Type}
    FF -->|Text Message| GG[AI Moderation Check]
    FF -->|System Message| HH[Direct Delivery]
    GG -->|Approved| II[Store & Broadcast Message]
    GG -->|Blocked| JJ[Show Moderation Warning]
    II --> KK[Push Notification to Recipient]
    
    %% Favor Completion Flow
    DD --> LL{Favor Status}
    LL -->|In Progress| MM[Continue Chat]
    LL -->|Ready to Complete| NN[Requester Marks Complete]
    NN --> OO[Rating Exchange]
    OO --> PP[Update User Stats]
    PP --> QQ[Award Favr Points]
    QQ --> RR[Close Chat Room]
    
    %% Notification System
    CC --> SS{Device Type}
    KK --> SS
    SS -->|iOS| TT[OneSignal Notification]
    SS -->|Android/Desktop| UU[Web Push Notification]
    TT --> VV[User Receives Notification]
    UU --> VV
    VV --> WW{User Clicks Notification}
    WW -->|Yes| XX[Navigate to Relevant Page]
    WW -->|No| YY[Background Processing]
    
    %% Location Services
    I --> ZZ[Location Service Active]
    ZZ --> AAA[Continuous Location Updates]
    AAA --> BBB[Nearby Favor Matching]
    BBB --> CCC[Real-time Notifications]
    
    %% Profile Management
    O --> DDD[View Profile Stats]
    DDD --> EEE{Profile Action}
    EEE -->|Edit Profile| FFF[Edit Profile Form]
    EEE -->|View Favors| GGG[Posted & Completed Favors]
    EEE -->|Settings| HHH[Notification Settings]
    FFF --> III[Update Profile Data]
    
    %% Error Handling & Moderation
    AA --> JJJ[User Can Modify & Resubmit]
    JJ --> KKK[User Can Rephrase Message]
    
    %% Analytics & Reporting
    PP --> LLL[Analytics Collection]
    LLL --> MMM[Investor Dashboard]
    MMM --> NNN[Demographics & Usage Stats]
    
    %% Style Classes
    classDef userAction fill:#e1f5fe
    classDef systemProcess fill:#f3e5f5
    classDef notification fill:#fff3e0
    classDef moderation fill:#ffebee
    classDef database fill:#e8f5e8
    
    class A,C,E,K,M,N,O,P userAction
    class Y,GG,BB,EE,ZZ,LLL systemProcess
    class CC,KK,TT,UU,VV notification
    class AA,JJ,JJJ,KKK moderation
    class Z,II,PP,III database
```

## Detailed Component Interaction Flow

```mermaid
flowchart LR
    %% Frontend Components
    subgraph "Frontend (React PWA)"
        A1[Landing Page]
        A2[Home Dashboard]
        A3[Explore Page]
        A4[Chat Interface]
        A5[User Profile]
        A6[Favor Detail]
        A7[Create Favor]
    end
    
    %% Backend Services
    subgraph "Backend Services"
        B1[Express API Server]
        B2[WebSocket Chat Service]
        B3[Notification Service]
        B4[AI Moderation Service]
        B5[Location Service]
        B6[Storage Service]
    end
    
    %% External Services
    subgraph "External Services"
        C1[PostgreSQL Database]
        C2[OneSignal iOS]
        C3[Web Push VAPID]
        C4[OpenAI API]
        C5[Mapbox Geocoding]
        C6[Neon Database]
    end
    
    %% Data Flow Connections
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B2
    A5 --> B1
    A6 --> B1
    A7 --> B1
    
    B1 --> B6
    B2 --> B6
    B3 --> C2
    B3 --> C3
    B4 --> C4
    B5 --> C5
    B6 --> C1
    B6 --> C6
    
    %% Real-time Connections
    A4 -.->|WebSocket| B2
    B2 -.->|Real-time| A4
    B3 -.->|Push| A1
    B3 -.->|Push| A2
```

## Notification System Architecture

```mermaid
flowchart TD
    A[User Action Triggers Notification] --> B{Device Detection}
    
    B -->|iOS Safari/PWA| C[OneSignal Service]
    B -->|Android/Desktop| D[Web Push Service]
    
    C --> E[OneSignal API]
    D --> F[VAPID Web Push]
    
    E --> G[Apple Push Notification Service]
    F --> H[Browser Push Service]
    
    G --> I[iOS Device]
    H --> J[Android/Desktop Device]
    
    I --> K[User Sees Notification]
    J --> K
    
    K --> L{User Interaction}
    L -->|Click| M[Navigate to App]
    L -->|Dismiss| N[Background Processing]
    
    M --> O[Update Notification Status]
    N --> P[Mark as Delivered]
```

## Database Schema Relationships

```mermaid
erDiagram
    USERS ||--o{ FAVORS : posts
    USERS ||--o{ RATINGS : gives
    USERS ||--o{ BOOKMARKS : creates
    USERS ||--o{ LIKES : makes
    USERS ||--o{ FAVR_POINTS_HISTORY : earns
    USERS ||--o{ NOTIFICATION_SUBSCRIPTIONS : has
    
    FAVORS ||--o{ RATINGS : receives
    FAVORS ||--o{ BOOKMARKS : bookmarked_in
    FAVORS ||--o{ LIKES : liked_in
    FAVORS ||--o{ CHAT_ROOMS : creates
    
    CHAT_ROOMS ||--o{ CHAT_MESSAGES : contains
    
    USERS {
        int id PK
        string firstName
        string lastName
        string email
        string password
        string profilePicture
        string bio
        string country
        date dateOfBirth
        int favrPoints
        int completedFavrs
        decimal averageRating
        int totalRatings
        timestamp memberSince
        boolean isVerified
        boolean notificationsEnabled
    }
    
    FAVORS {
        int id PK
        string title
        string description
        string category
        string price
        boolean isNegotiable
        string imageUrl
        string latitude
        string longitude
        string address
        string timeframe
        string status
        string posterId FK
        int helperId FK
        timestamp createdAt
    }
    
    CHAT_ROOMS {
        int id PK
        int favorId FK
        string requesterId FK
        string helperId FK
        boolean isActive
        timestamp createdAt
    }
    
    CHAT_MESSAGES {
        string id PK
        int chatRoomId FK
        string senderId FK
        string recipientId FK
        string content
        string messageType
        string status
        timestamp createdAt
    }
```

## Security & Moderation Flow

```mermaid
flowchart TD
    A[User Submits Content] --> B{Content Type}
    
    B -->|Favor Post| C[AI Moderation - Favor]
    B -->|Chat Message| D[AI Moderation - Message]
    
    C --> E{Moderation Result}
    D --> E
    
    E -->|Approved| F[Store in Database]
    E -->|Flagged| G[Block & Show Warning]
    E -->|Needs Review| H[Queue for Manual Review]
    
    F --> I[Notify Relevant Users]
    G --> J[User Can Edit & Resubmit]
    H --> K[Admin Review Process]
    
    I --> L[Push Notifications Sent]
    J --> A
    K --> M{Admin Decision}
    
    M -->|Approve| F
    M -->|Reject| G
    M -->|Ban User| N[Account Suspension]
```

This comprehensive flowchart shows:

1. **User Journey**: From onboarding to favor completion
2. **System Architecture**: How frontend, backend, and external services interact
3. **Real-time Features**: WebSocket chat and push notifications
4. **Database Relationships**: How data is structured and connected
5. **Security Flow**: AI moderation and content filtering
6. **Notification System**: Multi-platform push notification delivery

The app follows a modern PWA architecture with real-time capabilities, location-based matching, and comprehensive safety features through AI moderation.