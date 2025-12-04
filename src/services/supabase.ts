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

// Cache pro detekované schéma
let dbSchema: DatabaseSchema | null = null;

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

// Diagnostika databáze při startu
export async function diagnosticDatabases() {
    console.log('═══════════════════════════════════════');
    console.log('🔧 DIAGNOSTIKA DATABÁZE');
    console.log('═══════════════════════════════════════');

    const dbStructure = await detectDatabaseStructure(supabase2, 'DB (ywmryhzp)');

    console.log('\n📊 SHRNUTÍ:');
    console.log('DB (ywmryhzp) tabulky:', Object.keys(dbStructure).join(', ') || 'Žádné nenalezeny');
    console.log('   → Očekávám: agencies, properties');

    // Detekuj schéma
    console.log('\n🔍 Detekuji schéma...');
    dbSchema = await detectSchema(supabase2);

    if (dbSchema) {
        console.log(`✅ DB: Používám tabulky '${dbSchema.propertiesTable}' a '${dbSchema.agenciesTable}'`);
    } else {
        console.log('❌ DB: Nepodařilo se detekovat schéma');
    }

    console.log('═══════════════════════════════════════\n');

    return { db: dbStructure };
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

        // Ujistíme se, že máme schéma
        if (!dbSchema) dbSchema = await detectSchema(supabase2);

        // If query is empty or "*", get all data
        const isGetAll = !query || query.trim() === '' || query.trim() === '*';

        // Hledáme v DB (ywmryhzp) - tabulky properties a agencies
        const result = await searchInDatabase(supabase2, isGetAll ? '*' : query, filters, 'DB (ywmryhzp)', dbSchema);

        // Transformujeme data
        const properties = (result.data || []).map((item: any) =>
            dbSchema ? transformToProperty(item, dbSchema) : null
        ).filter(Boolean) as Property[];

        // Logování pro debug
        console.log('───────────────────────────────────────');
        console.log(`📊 VÝSLEDKY HLEDÁNÍ:`);
        console.log(`   DB (ywmryhzp): ${properties.length} nemovitostí`);
        console.log('═══════════════════════════════════════');

        if (result.error) console.error('❌ Chyba:', result.error);

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
