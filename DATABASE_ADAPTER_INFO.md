# 🔧 Automatická detekce schématu databáze

Aplikace nyní **automaticky detekuje strukturu obou databází** a přizpůsobí se různým názvům tabulek a sloupců!

## 🎯 Řešený problém

Různé databáze mohou mít:
- Různé názvy tabulek (`properties` vs `property_log`, `agencies` vs `agency_list`)
- Různé názvy sloupců (`title` vs `name`, `property_type` vs `type`)
- Různé struktury dat

## ✨ Jak to funguje

### 1. Automatická detekce při startu

Při načtení aplikace se automaticky:
```javascript
diagnosticDatabases()
```

To provede:
1. **Detekci struktury** - zjistí, jaké tabulky existují
2. **Detekci schématu** - najde správné názvy tabulek a sloupců
3. **Cache schémat** - uloží je pro další použití

### 2. Flexibilní vyhledávání

Při vyhledávání aplikace:
1. Použije správné názvy tabulek pro každou databázi
2. Mapuje sloupce na standardní formát
3. Transformuje výsledky do jednotného formátu

### 3. Podporovaná schémata

Aplikace podporuje tyto varianty:

**Standardní schéma (DB1):**
```sql
properties (title, address, price, bedrooms, bathrooms, property_type, agency_id)
agencies (id, name, address, phone, email)
-- agency_id je foreign key na agencies.id
```

**Daft/Scraper schéma (DB2):**
```sql
daft_properties (agency_name, address1, price, house_bedrooms, house_bathrooms)
-- agency_name je TEXT, ne foreign key!
-- Žádný JOIN na tabulku agencies
```

**Property Log schéma:**
```sql
property_log (title, address, price, bedrooms, ...)
agency_list (name, address, phone, ...)
```

## 📊 Konzolový výstup

### Při startu aplikace:
```
═══════════════════════════════════════
🔧 DIAGNOSTIKA DATABÁZÍ
═══════════════════════════════════════

🔍 Zjišťuji strukturu DB1 (izuvblxr)...
  ✅ Tabulka 'property_log' existuje
     Sloupce: id, title, address, price, ...
  ✅ Tabulka 'agency_list' existuje
     Sloupce: id, name, address, phone, ...

🔍 Zjišťuji strukturu DB2 (ywmryhzp)...
  ✅ Tabulka 'properties' existuje
     Sloupce: id, title, address, price, ...
  ✅ Tabulka 'agencies' existuje
     Sloupce: id, name, address, phone, ...

📊 SHRNUTÍ:
DB1 tabulky: property_log, agency_list
DB2 tabulky: properties, agencies

🔍 Detekuji schémata...
✅ DB1: Používám tabulky 'property_log' a 'agency_list'
✅ DB2: Používám tabulky 'properties' a 'agencies'
═══════════════════════════════════════
```

### Při vyhledávání:
```
═══════════════════════════════════════
🔍 ZAČÁTEK HLEDÁNÍ: "CKP"
═══════════════════════════════════════
🔍 DB1 (izuvblxr): Začínám hledání pro "CKP"
✅ DB1 (izuvblxr): Výsledek - našel 3 nemovitostí
🔍 DB2 (ywmryhzp): Začínám hledání pro "CKP"
✅ DB2 (ywmryhzp): Výsledek - našel 2 nemovitostí
───────────────────────────────────────
📊 VÝSLEDKY HLEDÁNÍ:
   DB1 (izuvblxr): 3 nemovitostí
   DB2 (ywmryhzp): 2 nemovitostí
   ✅ CELKEM: 5 nemovitostí
═══════════════════════════════════════
```

## 🔧 Přidání nového schématu

Pokud máte databázi s jiným schématem, přidejte ho do `/src/services/database-adapter.ts`:

```typescript
const possibleSchemas: DatabaseSchema[] = [
    // ... existující schémata ...
    {
        propertiesTable: 'tvuj_nazev_tabulky',
        agenciesTable: 'tvuj_nazev_agencies',
        columnMapping: {
            properties: {
                id: 'id',
                title: 'nazev',  // jiný název sloupce
                address: 'adresa',
                // ...
            },
            agencies: {
                // ...
            }
        }
    }
];
```

## 🎨 Vizuální změny

### Zvětšený filtr panel
- **Před:** `max-width: 90vw`
- **Po:** `width: 95vw; max-width: 1400px`

Panel je nyní **širší a lépe čitelný** na velkých obrazovkách!

## 🚀 Výhody

1. ✅ **Automatická adaptace** - funguje s různými strukturami databází
2. ✅ **Žádné ruční nastavení** - vše se detekuje automaticky
3. ✅ **Detailní diagnostika** - vidíte přesně, co se děje
4. ✅ **Robustní** - funguje i když jedna databáze selže
5. ✅ **Rozšiřitelné** - snadno přidáte nová schémata

## 🐛 Řešení problémů

Pokud databáze nefunguje správně:

1. Otevřete Developer Console (F12)
2. Podívejte se na diagnostický výstup
3. Zkontrolujte:
   - Byly detekovány tabulky?
   - Bylo detekováno schéma?
   - Jaké chyby se zobrazují?

Pokud schéma není detekováno, přidejte novou variantu do `database-adapter.ts`.
