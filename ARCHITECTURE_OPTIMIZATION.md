# Architecture Optimization Plan

## Overview
This document outlines the architectural improvements made to optimize code organization, eliminate duplication, and improve maintainability.

## Issues Identified

### 1. Type Duplication
- **Problem**: `Opportunity` interface defined in 4 different files with variations
- **Impact**: Type inconsistencies, maintenance burden
- **Files**: `Dashboard.tsx`, `OpportunityDetail.tsx`, `useOpportunities.ts`, `OpportunityMap.tsx`

### 2. Code Duplication
- **Problem**: `calculateDistance` function duplicated in 3 places
- **Impact**: Code bloat, potential bugs if one copy is updated
- **Files**: `Dashboard.tsx`, `useOpportunities.ts`, `OpportunityMap.tsx`

### 3. No Service Layer
- **Problem**: Direct Supabase calls scattered throughout components
- **Impact**: Hard to test, maintain, and reuse logic
- **Files**: Multiple components making direct API calls

### 4. Large Components
- **Problem**: Components are too large (QASection: 900+ lines, Dashboard: 944+ lines)
- **Impact**: Hard to maintain, test, and understand
- **Files**: `QASection.tsx`, `Dashboard.tsx`

### 5. Mixed Concerns
- **Problem**: Components handle both data fetching and UI rendering
- **Impact**: Hard to test, reuse, and maintain

## Solutions Implemented

### 1. Shared Types (`src/types/index.ts`)
- Created centralized type definitions
- Eliminates duplication
- Ensures type consistency across the app
- Types exported:
  - `Opportunity`
  - `SavedOpportunity`
  - `Question`
  - `Answer`
  - `Review`
  - `UserLocation`
  - `PaginationOptions`
  - `SearchOptions`

### 2. Geolocation Utilities (`src/lib/geolocation.ts`)
- Centralized distance calculation
- Reusable location utilities
- Functions:
  - `calculateDistance()` - Haversine formula
  - `getUserLocation()` - Get user's current location
  - `calculateDistances()` - Batch distance calculation
  - `sortByDistance()` - Sort opportunities by distance

### 3. Service Layer (`src/services/`)
- Created service layer for API calls
- Separates data fetching from UI components
- Makes code more testable and reusable
- Services created:
  - `opportunities.ts` - Opportunity-related API calls
  - `savedOpportunities.ts` - Saved opportunities API calls

## Migration Guide

### Updating Components to Use Shared Types

**Before:**
```typescript
// In Dashboard.tsx
interface Opportunity {
  id: string;
  name: string;
  // ... duplicate definition
}
```

**After:**
```typescript
import { Opportunity } from "@/types";
```

### Updating Components to Use Geolocation Utilities

**Before:**
```typescript
// Duplicated in multiple files
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // ... implementation
}
```

**After:**
```typescript
import { calculateDistance, calculateDistances, sortByDistance } from "@/lib/geolocation";
```

### Updating Components to Use Service Layer

**Before:**
```typescript
// Direct Supabase call in component
const { data, error } = await supabase
  .from("opportunities_with_ratings")
  .select("*");
```

**After:**
```typescript
import { fetchOpportunities } from "@/services/opportunities";

const { data, error } = await fetchOpportunities({
  filterType: "hospital",
  searchTerm: "New York",
});
```

## Benefits

1. **Reduced Duplication**: Single source of truth for types and utilities
2. **Better Maintainability**: Changes in one place propagate everywhere
3. **Improved Testability**: Service layer can be easily mocked
4. **Type Safety**: Consistent types prevent bugs
5. **Code Reusability**: Utilities and services can be reused across components
6. **Separation of Concerns**: Data fetching separated from UI rendering

## Next Steps

1. **Migrate Existing Components**: Update all components to use shared types and services
2. **Create More Services**: Extract more API calls into service layer
3. **Split Large Components**: Break down QASection and Dashboard into smaller components
4. **Add Tests**: Write tests for service layer and utilities
5. **Documentation**: Add JSDoc comments to all exported functions

## Files to Update

### High Priority
- [ ] `src/hooks/useOpportunities.ts` - Use shared types and geolocation utils
- [ ] `src/pages/Dashboard.tsx` - Use shared types, geolocation utils, and services
- [ ] `src/pages/OpportunityDetail.tsx` - Use shared types and services
- [ ] `src/components/OpportunityMap.tsx` - Use shared types and geolocation utils

### Medium Priority
- [ ] `src/components/QASection.tsx` - Use shared types
- [ ] `src/components/ReviewsList.tsx` - Use shared types
- [ ] `src/components/ReviewForm.tsx` - Use shared types

### Low Priority
- [ ] Create more service files for Q&A, Reviews, etc.
- [ ] Split large components into smaller ones
- [ ] Add comprehensive tests

