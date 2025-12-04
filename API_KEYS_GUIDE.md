# Agency API Keys Guide

## Prehľad

Systém spravuje API kľúče pre Daft a MyHome portály pre jednotlivé agentúry.

## Súbory

- `src/data/agencies.json` - JSON súbor s API kľúčmi
- `src/services/agency-api-keys.ts` - Service pre prácu s API kľúčmi
- `src/services/agency-integration.ts` - Integrácia s databázami

## Štruktúra dát

### agencies.json

```json
{
  "Name": "Ray Maher Property Service",
  "OfficeName": "Ray Maher Property Service",
  "DaftApiKey": "d34826e68eaa5758ecb9decae01e3c9943264e86",
  "MyhomeApi": {
    "ApiKey": "126FDF4B-28E5-4F17-9FE9-055C868924CF",
    "GroupID": 5747
  },
  "uuid": "8d1f8341-15fc-4173-a9c4-bca34cfb0e07"
}
```

## Databázová štruktúra

### DB1 (Source DB)
- `properties` - má column `agency_name`
- `agency` - info o agentúrach

### DB2 (MyHome API DB)
- `agency_list` - má `agency_id` a `agency_name`
- `agency_props` - linkované s `agency_id`
- `daft` - Daft listings s `agency_id`
- `myhome` - MyHome listings s `agency_id`
- `wordpress_listings` - WordPress listings s `agency_id`

## Použitie

### 1. Získať API kľúče podľa mena agentúry

```typescript
import { getAgencyApiKeys } from './services/agency-api-keys';

const keys = getAgencyApiKeys('Ray Maher Property Service');

if (keys.daftApiKey) {
  console.log('Daft API Key:', keys.daftApiKey);
}

if (keys.myhomeApiKey) {
  console.log('MyHome API Key:', keys.myhomeApiKey);
  console.log('MyHome Group ID:', keys.myhomeGroupId);
}
```

### 2. Získať API kľúče pre property z DB1

```typescript
import { getApiKeysForProperty } from './services/agency-integration';
import { createClient } from '@supabase/supabase-js';

const supabaseDB1 = createClient(
  process.env.VITE_SUPABASE_URL_DB1!,
  process.env.VITE_SUPABASE_ANON_KEY_DB1!
);

const apiKeys = await getApiKeysForProperty(supabaseDB1, 'property-id-123');

if (apiKeys?.daftApiKey) {
  // Pošli property na Daft
  await sendToDaft(propertyData, apiKeys.daftApiKey);
}
```

### 3. Získať API kľúče pre agentúru z DB2

```typescript
import { getApiKeysForAgency } from './services/agency-integration';

const apiKeys = await getApiKeysForAgency(supabaseDB2, 'agency-id-456');

if (apiKeys?.myhomeApiKey) {
  // Pošli property na MyHome
  await sendToMyHome(propertyData, {
    apiKey: apiKeys.myhomeApiKey,
    groupId: apiKeys.myhomeGroupId
  });
}
```

### 4. Zistiť všetky agentúry s API kľúčmi

```typescript
import {
  getAgenciesWithDaftKeys,
  getAgenciesWithMyhomeKeys
} from './services/agency-api-keys';

// Agentúry s Daft API
const daftAgencies = getAgenciesWithDaftKeys();
console.log(`${daftAgencies.length} agencies with Daft API`);

// Agentúry s MyHome API
const myhomeAgencies = getAgenciesWithMyhomeKeys();
console.log(`${myhomeAgencies.length} agencies with MyHome API`);
```

### 5. Kontrola či má agentúra API kľúč

```typescript
import { hasValidDaftKey, hasValidMyhomeKey } from './services/agency-integration';

if (hasValidDaftKey('Ray Maher Property Service')) {
  console.log('Agency has Daft API key');
}

if (hasValidMyhomeKey("O'Farrell Cleere")) {
  console.log('Agency has MyHome API key');
}
```

### 6. Získať všetky agentúry z DB2 s ich API kľúčmi

```typescript
import { getAllAgenciesWithApiKeys } from './services/agency-integration';

const agencies = await getAllAgenciesWithApiKeys(supabaseDB2);

agencies.forEach(agency => {
  console.log(`Agency: ${agency.agencyName}`);
  console.log(`  Daft: ${agency.daftApiKey ? 'YES' : 'NO'}`);
  console.log(`  MyHome: ${agency.myhomeApiKey ? 'YES' : 'NO'}`);
});
```

## Matching logika

System sa snaží nájsť zhodu v tomto poradí:

1. **Exact match** - presná zhoda `Name` alebo `OfficeName`
2. **Partial match** - čiastočná zhoda v názve
3. **Case-insensitive** - ignoruje veľké/malé písmená

## Príklad workflow

```typescript
// 1. Získaj property z DB1
const { data: property } = await supabaseDB1
  .from('properties')
  .select('*')
  .eq('id', propertyId)
  .single();

// 2. Získaj API kľúče pre agentúru
const apiKeys = getAgencyApiKeys(property.agency_name);

// 3. Odošli na portály
if (apiKeys.daftApiKey) {
  await fetch('https://api.daft.ie/v1/properties', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKeys.daftApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(propertyData)
  });
}

if (apiKeys.myhomeApiKey) {
  await fetch(`https://api.myhome.ie/api/properties?GroupID=${apiKeys.myhomeGroupId}`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKeys.myhomeApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(propertyData)
  });
}
```

## Pridanie plného JSON súboru

Ak chceš načítať všetky agentúry (nie len prvých 6), nahraď obsah `src/data/agencies.json` kompletným JSON súborom.

## Notes

- Niektoré agentúry majú len Daft API kľúč
- Niektoré agentúry majú len MyHome API kľúč
- Niektoré agentúry majú oba API kľúče
- Niektoré agentúry nemajú žiadny API kľúč
