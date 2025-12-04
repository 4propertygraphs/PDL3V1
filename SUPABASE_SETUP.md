# Supabase Setup pro PDL3 Property Search

## 1. Přihlášení do Supabase

Jděte na: https://ywmryhzpojfrmrxgggoy.supabase.co

## 2. Vytvoření tabulek

Otevřete **SQL Editor** a spusťte SQL z `supabase-schema.sql`:

```sql
-- Viz soubor supabase-schema.sql pro kompletní SQL
```

## 3. Získání API klíče

1. Jděte na **Settings** → **API**
2. Zkopírujte **anon public** klíč
3. Přidejte do `.env`:

```env
VITE_SUPABASE_KEY=váš_anon_klíč_zde
```

## 4. Přidání dat pro CKP

V SQL Editoru přidejte CKP agenturu a jejich nemovitosti:

```sql
-- Vložit CKP agenturu
INSERT INTO agencies (name, address, phone, email, website) VALUES
(
    'CKP',
    'Adresa CKP',
    '+353 XXX XXXX',
    'info@ckp.ie',
    'https://ckp.ie'
);

-- Vložit CKP nemovitosti
INSERT INTO properties (
    title,
    address,
    eircode,
    price,
    bedrooms,
    bathrooms,
    property_type,
    description,
    images,
    latitude,
    longitude,
    agency_id,
    sources
) VALUES
(
    'Název nemovitosti CKP',
    'Adresa nemovitosti',
    'D02 XXXX',
    450000,
    2,
    1,
    'Apartment',
    'Popis nemovitosti od CKP',
    ARRAY['https://images.unsplash.com/photo-example.jpg'],
    53.3498,
    -6.2603,
    (SELECT id FROM agencies WHERE name = 'CKP' LIMIT 1),
    '[{"source": "daft", "url": "https://daft.ie/property-ckp", "price": 450000, "lastUpdated": "2024-12-04"}]'::jsonb
);
```

## 5. Vyhledávání

Po nastavení databáze můžete vyhledávat:

- **"CKP"** - najde všechny nemovitosti od CKP agentury
- **"Dublin"** - najde všechny nemovitosti v Dublinu
- **"D02"** - najde podle Eircode
- **"apartment"** - najde apartmány

## 6. Restart aplikace

Po přidání API klíče restartujte dev server:

```bash
cd particle-sphere
bun run dev
```

## Poznámky

- Aplikace nyní načítá **POUZE** data z Supabase databáze
- Žádná mock data nejsou použita
- GPT-5 AI analyzuje dotazy a automaticky extrahuje filtry
