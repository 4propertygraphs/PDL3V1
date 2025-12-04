/**
 * Dual Database Search Service
 * Searches across DB1 (source) and DB2 (MyHome API)
 */

import { getAgencyApiKeys } from './agency-api-keys';

// ============================================================================
// DB1 (Source Database) Functions
// ============================================================================

/**
 * Get agency from DB1 by name
 */
export async function getAgencyFromDB1(
  supabaseDB1: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB1
    .from('agency')
    .select('*')
    .ilike('name', `%${agencyName}%`)
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching agency from DB1:', error);
    return null;
  }

  return data;
}

/**
 * Get properties from DB1 by agency name
 */
export async function getPropertiesFromDB1ByAgency(
  supabaseDB1: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB1
    .from('properties')
    .select('*')
    .ilike('agency_name', `%${agencyName}%`);

  if (error) {
    console.error('Error fetching properties from DB1:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all agencies from DB1
 */
export async function getAllAgenciesFromDB1(supabaseDB1: any) {
  const { data, error } = await supabaseDB1
    .from('agency')
    .select('*');

  if (error) {
    console.error('Error fetching agencies from DB1:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// DB2 (MyHome API Database) Functions
// ============================================================================

/**
 * Get agency from DB2 agency_list by name
 * Returns agency_id which can be used to find related data
 */
export async function getAgencyFromDB2(
  supabaseDB2: any,
  agencyName: string
) {
  const { data, error } = await supabaseDB2
    .from('agency_list')
    .select('*')
    .ilike('agency_name', `%${agencyName}%`)
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching agency from DB2:', error);
    return null;
  }

  return data;
}

/**
 * Get agency properties from DB2 by agency_id
 */
export async function getAgencyPropsFromDB2(
  supabaseDB2: any,
  agencyId: string
) {
  const { data, error } = await supabaseDB2
    .from('agency_props')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error fetching agency_props from DB2:', error);
    return [];
  }

  return data || [];
}

/**
 * Get Daft listings from DB2 by agency_id
 */
export async function getDaftListingsFromDB2(
  supabaseDB2: any,
  agencyId: string
) {
  const { data, error } = await supabaseDB2
    .from('daft')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error fetching daft listings from DB2:', error);
    return [];
  }

  return data || [];
}

/**
 * Get MyHome listings from DB2 by agency_id
 */
export async function getMyhomeListingsFromDB2(
  supabaseDB2: any,
  agencyId: string
) {
  const { data, error } = await supabaseDB2
    .from('myhome')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error fetching myhome listings from DB2:', error);
    return [];
  }

  return data || [];
}

/**
 * Get WordPress listings from DB2 by agency_id
 */
export async function getWordpressListingsFromDB2(
  supabaseDB2: any,
  agencyId: string
) {
  const { data, error } = await supabaseDB2
    .from('wordpress_listings')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error fetching wordpress listings from DB2:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all listings for an agency from DB2
 */
export async function getAllListingsForAgency(
  supabaseDB2: any,
  agencyId: string
) {
  const [agencyProps, daftListings, myhomeListings, wordpressListings] = await Promise.all([
    getAgencyPropsFromDB2(supabaseDB2, agencyId),
    getDaftListingsFromDB2(supabaseDB2, agencyId),
    getMyhomeListingsFromDB2(supabaseDB2, agencyId),
    getWordpressListingsFromDB2(supabaseDB2, agencyId),
  ]);

  return {
    agencyProps,
    daftListings,
    myhomeListings,
    wordpressListings,
    total: agencyProps.length + daftListings.length + myhomeListings.length + wordpressListings.length,
  };
}

// ============================================================================
// Cross-Database Functions (Linking DB1 and DB2)
// ============================================================================

/**
 * Complete agency search across both databases
 * 1. Search in DB1 for agency info
 * 2. Search in DB2 for agency_id
 * 3. Get all related listings from DB2
 * 4. Get API keys from agencies.json
 */
export async function searchAgencyAcrossDatabases(
  supabaseDB1: any,
  supabaseDB2: any,
  agencyName: string
) {
  console.log(`🔍 Searching for agency: "${agencyName}"`);

  // Step 1: Get agency from DB1
  const db1Agency = await getAgencyFromDB1(supabaseDB1, agencyName);
  console.log('DB1 Agency:', db1Agency ? '✅ Found' : '❌ Not found');

  // Step 2: Get properties from DB1
  const db1Properties = await getPropertiesFromDB1ByAgency(supabaseDB1, agencyName);
  console.log(`DB1 Properties: ${db1Properties.length} found`);

  // Step 3: Get agency from DB2
  const db2Agency = await getAgencyFromDB2(supabaseDB2, agencyName);
  console.log('DB2 Agency:', db2Agency ? `✅ Found (ID: ${db2Agency.agency_id})` : '❌ Not found');

  // Step 4: Get all listings from DB2 if agency exists
  let db2Listings = null;
  if (db2Agency) {
    db2Listings = await getAllListingsForAgency(supabaseDB2, db2Agency.agency_id);
    console.log(`DB2 Listings: ${db2Listings.total} total`);
    console.log(`  - Agency Props: ${db2Listings.agencyProps.length}`);
    console.log(`  - Daft: ${db2Listings.daftListings.length}`);
    console.log(`  - MyHome: ${db2Listings.myhomeListings.length}`);
    console.log(`  - WordPress: ${db2Listings.wordpressListings.length}`);
  }

  // Step 5: Get API keys from agencies.json
  const apiKeys = getAgencyApiKeys(agencyName);
  console.log('API Keys:', {
    daft: apiKeys.daftApiKey ? '✅ Available' : '❌ Not available',
    myhome: apiKeys.myhomeApiKey ? '✅ Available' : '❌ Not available',
  });

  return {
    agencyName,
    db1: {
      agency: db1Agency,
      properties: db1Properties,
    },
    db2: {
      agency: db2Agency,
      listings: db2Listings,
    },
    apiKeys: {
      daftApiKey: apiKeys.daftApiKey,
      myhomeApiKey: apiKeys.myhomeApiKey,
      myhomeGroupId: apiKeys.myhomeGroupId,
    },
  };
}

/**
 * Search property by ID in DB1 and find its agency in DB2
 */
export async function searchPropertyAndAgency(
  supabaseDB1: any,
  supabaseDB2: any,
  propertyId: string
) {
  // Get property from DB1
  const { data: property, error } = await supabaseDB1
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    console.error('Property not found:', error);
    return null;
  }

  // Search for agency across both databases
  return await searchAgencyAcrossDatabases(
    supabaseDB1,
    supabaseDB2,
    property.agency_name
  );
}

/**
 * List all agencies with their data from both databases
 */
export async function listAllAgenciesWithData(
  supabaseDB1: any,
  supabaseDB2: any
) {
  // Get all agencies from DB1
  const db1Agencies = await getAllAgenciesFromDB1(supabaseDB1);

  // Get all agencies from DB2
  const { data: db2Agencies, error } = await supabaseDB2
    .from('agency_list')
    .select('*');

  if (error) {
    console.error('Error fetching DB2 agencies:', error);
    return [];
  }

  // Merge data
  const results = [];

  for (const db1Agency of db1Agencies) {
    const agencyName = db1Agency.name;

    // Find matching agency in DB2
    const db2Agency = db2Agencies?.find(
      (a: any) => a.agency_name.toLowerCase().includes(agencyName.toLowerCase()) ||
                  agencyName.toLowerCase().includes(a.agency_name.toLowerCase())
    );

    // Get API keys
    const apiKeys = getAgencyApiKeys(agencyName);

    results.push({
      name: agencyName,
      db1: db1Agency,
      db2: db2Agency || null,
      hasDb1: true,
      hasDb2: !!db2Agency,
      hasDaftApi: !!apiKeys.daftApiKey,
      hasMyhomeApi: !!apiKeys.myhomeApiKey,
    });
  }

  return results;
}
