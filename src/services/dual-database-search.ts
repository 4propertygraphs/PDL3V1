/**
 * Dual Database Search Service
 *
 * ACTUAL DATABASE STRUCTURE (confirmed via runtime diagnostics):
 * - DB1 (izuvblxr): agency_list, listings, property_log
 * - DB2 (ywmryhzp): properties, agencies (includes API keys!)
 *
 * DB2 is the main source database with properties and agency details.
 * DB1 appears to be an aggregated/API layer.
 */

import { getAgencyApiKeys } from './agency-api-keys';

// ============================================================================
// DB1 Functions (agency_list, listings, property_log)
// ============================================================================

/**
 * Get agency from DB1 agency_list by name
 */
export async function getAgencyFromDB1(
  supabaseDB1: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB1
    .from('agency_list')
    .select('*')
    .ilike('agency_name', `%${agencyName}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching agency from DB1 agency_list:', error);
    return null;
  }

  return data;
}

/**
 * Get all agencies from DB1 agency_list
 */
export async function getAllAgenciesFromDB1(supabaseDB1: any) {
  const { data, error } = await supabaseDB1
    .from('agency_list')
    .select('*');

  if (error) {
    console.error('Error fetching agencies from DB1 agency_list:', error);
    return [];
  }

  return data || [];
}

/**
 * Get listings from DB1 (structure unclear, needs investigation)
 */
export async function getListingsFromDB1(supabaseDB1: any, agencyName?: string) {
  let query = supabaseDB1.from('listings').select('*');

  if (agencyName) {
    // Try common column names for agency reference
    query = query.or(`agency_name.ilike.%${agencyName}%,agency_id.ilike.%${agencyName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching listings from DB1:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// DB2 Functions (properties, agencies)
// ============================================================================

/**
 * Get agency from DB2 agencies table by name
 * This table includes API keys: daft_api_key, myhome_api_key, myhome_group_id
 */
export async function getAgencyFromDB2(
  supabaseDB2: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB2
    .from('agencies')
    .select('*')
    .ilike('name', `%${agencyName}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching agency from DB2 agencies:', error);
    return null;
  }

  return data;
}

/**
 * Get properties from DB2 by agency name
 */
export async function getPropertiesFromDB2ByAgencyName(
  supabaseDB2: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB2
    .from('properties')
    .select('*')
    .ilike('agency_name', `%${agencyName}%`);

  if (error) {
    console.error('Error fetching properties from DB2 by agency_name:', error);
    return [];
  }

  return data || [];
}

/**
 * Get properties from DB2 by agency ID
 */
export async function getPropertiesFromDB2ByAgencyId(
  supabaseDB2: any,
  agencyId: string
) {
  const { data, error } = await supabaseDB2
    .from('properties')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error fetching properties from DB2 by agency_id:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all agencies from DB2
 */
export async function getAllAgenciesFromDB2(supabaseDB2: any) {
  const { data, error } = await supabaseDB2
    .from('agencies')
    .select('*');

  if (error) {
    console.error('Error fetching agencies from DB2:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// API Keys Management
// ============================================================================

/**
 * Get API keys for an agency
 * Priority: DB2 agencies table → JSON file fallback
 */
export function getApiKeysForAgency(db2Agency: any, agencyName: string) {
  // First priority: Check DB2 agencies table
  if (db2Agency) {
    const hasDbKeys = db2Agency.daft_api_key || db2Agency.myhome_api_key;

    if (hasDbKeys) {
      return {
        source: 'database',
        daftApiKey: db2Agency.daft_api_key || null,
        myhomeApiKey: db2Agency.myhome_api_key || null,
        myhomeGroupId: db2Agency.myhome_group_id || null,
      };
    }
  }

  // Fallback: Check JSON file
  const jsonKeys = getAgencyApiKeys(agencyName);
  return {
    source: 'json',
    daftApiKey: jsonKeys.daftApiKey,
    myhomeApiKey: jsonKeys.myhomeApiKey,
    myhomeGroupId: jsonKeys.myhomeGroupId,
  };
}

// ============================================================================
// Cross-Database Search Functions
// ============================================================================

/**
 * Complete agency search across both databases
 *
 * Search flow:
 * 1. Search DB1 agency_list for agency info
 * 2. Search DB2 agencies for full details + API keys
 * 3. Get properties from DB2 by agency name or ID
 * 4. Fallback to JSON file for API keys if needed
 */
export async function searchAgencyAcrossDatabases(
  supabaseDB1: any,
  supabaseDB2: any,
  agencyName: string
) {
  console.log(`🔍 Searching for agency: "${agencyName}"`);

  // Step 1: Get agency from DB1 agency_list
  const db1Agency = await getAgencyFromDB1(supabaseDB1, agencyName);
  console.log('DB1 agency_list:', db1Agency ? `✅ Found (ID: ${db1Agency.agency_id})` : '❌ Not found');

  // Step 2: Get agency from DB2 agencies (includes API keys!)
  const db2Agency = await getAgencyFromDB2(supabaseDB2, agencyName);
  console.log('DB2 agencies:', db2Agency ? `✅ Found (ID: ${db2Agency.id})` : '❌ Not found');

  // Step 3: Get properties from DB2
  let properties: any[] = [];

  if (db2Agency) {
    // Try by agency_id first (more accurate)
    properties = await getPropertiesFromDB2ByAgencyId(supabaseDB2, db2Agency.id);

    // If no results, try by agency_name
    if (properties.length === 0) {
      properties = await getPropertiesFromDB2ByAgencyName(supabaseDB2, agencyName);
    }
  } else {
    // No agency found, try searching by name anyway
    properties = await getPropertiesFromDB2ByAgencyName(supabaseDB2, agencyName);
  }

  console.log(`DB2 properties: ${properties.length} found`);

  // Step 4: Get API keys (DB2 first, then JSON fallback)
  const apiKeys = getApiKeysForAgency(db2Agency, agencyName);
  console.log('API Keys:', {
    source: apiKeys.source,
    daft: apiKeys.daftApiKey ? '✅ Available' : '❌ Not available',
    myhome: apiKeys.myhomeApiKey ? '✅ Available' : '❌ Not available',
  });

  return {
    agencyName,
    db1: {
      agency: db1Agency,
    },
    db2: {
      agency: db2Agency,
      properties: properties,
    },
    apiKeys: {
      source: apiKeys.source,
      daftApiKey: apiKeys.daftApiKey,
      myhomeApiKey: apiKeys.myhomeApiKey,
      myhomeGroupId: apiKeys.myhomeGroupId,
    },
    summary: {
      foundInDb1: !!db1Agency,
      foundInDb2: !!db2Agency,
      propertiesCount: properties.length,
      hasApiKeys: !!(apiKeys.daftApiKey || apiKeys.myhomeApiKey),
    },
  };
}

/**
 * Search property by ID in DB2 and find its agency across both databases
 */
export async function searchPropertyAndAgency(
  supabaseDB1: any,
  supabaseDB2: any,
  propertyId: string
) {
  // Get property from DB2
  const { data: property, error } = await supabaseDB2
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();

  if (error || !property) {
    console.error('Property not found in DB2:', error);
    return null;
  }

  console.log(`Found property: ${property.address || property.id}`);
  console.log(`Agency: ${property.agency_name || 'Unknown'}`);

  // Search for agency across both databases
  if (property.agency_name) {
    return await searchAgencyAcrossDatabases(
      supabaseDB1,
      supabaseDB2,
      property.agency_name
    );
  }

  return {
    property,
    error: 'Property has no agency_name',
  };
}

/**
 * List all agencies with their data from both databases
 */
export async function listAllAgenciesWithData(
  supabaseDB1: any,
  supabaseDB2: any
) {
  console.log('📋 Listing all agencies...');

  // Get agencies from both databases
  const db1Agencies = await getAllAgenciesFromDB1(supabaseDB1);
  const db2Agencies = await getAllAgenciesFromDB2(supabaseDB2);

  console.log(`DB1: ${db1Agencies.length} agencies in agency_list`);
  console.log(`DB2: ${db2Agencies.length} agencies in agencies table`);

  // Create a map for faster lookup
  const db2Map = new Map();
  for (const agency of db2Agencies) {
    const normalizedName = agency.name.toLowerCase().trim();
    db2Map.set(normalizedName, agency);
  }

  const results = [];

  // Start with DB2 agencies (they have more complete data)
  for (const db2Agency of db2Agencies) {
    const normalizedName = db2Agency.name.toLowerCase().trim();

    // Find matching agency in DB1
    const db1Agency = db1Agencies.find((a: any) => {
      const db1Name = a.agency_name.toLowerCase().trim();
      return db1Name.includes(normalizedName) || normalizedName.includes(db1Name);
    });

    // Get API keys
    const apiKeys = getApiKeysForAgency(db2Agency, db2Agency.name);

    results.push({
      name: db2Agency.name,
      db1: db1Agency || null,
      db2: db2Agency,
      hasDb1: !!db1Agency,
      hasDb2: true,
      apiKeys: {
        source: apiKeys.source,
        hasDaft: !!apiKeys.daftApiKey,
        hasMyhome: !!apiKeys.myhomeApiKey,
      },
    });
  }

  // Add DB1-only agencies (not found in DB2)
  for (const db1Agency of db1Agencies) {
    const alreadyAdded = results.some(r =>
      r.db1 && r.db1.agency_id === db1Agency.agency_id
    );

    if (!alreadyAdded) {
      const apiKeys = getApiKeysForAgency(null, db1Agency.agency_name);

      results.push({
        name: db1Agency.agency_name,
        db1: db1Agency,
        db2: null,
        hasDb1: true,
        hasDb2: false,
        apiKeys: {
          source: apiKeys.source,
          hasDaft: !!apiKeys.daftApiKey,
          hasMyhome: !!apiKeys.myhomeApiKey,
        },
      });
    }
  }

  console.log(`✅ Total unique agencies: ${results.length}`);

  return results;
}

/**
 * Get summary statistics across both databases
 */
export async function getDatabaseSummary(
  supabaseDB1: any,
  supabaseDB2: any
) {
  const [db1Agencies, db2Agencies] = await Promise.all([
    getAllAgenciesFromDB1(supabaseDB1),
    getAllAgenciesFromDB2(supabaseDB2),
  ]);

  // Count properties in DB2
  const { count: propertiesCount } = await supabaseDB2
    .from('properties')
    .select('*', { count: 'exact', head: true });

  // Count agencies with API keys
  const agenciesWithDaft = db2Agencies.filter((a: any) => a.daft_api_key).length;
  const agenciesWithMyhome = db2Agencies.filter((a: any) => a.myhome_api_key).length;

  return {
    db1: {
      agencies: db1Agencies.length,
      tables: ['agency_list', 'listings', 'property_log'],
    },
    db2: {
      agencies: db2Agencies.length,
      properties: propertiesCount || 0,
      agenciesWithDaftKey: agenciesWithDaft,
      agenciesWithMyhomeKey: agenciesWithMyhome,
      tables: ['properties', 'agencies'],
    },
  };
}
