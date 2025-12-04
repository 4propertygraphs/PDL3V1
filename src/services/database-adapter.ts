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
            office?: string;
            address?: string;
            phone?: string;
            email?: string;
            website?: string;
            logo?: string;
            uniqueKey?: string;
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
                    title: 'agency_name',
                    address: 'address',
                    eircode: '',
                    price: 'house_price',
                    bedrooms: 'beds',
                    bathrooms: 'house_bathrooms',
                    propertyType: 'type',
                    description: '',
                    images: 'pics',
                    latitude: '',
                    longitude: '',
                    agencyId: 'agency_id',
                    sources: 'source'
                },
                agencies: {
                    id: 'id',
                    name: 'name',
                    office: 'office_name',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'site',
                    logo: 'logo',
                    uniqueKey: 'unique_key'
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
                    office: 'office',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'website',
                    logo: 'logo',
                    uniqueKey: 'unique_key'
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
                    office: 'office',
                    address: 'address',
                    phone: 'phone',
                    email: 'email',
                    website: 'website',
                    logo: 'logo',
                    uniqueKey: 'unique_key'
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

        if (cols.title && cols.title !== '') {
            orConditions.push(`${cols.title}.ilike.%${query}%`);
        }
        if (cols.address && cols.address !== '') {
            orConditions.push(`${cols.address}.ilike.%${query}%`);
        }
        if (cols.eircode && cols.eircode !== '') {
            orConditions.push(`${cols.eircode}.ilike.%${query}%`);
        }

        if (orConditions.length > 0) {
            queryBuilder = queryBuilder.or(orConditions.join(','));
        }
    }

    if (filters) {
        if (filters.minPrice && cols.price && cols.price !== '') queryBuilder = queryBuilder.gte(cols.price, filters.minPrice);
        if (filters.maxPrice && cols.price && cols.price !== '') queryBuilder = queryBuilder.lte(cols.price, filters.maxPrice);
        if (filters.minBedrooms && cols.bedrooms && cols.bedrooms !== '') queryBuilder = queryBuilder.gte(cols.bedrooms, filters.minBedrooms);
        if (filters.maxBedrooms && cols.bedrooms && cols.bedrooms !== '') queryBuilder = queryBuilder.lte(cols.bedrooms, filters.maxBedrooms);
        if (filters.propertyType && cols.propertyType && cols.propertyType !== '') queryBuilder = queryBuilder.eq(cols.propertyType, filters.propertyType);
        if (filters.location && cols.address && cols.address !== '') queryBuilder = queryBuilder.ilike(cols.address, `%${filters.location}%`);
    }

    return await queryBuilder;
}

export function transformToProperty(item: any, schema: DatabaseSchema): Property {
    const cols = schema.columnMapping.properties;

    const agencyName = (cols.title && cols.title !== '' && item[cols.title]) ||
                       (cols.agencyId && cols.agencyId !== '' && item[cols.agencyId]) ||
                       'Unknown Agency';

    return {
        id: item[cols.id],
        title: (cols.title && cols.title !== '' && item[cols.title]) ?
               (cols.title === cols.agencyId ? `Property by ${agencyName}` : item[cols.title]) :
               'Untitled Property',
        address: (cols.address && cols.address !== '' ? item[cols.address] : '') || item.address1 || item.address || '',
        eircode: (cols.eircode && cols.eircode !== '' && item[cols.eircode]) ? item[cols.eircode] : undefined,
        price: Number((cols.price && cols.price !== '' ? item[cols.price] : null) || item.price || item.house_price) || 0,
        bedrooms: Number((cols.bedrooms && cols.bedrooms !== '' ? item[cols.bedrooms] : null) || item.house_bedrooms || item.bedrooms || item.beds) || 0,
        bathrooms: Number((cols.bathrooms && cols.bathrooms !== '' ? item[cols.bathrooms] : null) || item.house_bathrooms || item.bathrooms || item.baths) || 0,
        propertyType: (cols.propertyType && cols.propertyType !== '' ? item[cols.propertyType] : null) || item.property_type || item.type || 'Property',
        description: (cols.description && cols.description !== '' && item[cols.description]) ? item[cols.description] : (item.description || ''),
        images: (() => {
            // Try multiple possible image columns: images, pics, or fallback
            const rawImages = (cols.images && cols.images !== '' && item[cols.images])
                ? item[cols.images]
                : (item.images || item.pics || []);
            console.log('📸 Raw images for property:', { rawImages, type: typeof rawImages, hasImages: !!item.images, hasPics: !!item.pics });
            if (typeof rawImages === 'string') {
                try {
                    const parsed = JSON.parse(rawImages);
                    console.log('   Parsed as JSON:', parsed);
                    return parsed;
                } catch {
                    console.log('   Using as single URL');
                    return rawImages ? [rawImages] : [];
                }
            }
            console.log('   Using as array:', rawImages);
            return Array.isArray(rawImages) ? rawImages : [];
        })(),
        coordinates: (cols.latitude && cols.latitude !== '' && cols.longitude && cols.longitude !== '' && item[cols.latitude] && item[cols.longitude]) ? {
            lat: Number(item[cols.latitude]),
            lng: Number(item[cols.longitude])
        } : (item.latitude && item.longitude ? {
            lat: Number(item.latitude),
            lng: Number(item.longitude)
        } : undefined),
        agency: {
            id: String(agencyName).toLowerCase().replace(/\s+/g, '-'),
            name: String(agencyName),
            address: '',
        },
        sources: (() => {
            const rawSources = (cols.sources && cols.sources !== '' && item[cols.sources]) ? item[cols.sources] : (item.sources || []);
            if (typeof rawSources === 'string') {
                try {
                    return JSON.parse(rawSources);
                } catch {
                    return [];
                }
            }
            return Array.isArray(rawSources) ? rawSources : [];
        })()
    };
}
