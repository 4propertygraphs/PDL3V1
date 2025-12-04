import OpenAI from 'openai';
import type { SearchFilters } from '../types';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

let openai: OpenAI | null = null;

if (apiKey) {
    openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
    });
}

export interface AISearchResult {
    searchQuery: string;
    filters: SearchFilters;
    intent: string;
}

export async function analyzeSearchQuery(query: string): Promise<AISearchResult> {
    if (!openai) {
        // Fallback to basic parsing if no API key
        return parseQueryBasic(query);
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a property search assistant for Irish real estate. Analyze user queries and extract:
                    - Search intent (company name, property name, location, Eircode, general question)
                    - Filters (price range, bedrooms, property type, location)

                    Respond in JSON format:
                    {
                        "searchQuery": "refined search query",
                        "filters": {
                            "minPrice": number or null,
                            "maxPrice": number or null,
                            "minBedrooms": number or null,
                            "maxBedrooms": number or null,
                            "propertyType": string or null,
                            "location": string or null
                        },
                        "intent": "company|property|location|eircode|general"
                    }`
                },
                {
                    role: 'user',
                    content: query
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        return result as AISearchResult;
    } catch (error) {
        console.error('OpenAI API error:', error);
        return parseQueryBasic(query);
    }
}

function parseQueryBasic(query: string): AISearchResult {
    const lowerQuery = query.toLowerCase();
    const filters: SearchFilters = {};

    // Extract price
    const priceMatch = lowerQuery.match(/(\d+)k?\s*-\s*(\d+)k?/);
    if (priceMatch) {
        filters.minPrice = Number.parseInt(priceMatch[1]) * 1000;
        filters.maxPrice = Number.parseInt(priceMatch[2]) * 1000;
    }

    // Extract bedrooms
    const bedroomMatch = lowerQuery.match(/(\d+)\s*bed/);
    if (bedroomMatch) {
        filters.minBedrooms = Number.parseInt(bedroomMatch[1]);
    }

    // Property type
    if (lowerQuery.includes('apartment') || lowerQuery.includes('flat')) {
        filters.propertyType = 'Apartment';
    } else if (lowerQuery.includes('house')) {
        filters.propertyType = 'House';
    } else if (lowerQuery.includes('penthouse')) {
        filters.propertyType = 'Penthouse';
    }

    // Detect intent
    let intent = 'general';
    if (/^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i.test(query.trim())) {
        intent = 'eircode';
    } else if (lowerQuery.includes('dublin') || lowerQuery.includes('cork') || lowerQuery.includes('galway')) {
        intent = 'location';
    }

    return {
        searchQuery: query,
        filters,
        intent
    };
}
