import { getAgencyApiKeys } from './agency-api-keys';

/**
 * Example: Get API keys for an agency from DB1 properties
 */
export async function getApiKeysForProperty(
  supabaseDB1: any,
  propertyId: string
) {
  // Get property from DB1
  const { data: property, error } = await supabaseDB1
    .from('properties')
    .select('agency_name')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    console.error('Property not found:', error);
    return null;
  }

  // Get API keys for this agency
  const apiKeys = getAgencyApiKeys(property.agency_name);

  return {
    agencyName: property.agency_name,
    ...apiKeys,
  };
}

/**
 * Example: Get API keys for an agency from DB2 agency_list
 */
export async function getApiKeysForAgency(
  supabaseDB2: any,
  agencyId: string
) {
  // Get agency from DB2
  const { data: agency, error } = await supabaseDB2
    .from('agency_list')
    .select('agency_name')
    .eq('agency_id', agencyId)
    .single();

  if (error || !agency) {
    console.error('Agency not found:', error);
    return null;
  }

  // Get API keys for this agency
  const apiKeys = getAgencyApiKeys(agency.agency_name);

  return {
    agencyId,
    agencyName: agency.agency_name,
    ...apiKeys,
  };
}

/**
 * Get all agencies from DB2 with their API keys
 */
export async function getAllAgenciesWithApiKeys(supabaseDB2: any) {
  const { data: agencies, error } = await supabaseDB2
    .from('agency_list')
    .select('agency_id, agency_name');

  if (error || !agencies) {
    console.error('Failed to fetch agencies:', error);
    return [];
  }

  return agencies.map((agency: any) => {
    const apiKeys = getAgencyApiKeys(agency.agency_name);
    return {
      agencyId: agency.agency_id,
      agencyName: agency.agency_name,
      ...apiKeys,
    };
  });
}

/**
 * Check if agency has Daft API key
 */
export function hasValidDaftKey(agencyName: string): boolean {
  const keys = getAgencyApiKeys(agencyName);
  return keys.daftApiKey !== null && keys.daftApiKey.length > 0;
}

/**
 * Check if agency has MyHome API key
 */
export function hasValidMyhomeKey(agencyName: string): boolean {
  const keys = getAgencyApiKeys(agencyName);
  return keys.myhomeApiKey !== null && keys.myhomeApiKey.length > 0;
}
