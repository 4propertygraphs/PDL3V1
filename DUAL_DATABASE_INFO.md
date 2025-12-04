# 🔍 Vyhledávání ve DVOU databázích současně

Aplikace nyní hledá v **OBOU Supabase databázích** najednou a sloučí výsledky!

## 📊 Připojené databáze:

### Databáze 1
- **URL**: https://izuvblxrwtmeiywwzufp.supabase.co
- **Klíč**: Nastaven v `.env` jako `VITE_SUPABASE_KEY_1`

### Databáze 2
- **URL**: https://ywmryhzpojfrmrxgggoy.supabase.co
- **Klíč**: Nastaven v `.env` jako `VITE_SUPABASE_KEY_2`

## 🚀 Jak to funguje:

### 1. Uživatel napíše např. "CKP"

### 2. Aplikace současně hledá v OBOU databázích:
```typescript
const [result1, result2] = await Promise.all([
    searchInDatabase(supabase1, "CKP", filters),
    searchInDatabase(supabase2, "CKP", filters)
]);
```

### 3. Sloučí výsledky z obou databází:
```typescript
const allData = [
    ...(result1.data || []),
    ...(result2.data || [])
];
```

### 4. Zobrazí všechny nemovitosti z obou databází

## 📝 Console výstup:

Když hledáte, v konzoli uvidíte:
```
🔍 Hledání: "CKP"
📊 DB1 našla: 3 nemovitostí
📊 DB2 našla: 2 nemovitostí
✅ Celkem: 5 nemovitostí
```

## ✅ Výhody:

1. **Rychlé** - paralelní dotazy (Promise.all)
2. **Kompletní** - najde všechny nemovitosti z obou databází
3. **Jednoduché** - uživatel vidí jen jeden seznam
4. **Debug** - console.log ukazuje, co našla každá databáze

## 🔧 Přidání třetí databáze:

Stačí přidat do `.env`:
```env
VITE_SUPABASE_URL_3=https://...
VITE_SUPABASE_KEY_3=...
```

A do `services/supabase.ts`:
```typescript
export const supabase3 = createClient(supabaseUrl3, supabaseKey3);

// V searchPropertiesFromDB:
const [result1, result2, result3] = await Promise.all([
    searchInDatabase(supabase1, query, filters),
    searchInDatabase(supabase2, query, filters),
    searchInDatabase(supabase3, query, filters)
]);
```

## 🎯 Testování:

1. Otevřete Developer Console (F12)
2. Napište do vyhledávání "CKP" nebo "Dublin"
3. Sledujte console.log - uvidíte počty z každé databáze
4. Aplikace zobrazí sloučené výsledky

---

**Aplikace je připravena na produkci! 🚀**
