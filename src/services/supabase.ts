import { createClient } from '@supabase/supabase-js';
import type { Property, SearchResults } from '../types';
import { detectSchema, searchWithSchema, transformToProperty, type DatabaseSchema } from './database-adapter';

// První Supabase databáze
const supabaseUrl1 = import.meta.env.VITE_SUPABASE_URL_1 || 'https://izuvblxrwtmeiywwzufp.supabase.co';
const supabaseKey1 = import.meta.env.VITE_SUPABASE_KEY_1 || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dXZibHhyd3RtZWl5d3d6dWZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzExOTgsImV4cCI6MjA3ODcwNzE5OH0.k1lujSoBRfDQvpW8RhNwtkMN6vHJaJMmvVo5M8GMopA';

// Druhá Supabase databáze
const supabaseUrl2 = import.meta.env.VITE_SUPABASE_URL_2 || 'https://ywmryhzpojfrmrxgggoy.supabase.co';
const supabaseKey2 = import.meta.env.VITE_SUPABASE_KEY_2 || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bXJ5aHpwb2pmcm1yeGdnZ295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzg3NjUsImV4cCI6MjA3OTgxNDc2NX0.nXq6K7lRlGwMk2YLpta6CKPCFw2mz-hvY_crMkxDXjA';

export const supabase1 = createClient(supabaseUrl1, supabaseKey1);
export const supabase2 = createClient(supabaseUrl2, supabaseKey2);

// Pro zpětnou kompatibilitu
export const supabase = supabase1;

// Cache pro detekovaná schémata
let db1Schema: DatabaseSchema | null = null;
let db2Schema: DatabaseSchema | null = null;

// Pomocná funkce pro zjištění struktury databáze
async function detectDatabaseStructure(client: any, dbName: string) {
    console.log(`\n🔍 Zjišťuji strukturu ${dbName}...`);

    // Zkusíme různé možné názvy tabulek
    const possibleTables = [
        'properties', 'property', 'property_log', 'listings',
        'agencies', 'agency', 'agency_list', 'agents'
    ];

    const foundTables: any = {};

    for (const tableName of possibleTables) {
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .limit(1);

        if (!error && data !== null) {
            foundTables[tableName] = data[0] ? Object.keys(data[0]) : [];
            console.log(`  ✅ Tabulka '${tableName}' existuje`);
            console.log(`     Sloupce:`, foundTables[tableName].join(', '));
        }
    }

    return foundTables;
}

// Diagnostika databází při startu
export async function diagnosticDatabases() {
    console.log('═══════════════════════════════════════');
    console.log('🔧 DIAGNOSTIKA DATABÁZÍ');
    console.log('═══════════════════════════════════════');

    const db1Structure = await detectDatabaseStructure(supabase1, 'DB1 (izuvblxr)');
    const db2Structure = await detectDatabaseStructure(supabase2, 'DB2 (ywmryhzp)');

    console.log('\n📊 SHRNUTÍ:');
    console.log('DB1 tabulky:', Object.keys(db1Structure).join(', ') || 'Žádné nenalezeny');
    console.log('DB2 tabulky:', Object.keys(db2Structure).join(', ') || 'Žádné nenalezeny');

    // Detekuj schémata
    console.log('\n🔍 Detekuji schémata...');
    db1Schema = await detectSchema(supabase1);
    db2Schema = await detectSchema(supabase2);

    if (db1Schema) {
        console.log(`✅ DB1: Používám tabulky '${db1Schema.propertiesTable}' a '${db1Schema.agenciesTable}'`);
    } else {
        console.log('❌ DB1: Nepodařilo se detekovat schéma');
    }

    if (db2Schema) {
        console.log(`✅ DB2: Používám tabulky '${db2Schema.propertiesTable}' a '${db2Schema.agenciesTable}'`);
    } else {
        console.log('❌ DB2: Nepodařilo se detekovat schéma');
    }

    console.log('═══════════════════════════════════════\n');

    return { db1: db1Structure, db2: db2Structure };
}

