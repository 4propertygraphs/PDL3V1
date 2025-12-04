import type { Property } from '../types';

export interface DatabaseSchema {
    propertiesTable: string;
    agenciesTable: string;
    columnMapping: {
        properties: {
            id: string;
            title: string;
            address: string;
            eircode?: string;
            price: string;
            bedrooms: string;
            bathrooms: string;
            propertyType: string;
            description?: string;
            images?: string;
            latitude?: string;
            longitude?: string;
            agencyId: string;
            sources?: string;
        };
        agencies: {
            id: string;
            name: string;
            address?: string;
            phone?: string;
            email?: string;
            website?: string;
        };
    };
}

export async function detectSchema(client: any): Promise<DatabaseSchema | null> {
    // Nejprve zjistíme, jaké sloupce skutečně existují
    console.log('🔍 Zjišťuji strukturu databáze...');
    const { data: testData, error: testError } = await client
        .from('properties')
        .select('*')
        .limit(1);

    if (!testError && testData && testData.length > 0) {
        const actualColumns = Object.keys(testData[0]);
        console.log('📋 Skutečné sloupce v tabulce properties:', actualColumns.join(', '));
    }

    const { data: agenciesTest, error: agenciesError } = await client
        .from('agencies')
        .select('*')
        .limit(1);

    if (!agenciesError && agenciesTest && agenciesTest.length > 0) {
        const actualColumns = Object.keys(agenciesTest[0]);
        console.log('📋 Skutečné sloupce v tabulce agencies:', actualColumns.join(', '));
    }

    const possibleSchemas: DatabaseSchema[] = [
        {
            propertiesTable: 'properties',
            agenciesTable: 'agencies',
            columnMapping: {
                properties: {
                    id: 'id',
                    title: 'title',
                    address: 'address',
                    eircode: 'eircode',
                    price: 'price',
                    bedrooms: 'bedrooms',
                    bathrooms: 'bathrooms',
                    propertyType: 'property_type',
                    description: 'description',
                    images: 'images',
                    latitude: 'latitude',
                    longitude: 'longitude',
                    agencyId: 'agency_id',
                    sources: 'sources'
                },
                agencies: {
                    id: 'id',
                    name: 'name',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'website'
                }
            }
        },
        {
            propertiesTable: 'daft_properties',
            agenciesTable: 'agencies',
            columnMapping: {
                properties: {
                    id: 'id',
                    title: 'agency_name',
                    address: 'address1',
                    eircode: 'eircode',
                    price: 'price',
                    bedrooms: 'house_bedrooms',
                    bathrooms: 'house_bathrooms',
                    propertyType: 'property_type',
                    description: 'description',
                    images: 'images',
                    latitude: 'latitude',
                    longitude: 'longitude',
                    agencyId: 'agency_name',
                    sources: 'sources'
                },
                agencies: {
                    id: 'id',
                    name: 'name',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'website'
                }
            }
        },
        {
            propertiesTable: 'property_log',
            agenciesTable: 'agency_list',
            columnMapping: {
                properties: {
                    id: 'id',
                    title: 'name',
                    address: 'address',
                    eircode: 'eircode',
                    price: 'price',
                    bedrooms: 'bedrooms',
                    bathrooms: 'bathrooms',
                    propertyType: 'property_type',
                    description: 'description',
                    images: 'images',
                    latitude: 'latitude',
                    longitude: 'longitude',
                    agencyId: 'agency_id',
                    sources: 'sources'
                },
                agencies: {
                    id: 'id',
                    name: 'name',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'website'
                }
            }
        }
    ];

    for (const schema of possibleSchemas) {
        const { data, error } = await client
            .from(schema.propertiesTable)
            .select('*')
            .limit(1);

        if (!error && data !== null && data.length > 0) {
            const row = data[0];
            const cols = schema.columnMapping.properties;
            const availableColumns = Object.keys(row);

            console.log(`🔍 Zkouším tabulku '${schema.propertiesTable}'`);
            console.log(`   Dostupné sloupce:`, availableColumns.join(', '));

            const hasRequiredColumns =
                row.hasOwnProperty(cols.id) &&
                row.hasOwnProperty(cols.address) &&
                (row.hasOwnProperty(cols.title) || row.hasOwnProperty(cols.agencyId));

            if (hasRequiredColumns) {
                console.log(`   ✅ Schéma odpovídá! Používám: ${schema.propertiesTable}`);
                console.log(`   Mapování:`, {
                    title: cols.title,
                    address: cols.address,
                    bedrooms: cols.bedrooms,
                    bathrooms: cols.bathrooms,
                    agencyId: cols.agencyId
                });
                return schema;
            } else {
                console.log(`   ❌ Chybí požadované sloupce`);
            }
        } else if (error) {
            console.log(`❌ Tabulka '${schema.propertiesTable}' neexistuje nebo je nepřístupná`);
        }
    }

    console.error('⚠️ Žádné schéma nebylo detekováno!');
    return null;
}

