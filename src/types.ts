export type AppState = 'sphere' | 'searching' | 'results' | 'agency-detail' | 'property-detail';

export type Source = 'daft' | 'myhome' | 'wordpress' | 'others';

export interface SearchFilters {
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    propertyType?: string;
    location?: string;
}

export interface Agency {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
}

export interface Property {
    id: string;
    title: string;
    address: string;
    eircode?: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
    description: string;
    images: string[];
    agency: Agency;
    sources: PropertySource[];
    coordinates?: {
        lat: number;
        lng: number;
    };
}

export interface PropertySource {
    source: Source;
    url: string;
    price: number;
    lastUpdated: string;
    description?: string;
    images?: string[];
}

export interface SearchResults {
    query: string;
    agencies: Agency[];
    properties: Property[];
    sources: {
        daft: number;
        myhome: number;
        wordpress: number;
        others: number;
    };
}

export interface PropertyDelta {
    field: string;
    values: {
        source: Source;
        value: string | number;
    }[];
    hasDifference: boolean;
}
