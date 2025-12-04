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

async function getAllTableNames(client: any): Promise<string[]> {
    try {
        const { data, error } = await client.from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');

        if (error) throw error;

        return (data || []).map((row: any) => row.table_name);
    } catch (error) {
        // Fallback: zkusíme common názvy
        const commonTables = [
            'properties', 'daft_properties', 'property_log',
            'agencies', 'agency_list'
        ];

        const foundTables: string[] = [];

        for (const table of commonTables) {
            try {
                const { data, error } = await client.from(table).select('*').limit(1);
                if (!error && data !== null) {
                    foundTables.push(table);
                }
            } catch (e) {
                // Tabulka neexistuje
            }
        }

        return foundTables;
    }
}

async function searchAgencyPropsTables(
    client: any,
    query: string,
    _filters: any
): Promise<Property[]> {
    try {
        console.log(`🔎 DB2: Hledám agency_props_* tabulky pro dotaz "${query}"...`);

        // Získáme všechny tabulky
        const allTables = await getAllTableNames(client);

        // Filtrujeme jen agency_props_* tabulky
        const agencyPropsTables = allTables.filter(t => t.startsWith('agency_props_'));

        console.log(`   📋 Celkem ${agencyPropsTables.length} agency_props_* tabulek`);

        if (agencyPropsTables.length === 0) {
            console.log(`   ℹ️  Žádné agency_props_* tabulky nenalezeny`);
            return [];
        }

        // Filtrujeme tabulky podle query (název tabulky obsahuje hledaný výraz)
        const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        const relevantTables = agencyPropsTables.filter((table: string) => {
            const tableName = table.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Hledáme shodu v názvu tabulky
            return tableName.includes(normalizedQuery) ||
                   normalizedQuery.split('').every((char, i) => {
                       // Pokud query je zkratka (např. "CKP"), hledáme tabulky začínající těmito písmeny
                       if (i === 0) return tableName.includes(char);
                       return true;
                   });
        });

        if (relevantTables.length === 0) {
            console.log(`   ℹ️  Žádná tabulka neodpovídá dotazu "${query}"`);
            console.log(`   💡 Dostupné tabulky:`, agencyPropsTables.slice(0, 5).join(', '), '...');
            return [];
        }

        console.log(`   ✅ Nalezeno ${relevantTables.length} relevantních tabulek:`, relevantTables.join(', '));

        // Prohledáme všechny relevantní tabulky paralelně
        const searchPromises = relevantTables.map(async (tableName: string) => {
            try {
                const { data, error } = await client
                    .from(tableName)
                    .select('*')
                    .limit(100);

                if (error) {
                    console.log(`   ⚠️  Chyba v tabulce ${tableName}:`, error.message);
                    return [];
                }

                // Extrahujeme název agentury z názvu tabulky
                const agencyName = extractAgencyNameFromTable(tableName);
                console.log(`   📦 ${tableName}: ${data?.length || 0} záznamů (${agencyName})`);

                return (data || []).map((item: any) => transformAgencyPropsToProperty(item, agencyName));
            } catch (err) {
                console.error(`   ❌ Chyba při čtení ${tableName}:`, err);
                return [];
            }
        });

        const results = await Promise.all(searchPromises);
        const allProperties = results.flat();

        console.log(`   ✅ DB2 agency_props: Celkem ${allProperties.length} nemovitostí`);

        return allProperties;
    } catch (error) {
        console.error('❌ Chyba při hledání v agency_props tabulkách:', error);
        return [];
    }
}

