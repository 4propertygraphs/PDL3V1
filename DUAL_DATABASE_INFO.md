# Dual Database Search System

## Overview

The application searches across **TWO Supabase databases** simultaneously and merges results.

**Actual Database Structure (confirmed via diagnostics):**
- DB1 (izuvblxr): `agency_list`, `listings`, `property_log`
- DB2 (ywmryhzp): `properties`, `agencies` (includes API keys!)

---

## Connected Databases

### Database 1: izuvblxr...supabase.co
- **URL**: https://izuvblxrwtmeiywwzufp.supabase.co
- **Key**: Set in `.env` as `VITE_SUPABASE_KEY_1`
- **Tables**: `agency_list`, `listings`, `property_log`
- **Purpose**: Aggregated/API layer with agency references

**Key Table: agency_list**
```
Columns: agency_id, agency_name, logo_url, agents, metadata, created_at, updated_at
```

### Database 2: ywmryhzp...supabase.co
- **URL**: https://ywmryhzpojfrmrxgggoy.supabase.co
- **Key**: Set in `.env` as `VITE_SUPABASE_KEY_2`
- **Tables**: `properties`, `agencies`
- **Purpose**: Main source database with all properties and agency details

**Key Table: agencies**
```
Columns: id, name, daft_api_key, myhome_api_key, myhome_group_id, ...
```

**Key Table: properties**
```
Columns: id, agency_id, agency_name, address, price, beds, baths, ...
```

---

## How It Works

### Search Flow: "Ray Maher Property Service"

```javascript
import { searchAgencyAcrossDatabases } from './services/dual-database-search';
import { supabase1, supabase2 } from './services/supabase';

const result = await searchAgencyAcrossDatabases(
  supabase1,
  supabase2,
  "Ray Maher Property Service"
);

// Returns:
{
  agencyName: "Ray Maher Property Service",
  db1: {
    agency: { agency_id, agency_name, logo_url, ... }
  },
  db2: {
    agency: { id, name, daft_api_key, myhome_api_key, ... },
    properties: [ {...}, {...}, ... ]
  },
  apiKeys: {
    source: 'database',  // or 'json'
    daftApiKey: 'd34826e68eaa5758...',
    myhomeApiKey: null,
    myhomeGroupId: null
  },
  summary: {
    foundInDb1: true,
    foundInDb2: true,
    propertiesCount: 15,
    hasApiKeys: true
  }
}
```

### Step-by-Step Process

1. **Search DB1 `agency_list`**
   - Finds agency by `agency_name`
   - Returns `agency_id`, `agency_name`, `logo_url`, etc.

2. **Search DB2 `agencies`**
   - Finds agency by `name`
   - Returns full agency details including API keys
   - `daft_api_key`, `myhome_api_key`, `myhome_group_id` are stored here!

3. **Get Properties from DB2**
   - First tries by `agency_id` (foreign key)
   - Falls back to `agency_name` search if needed
   - Returns all properties for that agency

4. **Merge API Keys**
   - Priority: DB2 `agencies` table (most authoritative)
   - Fallback: JSON file (`src/data/agencies.json`)
   - Returns combined result with source indicator

---

## Available Functions

### Basic Search Functions

```javascript
// DB1 Functions
import {
  getAgencyFromDB1,           // Search agency_list by name
  getAllAgenciesFromDB1,       // Get all agencies from DB1
  getListingsFromDB1           // Get listings (experimental)
} from './services/dual-database-search';

// DB2 Functions
import {
  getAgencyFromDB2,                    // Search agencies by name
  getPropertiesFromDB2ByAgencyName,    // Get properties by agency name
  getPropertiesFromDB2ByAgencyId,      // Get properties by agency ID
  getAllAgenciesFromDB2                // Get all agencies from DB2
} from './services/dual-database-search';
```

### Cross-Database Functions

```javascript
// Main search function
import { searchAgencyAcrossDatabases } from './services/dual-database-search';

const result = await searchAgencyAcrossDatabases(
  supabase1,
  supabase2,
  "Agency Name"
);

// Search by property ID
import { searchPropertyAndAgency } from './services/dual-database-search';

const result = await searchPropertyAndAgency(
  supabase1,
  supabase2,
  "property-uuid-123"
);

// List all agencies from both databases
import { listAllAgenciesWithData } from './services/dual-database-search';

const agencies = await listAllAgenciesWithData(supabase1, supabase2);
// Returns array of agencies with data from both DBs

// Get database summary
import { getDatabaseSummary } from './services/dual-database-search';

const summary = await getDatabaseSummary(supabase1, supabase2);
// Returns: { db1: {...}, db2: {...} }
```

---

## Usage Examples

### Example 1: Find Agency and All Its Properties

