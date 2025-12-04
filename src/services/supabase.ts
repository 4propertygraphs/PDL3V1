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

// Helper funkce pro vyhledávání v jedné databázi
async function searchInDatabase(client: any, query: string, filters?: any) {
    let queryBuilder = client
        .from('properties')
        .select(`
            *,
            agency:agencies(*)
        `);

    // Apply search - including agency name search
    if (query) {
        // Search by agency name first
        const { data: agenciesData } = await client
            .from('agencies')
            .select('id')
            .ilike('name', `%${query}%`);

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

    return await queryBuilder;
}

export async function searchPropertiesFromDB(query: string, filters?: any): Promise<SearchResults> {
    try {
        // Hledáme v OBOU databázích současně
        const [result1, result2] = await Promise.all([
            searchInDatabase(supabase1, query, filters),
            searchInDatabase(supabase2, query, filters)
        ]);

        // Sloučíme data z obou databází
        const allData = [
            ...(result1.data || []),
            ...(result2.data || [])
        ];

        // Logování pro debug
        console.log(`🔍 Hledání: "${query}"`);
        console.log(`📊 DB1 našla: ${result1.data?.length || 0} nemovitostí`);
        console.log(`📊 DB2 našla: ${result2.data?.length || 0} nemovitostí`);
        console.log(`✅ Celkem: ${allData.length} nemovitostí`);

        if (result1.error) console.error('DB1 chyba:', result1.error);
        if (result2.error) console.error('DB2 chyba:', result2.error);

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
