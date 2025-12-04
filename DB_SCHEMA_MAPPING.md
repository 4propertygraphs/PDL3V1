# 🗺️ Mapování schémat databází

## 📊 Přehled databází

### DB1: izuvblxrwtmeiywwzufp (Standardní schéma)
```
Tabulka: properties
- id (uuid)
- title (text) ← název nemovitosti
- address (text)
- price (numeric)
- bedrooms (int)
- bathrooms (int)
- property_type (text)
- agency_id (uuid) ← foreign key na agencies.id

Tabulka: agencies
- id (uuid)
- name (text) ← např. "CKP"
- address (text)
- phone (text)
- email (text)
```

### DB2: ywmryhzpojfrmrxgggoy (Daft Scraper schéma)
```
Tabulka: daft_properties
- id (int)
- agency_name (text) ← PŘÍMO TEXT, ne foreign key!
- address1 (text)
- price (numeric)
- house_bedrooms (int)
- house_bathrooms (int)
- property_type (text)
- images (array)
- sources (jsonb) ← ['daft', 'wordpress', 'myhome']
```

## 🔄 Jak aplikace mapuje sloupce

### Při hledání "CKP"

**DB1:**
```sql
SELECT * FROM properties p
LEFT JOIN agencies a ON p.agency_id = a.id
WHERE a.name ILIKE '%CKP%'
   OR p.title ILIKE '%CKP%'
   OR p.address ILIKE '%CKP%'
```

**DB2:**
```sql
SELECT * FROM daft_properties
WHERE agency_name ILIKE '%CKP%'
   OR address1 ILIKE '%CKP%'
```

### Transformace do jednotného formátu

**Z DB1:**
```javascript
{
  id: row.id,
  title: row.title,                    // "Luxury Apartment Dublin 4"
  address: row.address,                // "Ballsbridge, Dublin 4"
  price: row.price,
  bedrooms: row.bedrooms,
  bathrooms: row.bathrooms,
  propertyType: row.property_type,
  agency: {
    id: row.agency.id,
    name: row.agency.name              // "CKP"
  }
}
```

**Z DB2:**
```javascript
{
  id: row.id,
  title: `Property by ${row.agency_name}`,  // "Property by Blue Sky"
  address: row.address1,                     // "Anne Street, Newbridge"
  price: row.price,
  bedrooms: row.house_bedrooms,
  bathrooms: row.house_bathrooms,
  propertyType: row.property_type,
  agency: {
    id: row.agency_name.toLowerCase().replace(/\s+/g, '-'),  // "blue-sky"
    name: row.agency_name                    // "Blue Sky"
  }
}
```

## 🎯 Klíčové rozdíly

| Vlastnost | DB1 | DB2 |
|-----------|-----|-----|
| **Agency vztah** | Foreign key | Text field |
| **Title sloupec** | `title` | N/A (generuje se) |
| **Address sloupec** | `address` | `address1` |
| **Bedrooms sloupec** | `bedrooms` | `house_bedrooms` |
| **Bathrooms sloupec** | `bathrooms` | `house_bathrooms` |
| **JOIN potřeba** | Ano (properties ⟷ agencies) | Ne |

## 🔍 Příklad vyhledávání

Když uživatel zadá "CKP":

1. **Detekce schémat**
   ```
   DB1: Detekováno 'properties' + 'agencies' schéma
   DB2: Detekováno 'daft_properties' schéma
   ```

2. **Paralelní dotazy**
   ```
   DB1: Hledá v properties.title, agencies.name, properties.address
   DB2: Hledá v daft_properties.agency_name, daft_properties.address1
   ```

3. **Sloučení výsledků**
   ```
   DB1: 3 nemovitosti
   DB2: 5 nemovitostí
   CELKEM: 8 nemovitostí
   ```

## 🛠️ Přidání dalšího schématu

Pokud máte databázi s jiným schématem, přidejte ho do `src/services/database-adapter.ts`:

```typescript
{
    propertiesTable: 'your_table_name',
    agenciesTable: 'your_agencies_table',
    columnMapping: {
        properties: {
            id: 'id',
            title: 'your_title_column',        // nebo použijte 'agency_name' pokud title neexistuje
            address: 'your_address_column',
            price: 'your_price_column',
            bedrooms: 'your_bedrooms_column',
            bathrooms: 'your_bathrooms_column',
            propertyType: 'your_type_column',
            agencyId: 'your_agency_column',    // může být ID nebo TEXT
            // ... ostatní sloupce
        },
        agencies: {
            id: 'id',
            name: 'name',
            // ...
        }
    }
}
```

## 💡 Tipy pro debugging

1. **Zkontroluj strukturu v konzoli**
   - Otevři Developer Console (F12)
   - Hned po načtení uvidíš všechny detekované tabulky a sloupce

2. **Sleduj vyhledávání**
   - Při každém vyhledávání uvidíš:
     - Které schéma se použilo
     - Kolik výsledků vrátila každá DB
     - Případné chyby

3. **Testuj s konkrétními agency**
   - Pro DB1: Zkus "CKP" (má foreign key vztah)
   - Pro DB2: Zkus "Blue Sky" (text v agency_name)

## ✅ Výhody tohoto řešení

1. **Flexibilní** - funguje s různými strukturami
2. **Automatické** - detekuje schéma při startu
3. **Robustní** - pokračuje i když jedna DB selže
4. **Snadné rozšíření** - stačí přidat nové schéma do pole
5. **Jednotný výstup** - všechny výsledky mají stejný formát