```javascript
import { supabase1, supabase2 } from './services/supabase';
import { searchAgencyAcrossDatabases } from './services/dual-database-search';

// Search for agency
const result = await searchAgencyAcrossDatabases(
  supabase1,
  supabase2,
  "Ray Maher"
);

console.log(`Agency found in DB1: ${result.summary.foundInDb1}`);
console.log(`Agency found in DB2: ${result.summary.foundInDb2}`);
console.log(`Properties: ${result.summary.propertiesCount}`);
console.log(`Has Daft API key: ${!!result.apiKeys.daftApiKey}`);
console.log(`API keys source: ${result.apiKeys.source}`);

// Access properties
const properties = result.db2.properties;
properties.forEach(prop => {
  console.log(`- ${prop.address}: €${prop.price}`);
});
```

### Example 2: List All Agencies with API Keys

```javascript
import { supabase1, supabase2 } from './services/supabase';
import { listAllAgenciesWithData } from './services/dual-database-search';

const agencies = await listAllAgenciesWithData(supabase1, supabase2);

console.log(`Total agencies: ${agencies.length}`);

agencies.forEach(agency => {
  console.log(`\n${agency.name}:`);
  console.log(`  In DB1: ${agency.hasDb1 ? '✅' : '❌'}`);
  console.log(`  In DB2: ${agency.hasDb2 ? '✅' : '❌'}`);
  console.log(`  Daft API: ${agency.apiKeys.hasDaft ? '✅' : '❌'}`);
  console.log(`  MyHome API: ${agency.apiKeys.hasMyhome ? '✅' : '❌'}`);
});
```

### Example 3: Get Database Statistics

```javascript
import { supabase1, supabase2 } from './services/supabase';
import { getDatabaseSummary } from './services/dual-database-search';

const stats = await getDatabaseSummary(supabase1, supabase2);

console.log('Database Summary:');
console.log(`DB1 Agencies: ${stats.db1.agencies}`);
console.log(`DB2 Agencies: ${stats.db2.agencies}`);
console.log(`DB2 Properties: ${stats.db2.properties}`);
console.log(`Agencies with Daft key: ${stats.db2.agenciesWithDaftKey}`);
console.log(`Agencies with MyHome key: ${stats.db2.agenciesWithMyhomeKey}`);
```

---

## Console Output

When searching, you'll see detailed logs:

```
🔍 Searching for agency: "Ray Maher Property Service"
DB1 agency_list: ✅ Found (ID: 8d1f8341-15fc-4173-a9c4-bca34cfb0e07)
DB2 agencies: ✅ Found (ID: 123e4567-e89b-12d3-a456-426614174000)
DB2 properties: 15 found
API Keys: { source: 'database', daft: '✅ Available', myhome: '❌ Not available' }
```

---

## API Keys Priority

The system uses a **cascading priority** for API keys:

1. **Primary Source: DB2 `agencies` table**
   - Check `daft_api_key`, `myhome_api_key`, `myhome_group_id`
   - Most reliable and up-to-date
   - Marked as `source: 'database'`

2. **Fallback: JSON file**
   - Check `src/data/agencies.json`
   - Used when database doesn't have keys
   - Marked as `source: 'json'`

```javascript
const apiKeys = getApiKeysForAgency(db2Agency, "Agency Name");

if (apiKeys.source === 'database') {
  console.log('Using API keys from DB2 agencies table');
} else {
  console.log('Using API keys from JSON file (fallback)');
}
```

---

## Key Insights

### Database Roles
- **DB1** = Aggregated/API layer (simplified agency references)
- **DB2** = Main database (full data including properties and API keys)

### Linking Strategy
- Link by **agency name** (text matching), NOT by ID
- DB1 `agency_list.agency_name` ⟷ DB2 `agencies.name`
- DB2 `properties.agency_name` for text search
- DB2 `properties.agency_id` for foreign key lookup

### Important Notes
- DB2 `agencies` table ALREADY contains API keys
- The JSON file is a fallback or for initial import
- Properties are ONLY in DB2, not DB1
- `agency_id` values in DB1 and DB2 are DIFFERENT (use name matching)

---

## Troubleshooting

### Issue: No API keys found
**Solution**: Check both sources:
1. DB2 `agencies` table (primary)
2. `src/data/agencies.json` (fallback)

### Issue: Agency found but no properties
**Solution**:
- Properties are in DB2 only
- Check if `agency_id` in DB2 `agencies` matches `agency_id` in DB2 `properties`
- Try searching by `agency_name` instead

### Issue: Duplicate agencies
**Solution**:
- Use `listAllAgenciesWithData()` to see which agencies are in both databases
- Match by name, not by ID

---

## Next Steps

To extend the system:

1. **Add more search criteria** (by location, price range, etc.)
2. **Cache API keys** for performance
3. **Investigate DB1 `listings` table** structure
4. **Check for additional schemas** beyond `public`
5. **Look for portal-specific tables** (`daft_listings`, `myhome_listings`, etc.)

---

See `DB_SCHEMA_MAPPING.md` for detailed database structure information.
