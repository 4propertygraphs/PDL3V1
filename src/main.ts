// Imports
import * as THREE from 'three';
import { gsap } from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppState, SearchFilters, SearchResults, Property } from './types';
import { calculatePropertyDeltas, formatPrice, formatDate } from './utils';
import { searchPropertiesFromDB, getFavorites, addFavorite, removeFavorite, diagnosticDatabases } from './services/supabase';
import { analyzeSearchQuery } from './services/openai';
import { exportToPDF, exportToExcel } from './services/export';
import './style.css';

// Interface
interface ParticlePoints extends THREE.Points {
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
}

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let particles: ParticlePoints;
const particleCount = 12000;
let currentState: AppState = 'sphere';
let currentResults: SearchResults | null = null;
let propertyMap: L.Map | null = null;
let currentFilters: SearchFilters = {};

// Initialize Three.js scene
function init(): void {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1, 1000);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 25;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const container = document.getElementById('container');
    if (container) {
        container.appendChild(renderer.domElement);
    }

    // Create particles
    createParticles();

    // Setup event listeners
    setupEventListeners();

    // Start animation loop
    animate();
}

// Create particles in sphere formation
function createParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const radius = 8;

    for (let i = 0; i < particleCount; i++) {
        // Sphere distribution using Fibonacci sphere
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;

        const x = radius * Math.cos(theta) * Math.sin(phi);
        const y = radius * Math.sin(theta) * Math.sin(phi);
        const z = radius * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Initial color (white/light blue)
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material) as ParticlePoints;
    scene.add(particles);

    // Fade in animation
    gsap.to(material, {
        opacity: 0.8,
        duration: 2,
        ease: "power2.inOut"
    });
}

// Setup event listeners
function setupEventListeners(): void {
    const searchButton = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    } else {
        console.error('❌ Nenalezeny elementy:', { searchButton, searchInput });
    }
}

// Handle search
async function handleSearch(): Promise<void> {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const query = searchInput?.value.trim();

    if (!query) return;

    currentState = 'searching';
    startSearchingAnimation();

    try {
        // Analyze query with AI
        const aiResult = await analyzeSearchQuery(query);

        // Search with filters
        const results = await searchPropertiesFromDB(aiResult.searchQuery, aiResult.filters);
        currentResults = results;
        currentFilters = aiResult.filters;

        // Animate to results
        setTimeout(() => {
            currentState = 'results';
            morphToBox();
            setTimeout(() => {
                showResults(results);
            }, 1500);
        }, 2000);

    } catch (error) {
        console.error('Search error:', error);
        currentState = 'sphere';
        resetToSphere();
    }
}

// Start searching animation
function startSearchingAnimation(): void {
    changeParticleColors();

    // Rotate particles
    gsap.to(particles.rotation, {
        y: Math.PI * 2,
        duration: 2,
        ease: 'power2.inOut'
    });
}

// Change particle colors
function changeParticleColors(): void {
    const colors = particles.geometry.attributes.color;
    const colorArray = colors.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
        // Gradient from purple to blue
        const t = i / particleCount;
        colorArray[i * 3] = 0.4 + t * 0.2;     // R
        colorArray[i * 3 + 1] = 0.3 + t * 0.3; // G
        colorArray[i * 3 + 2] = 0.9 + t * 0.1; // B
    }

    colors.needsUpdate = true;
}

// Morph particles to box
function morphToBox(): void {
    const positions = particles.geometry.attributes.position;
    const posArray = positions.array as Float32Array;

    const boxSize = 300;

    for (let i = 0; i < particleCount; i++) {
        const target = {
            x: (Math.random() - 0.5) * boxSize,
            y: (Math.random() - 0.5) * boxSize,
            z: (Math.random() - 0.5) * boxSize
        };

        gsap.to(posArray, {
            [i * 3]: target.x,
            [i * 3 + 1]: target.y,
            [i * 3 + 2]: target.z,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => {
                positions.needsUpdate = true;
            }
        });
    }
}

