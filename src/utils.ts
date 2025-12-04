import type { Property, PropertyDelta } from './types';

export function calculatePropertyDeltas(property: Property): PropertyDelta[] {
    const deltas: PropertyDelta[] = [];

    // Compare prices
    const priceValues = property.sources.map(src => ({
        source: src.source,
        value: src.price
    }));

    const uniquePrices = new Set(priceValues.map(v => v.value));
    deltas.push({
        field: 'Price',
        values: priceValues,
        hasDifference: uniquePrices.size > 1
    });

    // Compare descriptions
    const descValues = property.sources
        .filter(src => src.description)
        .map(src => ({
            source: src.source,
            value: src.description || ''
        }));

    const uniqueDescs = new Set(descValues.map(v => v.value));
    if (descValues.length > 0) {
        deltas.push({
            field: 'Description',
            values: descValues,
            hasDifference: uniqueDescs.size > 1
        });
    }

    // Compare last updated dates
    const dateValues = property.sources.map(src => ({
        source: src.source,
        value: src.lastUpdated
    }));

    deltas.push({
        field: 'Last Updated',
        values: dateValues,
        hasDifference: false // Just for information
    });

    // Compare image counts
    const imageCountValues = property.sources
        .filter(src => src.images)
        .map(src => ({
            source: src.source,
            value: src.images?.length || 0
        }));

    const uniqueImageCounts = new Set(imageCountValues.map(v => v.value));
    if (imageCountValues.length > 0) {
        deltas.push({
            field: 'Image Count',
            values: imageCountValues,
            hasDifference: uniqueImageCounts.size > 1
        });
    }

    return deltas;
}

export function formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(price);
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}
