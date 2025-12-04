import { createClient } from '@supabase/supabase-js';
import type { Property, SearchResults } from '../types';

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

// Diagnostika databází při startu
export async function diagnosticDatabases() {
    console.log('═══════════════════════════════════════');
    console.log('🔧 DIAGNOSTIKA DATABÁZÍ');
    console.log('═══════════════════════════════════════');

    // DB1
    const { data: agencies1, error: error1 } = await supabase1
        .from('agencies')
        .select('id, name')
        .limit(10);

    const { count: propertiesCount1 } = await supabase1
        .from('properties')
        .select('*', { count: 'exact', head: true });

    console.log('DB1 (izuvblxr):');
    console.log(`  Agencies: ${agencies1?.length || 0}`);
    if (agencies1 && agencies1.length > 0) {
        console.log('  Dostupné agencies:', agencies1.map(a => a.name).join(', '));
    }
    console.log(`  Properties: ${propertiesCount1 || 0}`);
    if (error1) console.error('  ❌ Chyba:', error1);

    // DB2
    const { data: agencies2, error: error2 } = await supabase2
        .from('agencies')
        .select('id, name')
        .limit(10);

    const { count: propertiesCount2 } = await supabase2
        .from('properties')
        .select('*', { count: 'exact', head: true });

    console.log('\nDB2 (ywmryhzp):');
    console.log(`  Agencies: ${agencies2?.length || 0}`);
    if (agencies2 && agencies2.length > 0) {
        console.log('  Dostupné agencies:', agencies2.map(a => a.name).join(', '));
    }
    console.log(`  Properties: ${propertiesCount2 || 0}`);
    if (error2) console.error('  ❌ Chyba:', error2);

    console.log('═══════════════════════════════════════\n');
}

// Helper funkce pro vyhledávání v jedné databázi
async function searchInDatabase(client: any, query: string, filters?: any, dbName: string = 'DB') {
    console.log(`🔍 ${dbName}: Začínám hledání pro "${query}"`);

    let queryBuilder = client
        .from('properties')
        .select(`
            *,
            agency:agencies(*)
        `);

    // Apply search - including agency name search
    if (query) {
        // Search by agency name first
        const { data: agenciesData, error: agencyError } = await client
            .from('agencies')
            .select('id, name')
            .ilike('name', `%${query}%`);

        console.log(`📋 ${dbName}: Našel jsem ${agenciesData?.length || 0} agencies s názvem obsahujícím "${query}"`);
        if (agenciesData && agenciesData.length > 0) {
            console.log(`📋 ${dbName}: Agency IDs:`, agenciesData.map((a: any) => `${a.name} (${a.id})`));
        }
        if (agencyError) {
            console.error(`❌ ${dbName}: Chyba při hledání agencies:`, agencyError);
        }

        // Build OR condition including agency search
        const orConditions = [
            `title.ilike.%${query}%`,
            `address.ilike.%${query}%`,
            `eircode.ilike.%${query}%`
        ];

        if (agenciesData && agenciesData.length > 0) {
            const agencyIds = agenciesData.map((a: any) => a.id);
            orConditions.push(`agency_id.in.(${agencyIds.join(',')})`);
        }

        queryBuilder = queryBuilder.or(orConditions.join(','));
        console.log(`🔍 ${dbName}: OR podmínky:`, orConditions.join(' OR '));
    }

    // Apply filters
    if (filters) {
        if (filters.minPrice) queryBuilder = queryBuilder.gte('price', filters.minPrice);
        if (filters.maxPrice) queryBuilder = queryBuilder.lte('price', filters.maxPrice);
        if (filters.minBedrooms) queryBuilder = queryBuilder.gte('bedrooms', filters.minBedrooms);
        if (filters.maxBedrooms) queryBuilder = queryBuilder.lte('bedrooms', filters.maxBedrooms);
        if (filters.propertyType) queryBuilder = queryBuilder.eq('property_type', filters.propertyType);
        if (filters.location) queryBuilder = queryBuilder.ilike('address', `%${filters.location}%`);
    }

    const result = await queryBuilder;
    console.log(`✅ ${dbName}: Výsledek - našel ${result.data?.length || 0} nemovitostí`);
    if (result.error) {
        console.error(`❌ ${dbName}: Chyba při hledání properties:`, result.error);
    }

    return result;
}

export async function searchPropertiesFromDB(query: string, filters?: any): Promise<SearchResults> {
    try {
        console.log('═══════════════════════════════════════');
        console.log(`🔍 ZAČÁTEK HLEDÁNÍ: "${query}"`);
        console.log('═══════════════════════════════════════');

        // Hledáme v OBOU databázích současně
        const [result1, result2] = await Promise.all([
            searchInDatabase(supabase1, query, filters, 'DB1 (izuvblxr)'),
            searchInDatabase(supabase2, query, filters, 'DB2 (ywmryhzp)')
        ]);

        // Sloučíme data z obou databází
        const allData = [
            ...(result1.data || []),
            ...(result2.data || [])
        ];

        // Logování pro debug
        console.log('───────────────────────────────────────');
        console.log(`📊 VÝSLEDKY HLEDÁNÍ:`);
        console.log(`   DB1 (izuvblxr): ${result1.data?.length || 0} nemovitostí`);
        console.log(`   DB2 (ywmryhzp): ${result2.data?.length || 0} nemovitostí`);
        console.log(`   ✅ CELKEM: ${allData.length} nemovitostí`);
        console.log('═══════════════════════════════════════');

        if (result1.error) console.error('❌ DB1 chyba:', result1.error);
        if (result2.error) console.error('❌ DB2 chyba:', result2.error);

        if (allData.length === 0) {
            return { query, properties: [], agencies: [], sources: { daft: 0, myhome: 0, wordpress: 0, others: 0 } };
        }

        // Transform data to match our types
        const properties: Property[] = allData.map((item: any) => ({
            id: item.id,
            title: item.title,
            address: item.address,
            eircode: item.eircode,
            price: item.price,
            bedrooms: item.bedrooms,
            bathrooms: item.bathrooms,
            propertyType: item.property_type,
            description: item.description || '',
            images: item.images || [],
            coordinates: item.coordinates ? {
                lat: item.coordinates.lat || item.latitude,
                lng: item.coordinates.lng || item.longitude
            } : undefined,
            agency: item.agency || {
                id: 'unknown',
                name: 'Unknown Agency',
                address: '',
            },
            sources: item.sources || []
        }));

        const agencies = Array.from(new Set(properties.map(p => p.agency)));

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
