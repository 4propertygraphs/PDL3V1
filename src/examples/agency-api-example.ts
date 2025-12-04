/**
 * Example usage of Agency API Keys system
 */

import { getAgencyApiKeys, getAllAgencyNames } from '../services/agency-api-keys';

// Example 1: Get API keys for a specific agency
console.log('=== Example 1: Get API keys by agency name ===');
const keys1 = getAgencyApiKeys('Ray Maher Property Service');
console.log('Agency:', 'Ray Maher Property Service');
console.log('Daft API Key:', keys1.daftApiKey || 'Not available');
console.log('MyHome API Key:', keys1.myhomeApiKey || 'Not available');
console.log('MyHome Group ID:', keys1.myhomeGroupId || 'Not available');
console.log('');

// Example 2: Case-insensitive search
console.log('=== Example 2: Case-insensitive search ===');
const keys2 = getAgencyApiKeys('ray maher property service'); // lowercase
console.log('Search:', 'ray maher property service (lowercase)');
console.log('Found:', keys2.agencyData ? 'YES' : 'NO');
console.log('Daft API:', keys2.daftApiKey ? 'Available' : 'Not available');
console.log('');

// Example 3: Partial match
console.log('=== Example 3: Partial match ===');
const keys3 = getAgencyApiKeys('DNG Brady');
console.log('Search:', 'DNG Brady');
console.log('Found:', keys3.agencyData?.Name);
console.log('Daft API:', keys3.daftApiKey ? 'Available' : 'Not available');
console.log('');

// Example 4: Agency with MyHome API
console.log('=== Example 4: MyHome API agency ===');
const keys4 = getAgencyApiKeys("O'Farrell Cleere");
console.log('Agency:', "O'Farrell Cleere");
console.log('MyHome API Key:', keys4.myhomeApiKey || 'Not available');
console.log('MyHome Group ID:', keys4.myhomeGroupId || 'Not available');
console.log('Daft API:', keys4.daftApiKey || 'Not available');
console.log('');

// Example 5: List all available agencies
console.log('=== Example 5: All agencies ===');
const allAgencies = getAllAgencyNames();
console.log('Total agencies loaded:', allAgencies.length);
console.log('First 5 agencies:');
allAgencies.slice(0, 5).forEach((name, i) => {
  console.log(`  ${i + 1}. ${name}`);
});
console.log('');

// Example 6: Check API availability
console.log('=== Example 6: API availability check ===');
const testAgencies = [
  'Ray Maher Property Service',
  "O'Farrell Cleere",
  'DNG Brady',
  'Lyons Auctioneers Ltd'
];

testAgencies.forEach(agencyName => {
  const keys = getAgencyApiKeys(agencyName);
  const status = [];
  if (keys.daftApiKey) status.push('Daft');
  if (keys.myhomeApiKey) status.push('MyHome');
  console.log(`${agencyName}: ${status.length > 0 ? status.join(' + ') : 'No APIs'}`);
});