// Show results
function showResults(results: SearchResults): void {
    const resultsContainer = document.querySelector('.results-container');
    const inputContainer = document.querySelector('.input-container');

    if (!resultsContainer) return;

    // Hide input
    inputContainer?.classList.add('hidden');

    // Build results HTML
    const html = `
        <div class="results-header">
            <h2>Search Results</h2>
            <div class="results-stats">
                <div class="stat-item">
                    <span class="stat-label">Properties:</span>
                    <span class="stat-value">${results.properties.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Agencies:</span>
                    <span class="stat-value">${results.agencies.length}</span>
                </div>
            </div>
        </div>

        <div class="sources-section">
            <h3>Sources</h3>
            <div class="sources-grid">
                <div class="source-card">
                    <div class="source-name">Daft</div>
                    <div class="source-count">${results.sources.daft}</div>
                </div>
                <div class="source-card">
                    <div class="source-name">MyHome</div>
                    <div class="source-count">${results.sources.myhome}</div>
                </div>
                <div class="source-card">
                    <div class="source-name">WordPress</div>
                    <div class="source-count">${results.sources.wordpress}</div>
                </div>
                <div class="source-card">
                    <div class="source-name">Others</div>
                    <div class="source-count">${results.sources.others}</div>
                </div>
            </div>
        </div>

        <div class="filters-panel">
            <div class="filters-header">
                <h3>Filters</h3>
            </div>
            <div class="filters-content">
                <div class="filter-group">
                    <label>Min Price</label>
                    <input type="number" id="minPrice" placeholder="€0" value="${currentFilters.minPrice || ''}">
                </div>
                <div class="filter-group">
                    <label>Max Price</label>
                    <input type="number" id="maxPrice" placeholder="€1,000,000" value="${currentFilters.maxPrice || ''}">
                </div>
                <div class="filter-group">
                    <label>Bedrooms</label>
                    <select id="minBedrooms">
                        <option value="">Any</option>
                        <option value="1" ${currentFilters.minBedrooms === 1 ? 'selected' : ''}>1+</option>
                        <option value="2" ${currentFilters.minBedrooms === 2 ? 'selected' : ''}>2+</option>
                        <option value="3" ${currentFilters.minBedrooms === 3 ? 'selected' : ''}>3+</option>
                        <option value="4" ${currentFilters.minBedrooms === 4 ? 'selected' : ''}>4+</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Property Type</label>
                    <select id="propertyType">
                        <option value="">All Types</option>
                        <option value="Apartment" ${currentFilters.propertyType === 'Apartment' ? 'selected' : ''}>Apartment</option>
                        <option value="House" ${currentFilters.propertyType === 'House' ? 'selected' : ''}>House</option>
                        <option value="Penthouse" ${currentFilters.propertyType === 'Penthouse' ? 'selected' : ''}>Penthouse</option>
                    </select>
                </div>
            </div>
            <div class="filters-actions">
                <button class="filter-button primary" id="applyFilters">Apply Filters</button>
                <button class="filter-button secondary" id="resetFilters">Reset</button>
            </div>
        </div>

        <div class="properties-section">
            <h3>Properties (${results.properties.length})</h3>
            <div class="properties-list">
                ${results.properties.map(property => `
                    <div class="property-card" data-property-id="${property.id}">
                        <button class="favorite-button" data-favorite-id="${property.id}">
                            <svg viewBox="0 0 24 24">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <div class="property-title">${property.title}</div>
                        <div class="property-address">${property.address}</div>
                        <div class="property-meta">
                            <div class="meta-item">🛏️ ${property.bedrooms} bed</div>
                            <div class="meta-item">🚿 ${property.bathrooms} bath</div>
                            <div class="meta-item">🏠 ${property.propertyType}</div>
                            <div class="meta-item">🏢 ${property.agency.name}</div>
                        </div>
                        <div class="property-price">${formatPrice(property.price)}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        ${results.properties.some(p => p.coordinates) ? '<div class="map-container"><div id="propertyMap"></div></div>' : ''}

        <div class="export-section">
            <h3>Export Results</h3>
            <div class="export-buttons">
                <button class="export-button" id="exportPDF">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    Export PDF
                </button>
                <button class="export-button" id="exportExcel">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export Excel
                </button>
            </div>
        </div>

        <button class="back-button" id="backButton">← Back to Search</button>
    `;

    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');

    // Setup favorite buttons
    const setupFavorites = async () => {
        const favorites = await getFavorites();
        document.querySelectorAll('.favorite-button').forEach(async (btn) => {
            const propertyId = (btn as HTMLElement).dataset.favoriteId!;
            const isFav = favorites.includes(propertyId);

            if (isFav) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (btn.classList.contains('active')) {
                    await removeFavorite(propertyId);
                    btn.classList.remove('active');
                } else {
                    await addFavorite(propertyId);
                    btn.classList.add('active');
                }
            });
        });
    };
    setupFavorites();

    // Setup property card click handlers
    document.querySelectorAll('.property-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking favorite button
            if ((e.target as HTMLElement).closest('.favorite-button')) {
                return;
            }

            const propertyId = (card as HTMLElement).dataset.propertyId;
            const property = results.properties.find(p => p.id === propertyId);
            if (property) {
                showPropertyDetail(property);
            }
        });
    });

    // Setup filter handlers
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const backButton = document.getElementById('backButton');

    applyFiltersBtn?.addEventListener('click', async () => {
        const minPrice = (document.getElementById('minPrice') as HTMLInputElement)?.value;
        const maxPrice = (document.getElementById('maxPrice') as HTMLInputElement)?.value;
        const minBedrooms = (document.getElementById('minBedrooms') as HTMLSelectElement)?.value;
        const propertyType = (document.getElementById('propertyType') as HTMLSelectElement)?.value;

        currentFilters = {
            minPrice: minPrice ? Number.parseInt(minPrice) : undefined,
            maxPrice: maxPrice ? Number.parseInt(maxPrice) : undefined,
            minBedrooms: minBedrooms ? Number.parseInt(minBedrooms) : undefined,
            propertyType: propertyType || undefined
        };

        const newResults = await searchPropertiesFromDB(results.query, currentFilters);
        currentResults = newResults;
        showResults(newResults);
    });

    resetFiltersBtn?.addEventListener('click', async () => {
        currentFilters = {};
        const newResults = await searchPropertiesFromDB(results.query);
        currentResults = newResults;
        showResults(newResults);
    });

    backButton?.addEventListener('click', hideResults);

    // Setup export handlers
    document.getElementById('exportPDF')?.addEventListener('click', () => {
        if (currentResults) exportToPDF(currentResults);
    });

    document.getElementById('exportExcel')?.addEventListener('click', () => {
        if (currentResults) exportToExcel(currentResults);
    });

    // Initialize map if properties have coordinates
    if (results.properties.some(p => p.coordinates)) {
        setTimeout(() => initializeMap(results.properties), 100);
    }
}

// Hide results
function hideResults(): void {
    const resultsContainer = document.querySelector('.results-container');
    const inputContainer = document.querySelector('.input-container');

    resultsContainer?.classList.add('hidden');
    inputContainer?.classList.remove('hidden');

    currentState = 'sphere';
    resetToSphere();
}

// Initialize Leaflet map
function initializeMap(properties: Property[]): void {
    const mapElement = document.getElementById('propertyMap');
    if (!mapElement) return;

    // Clean up existing map
    if (propertyMap) {
        propertyMap.remove();
    }

    // Get properties with coordinates
    const validProperties = properties.filter(p => p.coordinates);
    if (validProperties.length === 0) return;

    // Calculate center
    const avgLat = validProperties.reduce((sum, p) => sum + (p.coordinates?.lat || 0), 0) / validProperties.length;
    const avgLng = validProperties.reduce((sum, p) => sum + (p.coordinates?.lng || 0), 0) / validProperties.length;

    // Create map
    propertyMap = L.map('propertyMap').setView([avgLat, avgLng], 12);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(propertyMap);

    // Add markers
    validProperties.forEach(property => {
        if (property.coordinates) {
            const marker = L.marker([property.coordinates.lat, property.coordinates.lng])
                .addTo(propertyMap!);

            marker.bindPopup(`
                <div class="map-popup">
                    <h4>${property.title}</h4>
                    <p>${property.address}</p>
                    <p class="price">${formatPrice(property.price)}</p>
                </div>
            `);
        }
    });
}

// Show property detail
function showPropertyDetail(property: Property): void {
    const detailContainer = document.querySelector('.property-detail-container');
    const resultsContainer = document.querySelector('.results-container');

    if (!detailContainer) return;

    currentState = 'property-detail';
    resultsContainer?.classList.add('hidden');

    renderPropertyDetail(property, detailContainer);
    detailContainer.classList.remove('hidden');
}

// Render property detail
function renderPropertyDetail(property: Property, container: Element): void {
    const deltas = calculatePropertyDeltas(property);

    const html = `
        <div class="detail-header">
            <div class="detail-title">${property.title}</div>
            <div class="detail-address">${property.address}</div>
        </div>

        ${property.images.length > 0 ? `
            <div class="detail-images">
                ${property.images.map(img => `
                    <img src="${img}" alt="${property.title}" class="detail-image">
                `).join('')}
            </div>
        ` : ''}

        <div class="detail-info">
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Price</div>
                    <div class="info-value">${formatPrice(property.price)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Bedrooms</div>
                    <div class="info-value">${property.bedrooms}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Bathrooms</div>
                    <div class="info-value">${property.bathrooms}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Type</div>
                    <div class="info-value">${property.propertyType}</div>
                </div>
                ${property.eircode ? `
                    <div class="info-item">
                        <div class="info-label">Eircode</div>
                        <div class="info-value">${property.eircode}</div>
                    </div>
                ` : ''}
                <div class="info-item">
                    <div class="info-label">Agency</div>
                    <div class="info-value">${property.agency.name}</div>
                </div>
            </div>
        </div>

        <div class="detail-info">
            <div class="info-label">Description</div>
            <div class="info-value" style="margin-top: 0.5rem;">${property.description}</div>
        </div>

        ${property.sources.length > 1 ? `
            <div class="delta-section">
                <h3>Source Comparison</h3>
                <div class="delta-list">
                    ${deltas.map(delta => `
                        <div class="delta-item ${delta.hasDifference ? 'has-difference' : ''}">
                            <div class="delta-field">${delta.field}</div>
                            <div class="delta-values">
                                ${delta.values.map(val => `
                                    <div class="delta-value">
                                        <span class="delta-source">${val.source}</span>
                                        <span class="delta-data">${
                                            delta.field === 'Price' ? formatPrice(val.value as number) :
                                            delta.field === 'Last Updated' ? formatDate(val.value as string) :
                                            val.value
                                        }</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <div class="detail-info">
            <div class="info-label">Agency Contact</div>
            <div class="info-grid" style="margin-top: 0.5rem;">
                ${property.agency.phone ? `
                    <div class="info-item">
                        <div class="info-label">Phone</div>
                        <div class="info-value">${property.agency.phone}</div>
                    </div>
                ` : ''}
                ${property.agency.email ? `
                    <div class="info-item">
                        <div class="info-label">Email</div>
                        <div class="info-value">${property.agency.email}</div>
                    </div>
                ` : ''}
                ${property.agency.website ? `
                    <div class="info-item">
                        <div class="info-label">Website</div>
                        <div class="info-value"><a href="${property.agency.website}" target="_blank" style="color: #6366f1;">${property.agency.website}</a></div>
                    </div>
                ` : ''}
            </div>
        </div>

        <button class="back-button" id="backToResults">← Back to Results</button>
    `;

    container.innerHTML = html;

    // Setup back button
    document.getElementById('backToResults')?.addEventListener('click', hidePropertyDetail);
}

// Hide property detail
function hidePropertyDetail(): void {
    const detailContainer = document.querySelector('.property-detail-container');
    const resultsContainer = document.querySelector('.results-container');

    detailContainer?.classList.add('hidden');
    resultsContainer?.classList.remove('hidden');

    currentState = 'results';
}

// Reset to sphere
function resetToSphere(): void {
    const positions = particles.geometry.attributes.position;
    const colors = particles.geometry.attributes.color;
    const posArray = positions.array as Float32Array;
    const colorArray = colors.array as Float32Array;

    const radius = 8;

    for (let i = 0; i < particleCount; i++) {
        // Sphere distribution
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;

        const target = {
            x: radius * Math.cos(theta) * Math.sin(phi),
            y: radius * Math.sin(theta) * Math.sin(phi),
            z: radius * Math.cos(phi)
        };

        gsap.to(posArray, {
            [i * 3]: target.x,
            [i * 3 + 1]: target.y,
            [i * 3 + 2]: target.z,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => {
                positions.needsUpdate = true;
            }
        });

        // Reset colors
        colorArray[i * 3] = 0.7;
        colorArray[i * 3 + 1] = 0.8;
        colorArray[i * 3 + 2] = 1.0;
    }

    colors.needsUpdate = true;

    // Reset rotation
    gsap.to(particles.rotation, {
        y: 0,
        duration: 1.5,
        ease: 'power2.inOut'
    });
}

// Animation loop
function animate(): void {
    requestAnimationFrame(animate);

    // Gentle rotation when in sphere state
    if (currentState === 'sphere') {
        particles.rotation.y += 0.0008;
        particles.rotation.x += 0.0003;
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize application
init();

// Run database diagnostics on startup
diagnosticDatabases();
