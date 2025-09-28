# Favr - Favor Exchange Platform

## Overview

Favr is a full-stack web application designed to connect users within their local community for favor exchange. It allows users to post and discover services, incorporating location-based discovery, pricing, and time management features. The platform aims to facilitate community engagement by enabling individuals to offer and request assistance, fostering a collaborative environment.

## User Preferences

Preferred communication style: Simple, everyday language.
Company incorporation: Ireland (Stripe payments required)
Critical requirements: Perfect push notifications, Favr Points system, profile editing, accurate location display

## System Architecture

The application adopts a monorepo structure, separating client and server concerns.

### Technical Stack
- **Frontend**: React 18 (TypeScript, Vite, Shadcn/ui, Tailwind CSS, TanStack Query, Wouter)
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Drizzle ORM)

### Key Architectural Decisions
- **Component-based Frontend**: Utilizes React for a modular and type-safe UI.
- **RESTful API**: Express.js handles server-side logic and data exposure.
- **Type-safe Database Operations**: Drizzle ORM ensures robust interaction with PostgreSQL.
- **Efficient Data Management**: TanStack Query manages server state, caching, and synchronization.
- **Responsive Design**: Mobile-first approach with custom color schemes and dual view modes (list/map) for favor discovery.
- **Modular Backend**: Clear separation of concerns for routes, error handling, and middleware.
- **Real-time Communication**: WebSocket-based chat system for instant messaging between users.
- **Accessibility Compliance**: Adheres to WCAG 2.1 guidelines with features like keyboard navigation, screen reader support, high contrast mode, and font scaling.
- **Gamification**: Implements a Favr Points system with user levels and achievement badges.
- **Secure Transactions**: Escrow payment service with wallet management and transparent fee calculation.
- **AI Integration**: Leverages OpenAI for smart favor generation and context-aware suggestions.
- **Global Location Services**: MapBox GL JS for interactive maps and worldwide geocoding with proximity prioritization.

### Core Features
- **Favor Discovery**: Browse favors in list or map view with category filtering.
- **Favor Creation**: Multi-step form for posting new favors with image upload.
- **User Profiles**: Comprehensive profiles displaying posted/completed favors, statistics, and achievement badges.
- **Messaging**: Real-time chat system with typing indicators and message status.
- **Notifications**: Multi-channel push notifications for favor updates and new messages with database persistence.
- **Payment System**: Secure escrow for transactions.
- **Microinteractions**: Enhanced user engagement through animations and interactive UI elements.
- **Demographic Collection**: Collects user age and country during account creation for investor insights.

## Critical Fixes (August 3, 2025)
- **Message Notifications**: ✅ IMPLEMENTED - Real-time push notifications when users receive chat messages from others
- **Cross-User Notifications**: ✅ FIXED - All users can now receive notifications from any other user, not just test accounts
- **Service Worker Auto-Update**: ✅ IMPLEMENTED - Automatic service worker updates every 30 seconds to prevent iOS PWA cache issues
- **User Location Tracking**: ✅ ENHANCED - Improved user identification system for location-based notifications
- **PWA Logo Consistency**: ✅ FIXED - Reverted to single PNG logo file to prevent iOS "F" fallback issue
- **Notification Cross-Compatibility**: ✅ VERIFIED - Notifications work between all users regardless of account type
- **Chat Integration**: ✅ ENHANCED - Push notifications integrated with WebSocket chat system for offline users
- **Notification Status API**: ✅ FIXED - Storage method bug that prevented detection of existing browser subscriptions
- **Chat Messages Endpoint**: ✅ ADDED - Missing REST API endpoint for fetching chat message history
- **Mobile Keyboard Issue**: ✅ FIXED - Added autocomplete attributes to prevent password input suggestions
- **Profile Notification Button**: ✅ VERIFIED - Properly connected to browser notification permission system

## System Status
- **Core Functionality**: All major features working correctly including delete favors
- **Push Notifications**: Complete cross-user notification system operational on all devices
- **Message Notifications**: Real-time notifications for chat messages between all users
- **Service Worker**: Auto-updating system prevents iOS PWA reinstall requirements
- **Cache Management**: Improved real-time updates with force refresh after mutations
- **Database Integration**: PostgreSQL with proper schema migrations and data persistence
- **User Authentication**: Secure favor management with proper ownership validation
- **Frontend**: Fully functional interface with no runtime errors
- **PWA Icons**: Consistent logo display across all iOS devices and contexts
- **Chat System**: ✅ FIXED - Messages load correctly via WebSocket with proper history
- **Notification Logic**: ✅ IMPROVED - Reduced prompt frequency for users with existing permissions
- **Profile Notification Button**: ✅ FIXED - Now sends real test notifications like the landing page
- **Unified Notification System**: ✅ IMPLEMENTED - Both landing page and profile buttons use same notification API
- **Favor Expiration Logic**: ✅ ENHANCED - Timeframe-based expiration (Flexible: 14 days, Weekly: 7 days, Urgent: 1 day)

## External Dependencies

- **@neondatabase/serverless**: PostgreSQL database connectivity.
- **drizzle-orm & drizzle-kit**: ORM for PostgreSQL.
- **@tanstack/react-query**: Server state management.
- **@radix-ui/components**: Accessible UI primitives.
- **multer**: File upload handling.
- **Vite**: Frontend build tool.
- **TypeScript**: Language for type safety.
- **Tailwind CSS**: Utility-first CSS framework.
- **ESBuild**: Backend bundler.
- **MapBox GL JS**: Interactive maps and geolocation.
- **Browser Geolocation API**: User location detection.
- **OpenAI**: AI-powered favor generation and suggestions.
- **Google Analytics (GA4)**: Website traffic and event tracking.