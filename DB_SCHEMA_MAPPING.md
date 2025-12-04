# Database Schema Mapping - ACTUAL STRUCTURE

## Overview

Based on runtime diagnostics, here is the **actual** structure of both databases:

---

## DB1: izuvblxrwtmeiywwzufp.supabase.co

### Tables Found:

#### `agency_list`
Columns: `agency_id`, `agency_name`, `logo_url`, `agents`, `metadata`, `created_at`, `updated_at`

This table contains agency information with a unique `agency_id` that can be used for linking.

#### `listings`
Columns: (minimal/empty - needs investigation)

Purpose unclear - possibly for aggregated listings or cross-references.

#### `property_log`
Columns: `log_id`, `property_id`, `source`, `action`, `details`, `logged_at`

This table logs changes to properties for audit/tracking purposes.

---

## DB2: ywmryhzpojfrmrxgggoy.supabase.co

### Tables Found:

#### `properties`
Columns: `id`, `agency_id`, `source`, `external_id`, `address`, `price`, `beds`, `baths`, `size`, `size_in_acres`, `type`, `market`, `status`, `live_status`, `agent`, `agent_name`, `pics`, `images`, `modified`, `parent_id`, `agency_name`, `created_at`, `updated_at`, `house_bathrooms`, `house_location`, `house_price`, `house_bedrooms`, `house_mt_squared`

**Key Fields:**
- `agency_id` - Links to agencies table
- `agency_name` - Text field for agency name
- Both `beds`/`bedrooms` and `house_bedrooms` exist
- Both `pics` and `images` exist (likely JSON arrays)

#### `agencies`
Columns: `id`, `name`, `unique_key`, `office_name`, `address`, `address1`, `address2`, `logo`, `site`, `site_name`, `acquaint_site_prefix`, **`daft_api_key`**, **`myhome_api_key`**, **`myhome_group_id`**, `fourpm_branch_id`, `ghl_id`, `whmcs_id`, `primary_source`, `total_properties`, `created_at`, `updated_at`, `stefanmars_api_token`, `stefanmars_api_key`

**Important Discovery:**
- This table ALREADY contains API keys for Daft and MyHome!
- `daft_api_key` - Direct Daft API key
- `myhome_api_key` - MyHome API key
- `myhome_group_id` - MyHome Group ID
- Multiple other API integrations (stefanmars, fourpm, etc.)

---

## Key Findings

### Original Assumptions vs Reality

**What we thought:**
- DB1 = Source database with `agency` and `properties`
- DB2 = API database with `agency_list` and portal-specific tables

**What it actually is:**
- DB1 = Aggregated/API database with `agency_list`, `listings`, `property_log`
- DB2 = Main source database with `properties` and `agencies` (plus API keys!)

### Missing Tables Mentioned by User

The user mentioned these tables, but they were NOT found:
- `agency_props` - Not found in either DB
- `daft` - Not found (but see note below)
- `myhome` - Not found (but see note below)
- `wordpress_listings` - Not found

**Possible explanations:**
1. These tables exist in a different schema (not `public`)
2. They're named differently (e.g., `daft_listings` instead of `daft`)
3. They're dynamic tables (e.g., `agency_props_[agency_name]_[hash]`)
4. They haven't been created yet
5. The user's description referred to a different database setup

---

## Recommended Search Strategy

### Search by Agency Name

```javascript
// Step 1: Get agency from DB1
const { data: db1Agency } = await supabase1
  .from('agency_list')
  .select('*')
  .ilike('agency_name', '%Acme Realty%')
  .single();

// Step 2: Get agency from DB2 (includes API keys!)
const { data: db2Agency } = await supabase2
  .from('agencies')
  .select('*')
  .ilike('name', '%Acme Realty%')
  .single();

// Step 3: Get properties from DB2
const { data: properties } = await supabase2
  .from('properties')
  .select('*')
  .eq('agency_id', db2Agency.id);
// OR search by name:
  .ilike('agency_name', '%Acme Realty%');
```

### Linking Between Databases

**By Agency Name:**
- DB1 `agency_list.agency_name` ⟷ DB2 `agencies.name`
- DB2 `properties.agency_name` contains the text name

**By Agency ID:**
- DB1 `agency_list.agency_id` (unique identifier)
- DB2 `agencies.id` (primary key)
- DB2 `properties.agency_id` (foreign key)

**Note:** The `agency_id` fields in DB1 and DB2 might NOT be the same values!
Link by name matching, not by ID matching.

---

## API Keys Management

### Three Potential Sources:

1. **JSON File** (`src/data/agencies.json`)
   - Contains: DaftApiKey, MyhomeApi (ApiKey + GroupID)
   - Manually maintained
   - Used as fallback

2. **DB2 agencies table**
   - Contains: daft_api_key, myhome_api_key, myhome_group_id
   - Stored directly in database
   - **Recommended primary source**

3. **DB1 metadata**
   - The `agency_list.metadata` field might contain additional info
   - Needs investigation

### Recommended Approach:

```javascript
// Priority order for API keys:
1. Check DB2 agencies table first (most authoritative)
2. Fallback to JSON file if DB2 is missing keys
3. Cache for performance
```

---

## Updated dual-database-search.ts Logic

The functions need to be updated to:

1. **Search DB1 `agency_list`** (not `agency`)
2. **Search DB2 `agencies`** (not `agency_list`)
3. **Search DB2 `properties`** (not DB1)
4. **Pull API keys from DB2 `agencies`** (primary) or JSON (fallback)

---

## Data Flow Diagram

```
User searches "Acme Realty"
    |
    ├─> DB1: agency_list.agency_name ILIKE '%Acme Realty%'
    |       └─> Returns: agency_id, agency_name, logo_url
    |
    ├─> DB2: agencies.name ILIKE '%Acme Realty%'
    |       └─> Returns: id, name, daft_api_key, myhome_api_key, etc.
    |
    └─> DB2: properties WHERE agency_name ILIKE '%Acme Realty%'
            OR properties WHERE agency_id = [id from agencies]
            └─> Returns: All properties for that agency
```

---

## Questions to Investigate

1. What is the relationship between DB1 `agency_list.agency_id` and DB2 `agencies.id`?
2. What data exists in DB1 `listings` table?
3. Are there any other schemas besides `public`?
4. Do the `agency_props_*`, `daft`, `myhome`, `wordpress_listings` tables exist somewhere?
5. What format is `properties.pics` vs `properties.images`?

---

## Debugging Commands

```javascript
// Check if agency_id values match across databases
// DB1
const db1Agencies = await supabase1.from('agency_list').select('agency_id, agency_name').limit(5);

// DB2
const db2Agencies = await supabase2.from('agencies').select('id, name').limit(5);

// Compare to see if IDs align
```

---

## Notes

- DB2 appears to be the "main" database with all the properties and agency details
- DB1 appears to be a simplified/aggregated view or API layer
- The `property_log` in DB1 suggests it tracks changes to properties in DB2
- API keys are already in DB2, so the JSON file might be redundant or for migration purposes