function extractAgencyNameFromTable(tableName: string): string {
    // Odstraníme prefix "agency_props_" a suffix (hash)
    const withoutPrefix = tableName.replace(/^agency_props_/, '');
    // Odstraníme hash na konci (pokud existuje)
    const withoutSuffix = withoutPrefix.replace(/_[a-f0-9]{5,}$/i, '');
    // Nahradíme podtržítka mezerami a upravíme kapitalizaci
    return withoutSuffix.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function transformAgencyPropsToProperty(item: any, agencyName: string): Property {
    return {
        id: item.id || item.unique_key || `${agencyName}-${Math.random()}`,
        title: item.title || item.name || `Property by ${agencyName}`,
        address: item.address || item.address1 || '',
        eircode: item.eircode,
        price: Number(item.price) || 0,
        bedrooms: Number(item.bedrooms || item.house_bedrooms) || 0,
        bathrooms: Number(item.bathrooms || item.house_bathrooms) || 0,
        propertyType: item.property_type || item.propertyType || 'Property',
        description: item.description || '',
        images: Array.isArray(item.images) ? item.images : (item.pics ? JSON.parse(item.pics) : []),
        coordinates: (item.latitude && item.longitude) ? {
            lat: Number(item.latitude),
            lng: Number(item.longitude)
        } : undefined,
        agency: {
            id: agencyName.toLowerCase().replace(/\s+/g, '-'),
            name: agencyName,
            address: '',
        },
        sources: Array.isArray(item.sources) ? item.sources : []
    };
}

async function searchListingsTables(
    client: any,
    query: string,
    _filters: any
): Promise<Property[]> {
    try {
        console.log(`🔎 DB2: Hledám v listings tabulkách pro dotaz "${query}"...`);

        const listingsTables = ['daft_listings', 'myhome_listings', 'wordpress_listings'];
        const normalizedQuery = query.toLowerCase();

        const searchPromises = listingsTables.map(async (tableName: string) => {
            try {
                const { data, error } = await client
                    .from(tableName)
                    .select('*')
                    .limit(100);

                if (error) {
                    console.log(`   ℹ️  Tabulka ${tableName} není dostupná nebo je prázdná`);
                    return [];
                }

                const source = tableName.replace('_listings', '');
                console.log(`   📦 ${tableName}: ${data?.length || 0} záznamů`);

                return (data || [])
                    .filter((item: any) => {
                        const searchableText = [
                            item.title,
                            item.address,
                            item.address1,
                            item.eircode,
                            item.description
                        ].filter(Boolean).join(' ').toLowerCase();

                        return searchableText.includes(normalizedQuery);
                    })
                    .map((item: any) => transformListingsToProperty(item, source));
            } catch (err) {
                console.log(`   ℹ️  Nepodařilo se načíst ${tableName}`);
                return [];
            }
        });

        const results = await Promise.all(searchPromises);
        const allProperties = results.flat();

        console.log(`   ✅ DB2 listings: Celkem ${allProperties.length} nemovitostí`);

        return allProperties;
    } catch (error) {
        console.error('❌ Chyba při hledání v listings tabulkách:', error);
        return [];
    }
}

function transformListingsToProperty(item: any, source: string): Property {
    const price = Number(item.price) || 0;
    const images = Array.isArray(item.images) ? item.images : (item.pics ? JSON.parse(item.pics) : []);

    return {
        id: item.id || item.unique_key || `${source}-${Math.random()}`,
        title: item.title || item.name || 'Property',
        address: item.address || item.address1 || '',
        eircode: item.eircode,
        price,
        bedrooms: Number(item.bedrooms || item.house_bedrooms) || 0,
        bathrooms: Number(item.bathrooms || item.house_bathrooms) || 0,
        propertyType: item.property_type || item.propertyType || 'Property',
        description: item.description || '',
        images,
        coordinates: (item.latitude && item.longitude) ? {
            lat: Number(item.latitude),
            lng: Number(item.longitude)
        } : undefined,
        agency: {
            id: item.agency_id || `${source}-agency`,
            name: item.agency_name || source.charAt(0).toUpperCase() + source.slice(1),
            address: item.agency_address || '',
        },
        sources: [{
            source: source as 'daft' | 'myhome' | 'wordpress' | 'others',
            url: item.url || '',
            price,
            lastUpdated: item.last_updated || item.updated_at || new Date().toISOString(),
            description: item.description,
            images
        }]
    };
}

export async function searchPropertiesFromDB(query: string, filters?: any): Promise<SearchResults> {
    try {
        console.log('═══════════════════════════════════════');
        console.log(`🔍 ZAČÁTEK HLEDÁNÍ: "${query}"`);
        console.log('═══════════════════════════════════════');

        // Ujistíme se, že máme schémata
        if (!db1Schema) db1Schema = await detectSchema(supabase1);
        if (!db2Schema) db2Schema = await detectSchema(supabase2);

        // DB1: Standardní hledání
        const result1 = await searchInDatabase(supabase1, query, filters, 'DB1 (izuvblxr)', db1Schema);

        // DB2: Hledáme ve všech zdrojích paralelně
        const [agencyPropsResults, listingsResults] = await Promise.all([
            searchAgencyPropsTables(supabase2, query, filters),
            searchListingsTables(supabase2, query, filters)
        ]);

        // Sloučíme data z obou databází a transformujeme je
        const properties1 = (result1.data || []).map((item: any) =>
            db1Schema ? transformToProperty(item, db1Schema) : null
        ).filter(Boolean) as Property[];

        const properties2 = [...agencyPropsResults, ...listingsResults];

        const properties = [...properties1, ...properties2];

        // Logování pro debug
        console.log('───────────────────────────────────────');
        console.log(`📊 VÝSLEDKY HLEDÁNÍ:`);
        console.log(`   DB1 (izuvblxr): ${properties1.length} nemovitostí`);
        console.log(`   DB2 (ywmryhzp):`);
        console.log(`      - agency_props: ${agencyPropsResults.length} nemovitostí`);
        console.log(`      - listings: ${listingsResults.length} nemovitostí`);
        console.log(`      - celkem: ${properties2.length} nemovitostí`);
        console.log(`   ✅ CELKEM: ${properties.length} nemovitostí`);
        console.log('═══════════════════════════════════════');

        if (result1.error) console.error('❌ DB1 chyba:', result1.error);

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