export async function searchWithSchema(
    client: any,
    schema: DatabaseSchema,
    query: string,
    filters?: any
): Promise<any> {
    const cols = schema.columnMapping.properties;

    let queryBuilder = client
        .from(schema.propertiesTable)
        .select('*')
        .limit(100);

    // Only apply query conditions if query is not wildcard
    if (query && query !== '*') {
        const orConditions = [];

        if (cols.title) {
            orConditions.push(`${cols.title}.ilike.%${query}%`);
        }
        if (cols.address) {
            orConditions.push(`${cols.address}.ilike.%${query}%`);
        }
        if (cols.eircode) {
            orConditions.push(`${cols.eircode}.ilike.%${query}%`);
        }

        if (cols.agencyId && cols.agencyId !== cols.title) {
            orConditions.push(`${cols.agencyId}.ilike.%${query}%`);
        }

        if (orConditions.length > 0) {
            queryBuilder = queryBuilder.or(orConditions.join(','));
        }
    }

    if (filters) {
        if (filters.minPrice && cols.price) queryBuilder = queryBuilder.gte(cols.price, filters.minPrice);
        if (filters.maxPrice && cols.price) queryBuilder = queryBuilder.lte(cols.price, filters.maxPrice);
        if (filters.minBedrooms && cols.bedrooms) queryBuilder = queryBuilder.gte(cols.bedrooms, filters.minBedrooms);
        if (filters.maxBedrooms && cols.bedrooms) queryBuilder = queryBuilder.lte(cols.bedrooms, filters.maxBedrooms);
        if (filters.propertyType && cols.propertyType) queryBuilder = queryBuilder.eq(cols.propertyType, filters.propertyType);
        if (filters.location && cols.address) queryBuilder = queryBuilder.ilike(cols.address, `%${filters.location}%`);
    }

    return await queryBuilder;
}

export function transformToProperty(item: any, schema: DatabaseSchema): Property {
    const cols = schema.columnMapping.properties;

    const agencyName = item[cols.agencyId] || item[cols.title] || 'Unknown Agency';

    return {
        id: item[cols.id],
        title: (cols.title === cols.agencyId ? `Property by ${agencyName}` : (item[cols.title] || 'Untitled Property')),
        address: item[cols.address] || item.address1 || item.address || '',
        eircode: cols.eircode ? item[cols.eircode] : undefined,
        price: Number(item[cols.price] || item.price) || 0,
        bedrooms: Number(item[cols.bedrooms] || item.house_bedrooms || item.bedrooms) || 0,
        bathrooms: Number(item[cols.bathrooms] || item.house_bathrooms || item.bathrooms) || 0,
        propertyType: item[cols.propertyType] || item.property_type || 'Property',
        description: cols.description ? (item[cols.description] || item.description || '') : '',
        images: cols.images ? (item[cols.images] || item.images || []) : [],
        coordinates: (cols.latitude && cols.longitude && item[cols.latitude] && item[cols.longitude]) ? {
            lat: Number(item[cols.latitude]),
            lng: Number(item[cols.longitude])
        } : (item.latitude && item.longitude ? {
            lat: Number(item.latitude),
            lng: Number(item.longitude)
        } : undefined),
        agency: {
            id: agencyName.toLowerCase().replace(/\s+/g, '-'),
            name: agencyName,
            address: '',
        },
        sources: cols.sources ? (item[cols.sources] || item.sources || []) : []
    };
}
