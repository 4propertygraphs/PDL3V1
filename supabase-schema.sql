-- Create agencies table
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    eircode TEXT,
    price DECIMAL NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms INTEGER NOT NULL,
    property_type TEXT NOT NULL,
    description TEXT,
    images TEXT[],
    latitude DECIMAL,
    longitude DECIMAL,
    agency_id UUID REFERENCES agencies(id),
    sources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_eircode ON properties(eircode);
CREATE INDEX IF NOT EXISTS idx_properties_agency ON properties(agency_id);

-- Enable Row Level Security
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on agencies"
    ON agencies FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on properties"
    ON properties FOR SELECT
    USING (true);

-- Insert agencies
INSERT INTO agencies (id, name, address, phone, email, website) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'CKP', 'CKP Head Office, Dublin', '+353 1 XXX XXXX', 'info@ckp.ie', 'https://ckp.ie'),
    ('a2222222-2222-2222-2222-222222222222', 'Sherry FitzGerald', '54 Merrion Square, Dublin 2', '+353 1 639 9700', 'info@sherryfitz.ie', 'https://www.sherryfitz.ie'),
    ('a3333333-3333-3333-3333-333333333333', 'DNG', '28 Upper Pembroke Street, Dublin 2', '+353 1 638 3333', 'info@dng.ie', 'https://www.dng.ie'),
    ('a4444444-4444-4444-4444-444444444444', 'Lisney', '24 St. Stephens Green, Dublin 2', '+353 1 638 2700', 'residential@lisney.com', 'https://www.lisney.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO properties (title, address, eircode, price, bedrooms, bathrooms, property_type, description, images, latitude, longitude, agency_id, sources) VALUES
    (
        'CKP Premium Office Space - City Centre',
        'O''Connell Street, Dublin 1',
        'D01 F5P2',
        1200000,
        0,
        2,
        'Commercial',
        'Premium commercial office space offered by CKP. Modern fit-out, excellent location in the heart of Dublin city centre.',
        ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'],
        53.3498,
        -6.2603,
        'a1111111-1111-1111-1111-111111111111',
        '[{"source": "daft", "url": "https://daft.ie/ckp-office-1", "price": 1200000, "lastUpdated": "2024-12-04"}]'::jsonb
    ),
    (
        'CKP Luxury Apartment - Dublin 4',
        'Ballsbridge, Dublin 4',
        'D04 E3W8',
        850000,
        3,
        2,
        'Apartment',
        'Stunning 3 bedroom apartment managed by CKP. High-end finishes, private parking, gym access.',
        ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'],
        53.3308,
        -6.2297,
        'a1111111-1111-1111-1111-111111111111',
        '[{"source": "daft", "url": "https://daft.ie/ckp-apartment-1", "price": 850000, "lastUpdated": "2024-12-04"}, {"source": "myhome", "url": "https://myhome.ie/ckp-apartment-1", "price": 845000, "lastUpdated": "2024-12-03"}]'::jsonb
    ),
    (
        'Modern 4 Bed House - South Dublin',
        '12 Sandymount Road, Dublin 4',
        'D04 ABC1',
        950000,
        4,
        3,
        'House',
        'Spacious family home in sought-after Sandymount area with large garden. Listed by Sherry FitzGerald.',
        ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'],
        53.3308,
        -6.2181,
        'a2222222-2222-2222-2222-222222222222',
        '[{"source": "daft", "url": "https://daft.ie/sf-property-1", "price": 950000, "lastUpdated": "2024-12-04"}]'::jsonb
    ),
    (
        'DNG Premium Penthouse - IFSC',
        'The Marker Residences, Dublin 2',
        'D02 CX65',
        675000,
        2,
        2,
        'Penthouse',
        'Luxury penthouse with panoramic city views and high-end finishes throughout. Listed by DNG.',
        ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        53.3477,
        -6.2436,
        'a3333333-3333-3333-3333-333333333333',
        '[{"source": "daft", "url": "https://daft.ie/dng-property-1", "price": 675000, "lastUpdated": "2024-12-04"}]'::jsonb
    );
