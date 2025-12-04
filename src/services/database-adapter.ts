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
            propertiesTable: 'property_log',
            agenciesTable: 'agency_list',
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
        }
    ];

    for (const schema of possibleSchemas) {
        const { data, error } = await client
            .from(schema.propertiesTable)
            .select('*')
            .limit(1);

        if (!error && data !== null) {
            return schema;
        }
    }

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
        .select(`
            *,
            agency:${schema.agenciesTable}(*)
        `);

    if (query) {
        const { data: agenciesData } = await client
            .from(schema.agenciesTable)
            .select(`${schema.columnMapping.agencies.id}, ${schema.columnMapping.agencies.name}`)
            .ilike(schema.columnMapping.agencies.name, `%${query}%`);

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

        if (agenciesData && agenciesData.length > 0) {
            const agencyIds = agenciesData.map((a: any) => a[schema.columnMapping.agencies.id]);
            orConditions.push(`${cols.agencyId}.in.(${agencyIds.join(',')})`);
        }

        if (orConditions.length > 0) {
            queryBuilder = queryBuilder.or(orConditions.join(','));
        }
    }

    if (filters) {
        if (filters.minPrice) queryBuilder = queryBuilder.gte(cols.price, filters.minPrice);
        if (filters.maxPrice) queryBuilder = queryBuilder.lte(cols.price, filters.maxPrice);
        if (filters.minBedrooms) queryBuilder = queryBuilder.gte(cols.bedrooms, filters.minBedrooms);
        if (filters.maxBedrooms) queryBuilder = queryBuilder.lte(cols.bedrooms, filters.maxBedrooms);
        if (filters.propertyType) queryBuilder = queryBuilder.eq(cols.propertyType, filters.propertyType);
        if (filters.location) queryBuilder = queryBuilder.ilike(cols.address, `%${filters.location}%`);
    }

    return await queryBuilder;
}

export function transformToProperty(item: any, schema: DatabaseSchema): Property {
    const cols = schema.columnMapping.properties;

    return {
        id: item[cols.id],
        title: item[cols.title] || 'Untitled Property',
        address: item[cols.address] || '',
        eircode: cols.eircode ? item[cols.eircode] : undefined,
        price: Number(item[cols.price]) || 0,
        bedrooms: Number(item[cols.bedrooms]) || 0,
        bathrooms: Number(item[cols.bathrooms]) || 0,
        propertyType: item[cols.propertyType] || 'Unknown',
        description: cols.description ? (item[cols.description] || '') : '',
        images: cols.images ? (item[cols.images] || []) : [],
        coordinates: (cols.latitude && cols.longitude && item[cols.latitude] && item[cols.longitude]) ? {
            lat: Number(item[cols.latitude]),
            lng: Number(item[cols.longitude])
        } : undefined,
        agency: item.agency || {
            id: 'unknown',
            name: 'Unknown Agency',
            address: '',
        },
        sources: cols.sources ? (item[cols.sources] || []) : []
    };
}
