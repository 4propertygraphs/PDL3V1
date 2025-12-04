import agenciesData from '../data/agencies.json';

export interface AgencyApiData {
  Key: string;
  Name: string;
  OfficeName: string;
  Address1: string;
  Address2: string;
  Logo: string | null;
  Site: string;
  AcquiantCustomer: {
    FourPMBranchID: number;
    SitePrefix: string;
    SiteID: number;
    SiteName: string;
  } | null;
  DaftApiKey: string | null;
  MyhomeApi: {
    ApiKey: string;
    GroupID: number;
  } | null;
  uuid: string;
}

interface AgencyKeys {
  daftApiKey: string | null;
  myhomeApiKey: string | null;
  myhomeGroupId: number | null;
  agencyData: AgencyApiData | null;
}

/**
 * Finds API keys for an agency by name
 * Matches against both Name and OfficeName fields
 */
export function getAgencyApiKeys(agencyName: string): AgencyKeys {
  if (!agencyName) {
    return {
      daftApiKey: null,
      myhomeApiKey: null,
      myhomeGroupId: null,
      agencyData: null,
    };
  }

  // Normalize agency name for comparison
  const normalizedSearchName = agencyName.toLowerCase().trim();

  // Try to find exact match first
  let agency = agenciesData.find(
    (a) =>
      a.Name.toLowerCase().trim() === normalizedSearchName ||
      a.OfficeName.toLowerCase().trim() === normalizedSearchName
  );

  // If no exact match, try partial match
  if (!agency) {
    agency = agenciesData.find(
      (a) =>
        a.Name.toLowerCase().includes(normalizedSearchName) ||
        a.OfficeName.toLowerCase().includes(normalizedSearchName) ||
        normalizedSearchName.includes(a.Name.toLowerCase()) ||
        normalizedSearchName.includes(a.OfficeName.toLowerCase())
    );
  }

  if (!agency) {
    return {
      daftApiKey: null,
      myhomeApiKey: null,
      myhomeGroupId: null,
      agencyData: null,
    };
  }

  return {
    daftApiKey: agency.DaftApiKey,
    myhomeApiKey: agency.MyhomeApi?.ApiKey || null,
    myhomeGroupId: agency.MyhomeApi?.GroupID || null,
    agencyData: agency,
  };
}

/**
 * Gets all agencies with Daft API keys
 */
export function getAgenciesWithDaftKeys(): AgencyApiData[] {
  return agenciesData.filter((a) => a.DaftApiKey !== null);
}

/**
 * Gets all agencies with MyHome API keys
 */
export function getAgenciesWithMyhomeKeys(): AgencyApiData[] {
  return agenciesData.filter((a) => a.MyhomeApi !== null);
}

/**
 * Gets agency data by UUID
 */
export function getAgencyByUuid(uuid: string): AgencyApiData | null {
  return agenciesData.find((a) => a.uuid === uuid) || null;
}

/**
 * Lists all available agency names
 */
export function getAllAgencyNames(): string[] {
  return agenciesData.map((a) => a.Name);
}