// Helper funkce pro vyhledávání v jedné databázi
async function searchInDatabase(
    client: any,
    query: string,
    filters?: any,
    dbName: string = 'DB',
    schema?: DatabaseSchema | null
) {
    console.log(`🔍 ${dbName}: Začínám hledání pro "${query}"`);

    if (!schema) {
        console.error(`❌ ${dbName}: Schéma není k dispozici`);
        return { data: null, error: { message: 'Schema not detected' } };
    }

    try {
        const result = await searchWithSchema(client, schema, query, filters);
        console.log(`✅ ${dbName}: Výsledek - našel ${result.data?.length || 0} nemovitostí`);
        if (result.error) {
            console.error(`❌ ${dbName}: Chyba při hledání:`, result.error);
        }
        return result;
    } catch (error) {
        console.error(`❌ ${dbName}: Výjimka při hledání:`, error);
        return { data: null, error };
    }
}

export async function searchPropertiesFromDB(query: string, filters?: any): Promise<SearchResults> {
    try {
        console.log('═══════════════════════════════════════');
        console.log(`🔍 ZAČÁTEK HLEDÁNÍ: "${query}"`);
        console.log('═══════════════════════════════════════');

        // Ujistíme se, že máme schémata
        if (!db1Schema) db1Schema = await detectSchema(supabase1);
        if (!db2Schema) db2Schema = await detectSchema(supabase2);

        // Hledáme v OBOU databázích současně
        const [result1, result2] = await Promise.all([
            searchInDatabase(supabase1, query, filters, 'DB1 (izuvblxr)', db1Schema),
            searchInDatabase(supabase2, query, filters, 'DB2 (ywmryhzp)', db2Schema)
        ]);

        // Sloučíme data z obou databází a transformujeme je
        const properties1 = (result1.data || []).map((item: any) =>
            db1Schema ? transformToProperty(item, db1Schema) : null
        ).filter(Boolean) as Property[];

        const properties2 = (result2.data || []).map((item: any) =>
            db2Schema ? transformToProperty(item, db2Schema) : null
        ).filter(Boolean) as Property[];

        const properties = [...properties1, ...properties2];

        // Logování pro debug
        console.log('───────────────────────────────────────');
        console.log(`📊 VÝSLEDKY HLEDÁNÍ:`);
        console.log(`   DB1 (izuvblxr): ${properties1.length} nemovitostí`);
        console.log(`   DB2 (ywmryhzp): ${properties2.length} nemovitostí`);
        console.log(`   ✅ CELKEM: ${properties.length} nemovitostí`);
        console.log('═══════════════════════════════════════');

        if (result1.error) console.error('❌ DB1 chyba:', result1.error);
        if (result2.error) console.error('❌ DB2 chyba:', result2.error);

        if (properties.length === 0) {
            return { query, properties: [], agencies: [], sources: { daft: 0, myhome: 0, wordpress: 0, others: 0 } };
        }

        const agencies = Array.from(
            new Map(properties.map(p => [p.agency.id, p.agency])).values()
        );

        const sources = {
            daft: 0,
            myhome: 0,
            wordpress: 0,
            others: 0
        };

        for (const prop of properties) {
            for (const src of prop.sources) {
                sources[src.source]++;
            }
        }

        return {
            query,
            properties,
            agencies,
            sources
        };
    } catch (error) {
        console.error('Search error:', error);
        return { query, properties: [], agencies: [], sources: { daft: 0, myhome: 0, wordpress: 0, others: 0 } };
    }
}

// Favorites management
export async function getFavorites(): Promise<string[]> {
    const favorites = localStorage.getItem('pdl3_favorites');
    return favorites ? JSON.parse(favorites) : [];
}

export async function addFavorite(propertyId: string): Promise<void> {
    const favorites = await getFavorites();
    if (!favorites.includes(propertyId)) {
        favorites.push(propertyId);
        localStorage.setItem('pdl3_favorites', JSON.stringify(favorites));
    }
}

export async function removeFavorite(propertyId: string): Promise<void> {
    const favorites = await getFavorites();
    const updated = favorites.filter(id => id !== propertyId);
    localStorage.setItem('pdl3_favorites', JSON.stringify(updated));
}

export async function isFavorite(propertyId: string): Promise<boolean> {
    const favorites = await getFavorites();
    return favorites.includes(propertyId);
}
