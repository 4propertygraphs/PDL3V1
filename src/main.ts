// Imports
import * as THREE from 'three';
import { gsap } from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppState, SearchFilters, SearchResults, Property } from './types';
import { calculatePropertyDeltas, formatPrice, formatDate } from './utils';
import { searchPropertiesFromDB, diagnosticDatabases, getAgencyByIdOrName, getPropertiesByAgency } from './services/supabase';
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
let resultsClickHandler: ((e: Event) => void) | null = null;
let agencyClickHandler: ((e: Event) => void) | null = null;

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
        renderer.domElement.style.pointerEvents = 'none';
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
    const showAllButton = document.getElementById('showAllBtn');
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

    if (showAllButton) {
        showAllButton.addEventListener('click', () => handleShowAll());
    }
}

// Handle show all
async function handleShowAll(): Promise<void> {
    currentState = 'searching';
    startSearchingAnimation();

    try {
        // Search with wildcard to get all data
        const results = await searchPropertiesFromDB('*', {});
        currentResults = results;
        currentFilters = {};

        // Animate to results
        setTimeout(() => {
            currentState = 'results';
            morphToBox();
            setTimeout(() => {
                showResults(results);
            }, 1500);
        }, 2000);

    } catch (error) {
        console.error('Show all error:', error);
        currentState = 'sphere';
        resetToSphere();
    }
}

// Handle search
async function handleSearch(): Promise<void> {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const query = searchInput?.value.trim() || '*';

    currentState = 'searching';
    startSearchingAnimation();

    try {
        // First, try to find an agency matching the query
        const agency = await getAgencyByIdOrName(query);

        if (agency) {
            // Show agency detail
            const properties = await getPropertiesByAgency(agency.id);

            setTimeout(() => {
                currentState = 'agency-detail';
                morphToBox();
                setTimeout(() => {
                    showAgencyDetail(agency, properties);
                }, 1500);
            }, 2000);
            return;
        }

        // If no agency found, proceed with normal search
        const aiResult = await analyzeSearchQuery(query);
        const results = await searchPropertiesFromDB(aiResult.searchQuery, aiResult.filters);
        currentResults = results;
        currentFilters = aiResult.filters;

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

    // Check if we have a single agency (agency search)
    const isSingleAgencySearch = results.agencies.length === 1;
    const mainAgency = isSingleAgencySearch ? results.agencies[0] : null;

    // Build results HTML
    console.log('📋 Rendering results with mainAgency:', mainAgency);
    const html = `
        <div class="results-header">
            ${mainAgency ? `
                <div class="agency-info-header">
                    <div class="agency-logo-container">
                        ${mainAgency.logo
                            ? `<img src="${mainAgency.logo}" alt="${mainAgency.name}" class="agency-logo-image" />`
                            : `<div class="agency-logo-placeholder-header">${mainAgency.name.charAt(0)}</div>`
                        }
                    </div>
                    <div class="agency-info-text">
                        <h2>${mainAgency.name}</h2>
                        ${mainAgency.office ? `<div class="agency-office-text">${mainAgency.office}</div>` : ''}
                        ${mainAgency.address ? `<div class="agency-address-text">${mainAgency.address}</div>` : ''}
                        <div class="agency-property-count">${results.properties.length} Properties Available</div>
                    </div>
                </div>
            ` : `
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
            `}
        </div>

        <div class="sources-section">
            <h3>Data Sources</h3>
            <div class="sources-grid">
                <div class="source-card ${results.sources.daft > 0 ? 'active' : ''}">
                    <div class="source-icon-wrapper">
                        <svg class="source-icon daft" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                        </svg>
                    </div>
                    <div class="source-info">
                        <div class="source-name">Daft.ie</div>
                        <div class="source-count">${results.sources.daft} ${results.sources.daft === 1 ? 'listing' : 'listings'}</div>
                    </div>
                </div>
                <div class="source-card ${results.sources.myhome > 0 ? 'active' : ''}">
                    <div class="source-icon-wrapper">
                        <svg class="source-icon myhome" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                    </div>
                    <div class="source-info">
                        <div class="source-name">MyHome.ie</div>
                        <div class="source-count">${results.sources.myhome} ${results.sources.myhome === 1 ? 'listing' : 'listings'}</div>
                    </div>
                </div>
                <div class="source-card ${results.sources.wordpress > 0 ? 'active' : ''}">
                    <div class="source-icon-wrapper">
                        <svg class="source-icon wordpress" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                        </svg>
                    </div>
                    <div class="source-info">
                        <div class="source-name">WordPress</div>
                        <div class="source-count">${results.sources.wordpress} ${results.sources.wordpress === 1 ? 'listing' : 'listings'}</div>
                    </div>
                </div>
                <div class="source-card ${results.sources.others > 0 ? 'active' : ''}">
                    <div class="source-icon-wrapper">
                        <svg class="source-icon others" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                        </svg>
                    </div>
                    <div class="source-info">
                        <div class="source-name">Other Sources</div>
                        <div class="source-count">${results.sources.others} ${results.sources.others === 1 ? 'listing' : 'listings'}</div>
                    </div>
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
                ${results.properties.map(property => {
                    const imageUrl = property.images && property.images.length > 0
                        ? property.images[0]
                        : 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400';

                    const sourceBadges = property.sources.map(src => {
                        const sourceIcons = {
                            daft: `<svg class="source-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
                            myhome: `<svg class="source-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
                            wordpress: `<svg class="source-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>`,
                            others: `<svg class="source-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>`
                        };
                        return sourceIcons[src.source] || '';
                    }).join('');

                    return `
                    <div class="property-card" data-property-id="${property.id}">
                        <div class="property-image" style="background-image: url('${imageUrl}')">
                            <div class="property-badges">
                                <span class="status-badge residential">Residential</span>
                                <span class="status-badge to-let">To Let</span>
                            </div>
                            <div class="property-sources">
                                ${sourceBadges}
                            </div>
                        </div>
                        <div class="property-card-content">
                            <div class="property-address">${property.address}</div>
                            <div class="property-meta">
                                <div class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                                    </svg>
                                    ${property.bedrooms} beds
                                </div>
                                <div class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>
                                    ${property.bathrooms} baths
                                </div>
                                <div class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
                                    </svg>
                                    ${property.propertyType}
                                </div>
                            </div>
                            <div class="property-price">${formatPrice(property.price)}</div>
                            <div class="property-footer">
                                <span class="agency-badge-compact">${property.agency.name}</span>
                                ${property.sources.length > 1 ? `<span class="multi-source-badge">${property.sources.length} sources</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
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
    (resultsContainer as HTMLElement).style.pointerEvents = 'auto';
    (resultsContainer as HTMLElement).style.zIndex = '10000';

    console.log('=== RESULTS CONTAINER DEBUG ===');
    console.log('Results container:', resultsContainer);
    console.log('Inline styles:', {
        pointerEvents: (resultsContainer as HTMLElement).style.pointerEvents,
        zIndex: (resultsContainer as HTMLElement).style.zIndex,
    });
    console.log('Computed styles:', {
        pointerEvents: getComputedStyle(resultsContainer).pointerEvents,
        zIndex: getComputedStyle(resultsContainer).zIndex,
        display: getComputedStyle(resultsContainer).display,
        visibility: getComputedStyle(resultsContainer).visibility,
        position: getComputedStyle(resultsContainer).position,
    });
    console.log('Property cards found:', resultsContainer.querySelectorAll('.property-card').length);

    // Test kliknutí přímo na container
    (resultsContainer as HTMLElement).addEventListener('mousedown', (e) => {
        console.log('=== MOUSEDOWN ON RESULTS CONTAINER ===', e);
    }, true);

    document.body.addEventListener('click', (e) => {
        console.log('=== BODY CLICK ===', e.target);
    }, true);

    // Remove old click handler if exists
    if (resultsClickHandler) {
        resultsContainer.removeEventListener('click', resultsClickHandler);
    }

    // Setup property card click handlers using event delegation
    resultsClickHandler = (e: Event) => {
        console.log('=== CLICK DETECTED ===');
        console.log('Target:', e.target);
        const target = e.target as HTMLElement;
        const propertyCard = target.closest('.property-card');
        console.log('Property card:', propertyCard);

        if (propertyCard) {
            console.log('Property card FOUND!');
            e.preventDefault();
            e.stopPropagation();
            const propertyId = (propertyCard as HTMLElement).dataset.propertyId;
            console.log('Property ID:', propertyId);
            const property = results.properties.find(p => String(p.id) === String(propertyId));
            console.log('Property:', property);
            if (property) {
                showPropertyDetail(property);
            }
        }
    };
    resultsContainer.addEventListener('click', resultsClickHandler);

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

// Show agency detail
function showAgencyDetail(agency: any, properties: Property[]): void {
    const agencyContainer = document.querySelector('.agency-detail-container');
    const inputContainer = document.querySelector('.input-container');
    const resultsContainer = document.querySelector('.results-container');

    if (!agencyContainer) return;

    inputContainer?.classList.add('hidden');
    resultsContainer?.classList.add('hidden');

    console.log('🏢 Rendering agency detail:', agency);
    const html = `
        <div class="agency-detail-content">
            <button class="back-button" id="backFromAgency">← Back to Search</button>

            <div class="agency-header">
                ${agency.logo ? `<img src="${agency.logo}" alt="${agency.name}" class="agency-logo">` : ''}
                <div class="agency-info">
                    <h1 class="agency-name">${agency.name || ''}</h1>
                    ${(agency.office || agency.office_name) ? `<div class="agency-office">${agency.office || agency.office_name}</div>` : ''}
                    ${agency.address ? `<div class="agency-address">${agency.address}</div>` : ''}
                    ${(agency.site || agency.website) ? `<a href="${agency.site || agency.website}" target="_blank" class="agency-website">${agency.site || agency.website}</a>` : ''}
                </div>
            </div>

            <div class="agency-properties-section">
                <h2>Properties (${properties.length})</h2>
                <div class="properties-list">
                    ${properties.map(property => {
                        const imageUrl = property.images && property.images.length > 0
                            ? property.images[0]
                            : 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400';

                        return `
                        <div class="property-card" data-property-id="${property.id}">
                            <div class="property-image" style="background-image: url('${imageUrl}')"></div>
                            <div class="property-card-content">
                                <div class="property-title">${property.address}</div>
                                <div class="property-meta">
                                    <div class="meta-item">🛏️ ${property.bedrooms} bed</div>
                                    <div class="meta-item">🚿 ${property.bathrooms} bath</div>
                                    <div class="meta-item">🏠 ${property.propertyType}</div>
                                </div>
                                <div class="property-price">${formatPrice(property.price)}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    agencyContainer.innerHTML = html;
    agencyContainer.classList.remove('hidden');
    (agencyContainer as HTMLElement).style.zIndex = '20000';
    (agencyContainer as HTMLElement).style.pointerEvents = 'auto';

    console.log('=== AGENCY CONTAINER DEBUG ===');
    console.log('Agency container:', agencyContainer);
    console.log('Computed styles:', {
        zIndex: getComputedStyle(agencyContainer).zIndex,
        pointerEvents: getComputedStyle(agencyContainer).pointerEvents,
        display: getComputedStyle(agencyContainer).display,
        visibility: getComputedStyle(agencyContainer).visibility,
    });

    document.getElementById('backFromAgency')?.addEventListener('click', hideAgencyDetail);

    // Remove old click handler if exists
    if (agencyClickHandler) {
        agencyContainer.removeEventListener('click', agencyClickHandler);
    }

    // Setup property cards using event delegation
    agencyClickHandler = (e: Event) => {
        console.log('=== AGENCY CLICK DETECTED ===');
        console.log('Target:', e.target);
        const target = e.target as HTMLElement;
        const propertyCard = target.closest('.property-card');
        console.log('Property card:', propertyCard);

        if (propertyCard) {
            console.log('Property card FOUND in agency!');
            const propertyId = (propertyCard as HTMLElement).dataset.propertyId;
            console.log('Property ID:', propertyId);
            console.log('Looking for property in list of', properties.length, 'properties');
            console.log('Properties IDs:', properties.map(p => ({ id: p.id, type: typeof p.id })));
            const property = properties.find(p => String(p.id) === String(propertyId));
            console.log('Found property:', property);
            if (property) {
                console.log('🚀 Calling showPropertyDetailWithTabs');
                showPropertyDetailWithTabs(property, agency);
            } else {
                console.error('❌ Property not found with ID:', propertyId);
            }
        }
    };
    agencyContainer.addEventListener('click', agencyClickHandler);
}

// Hide agency detail
function hideAgencyDetail(): void {
    const agencyContainer = document.querySelector('.agency-detail-container');
    const inputContainer = document.querySelector('.input-container');

    agencyContainer?.classList.add('hidden');
    inputContainer?.classList.remove('hidden');

    currentState = 'sphere';
    resetToSphere();
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

// Show property detail with tabs
function showPropertyDetailWithTabs(property: Property, agency: any): void {
    console.log('🏠 showPropertyDetailWithTabs called with:', property.id);
    const detailContainer = document.querySelector('.property-detail-container');
    const agencyContainer = document.querySelector('.agency-detail-container');

    console.log('Detail container:', detailContainer);
    console.log('Agency container:', agencyContainer);

    if (!detailContainer) {
        console.error('❌ Property detail container not found!');
        return;
    }

    currentState = 'property-detail';
    agencyContainer?.classList.add('hidden');

    const deltas = calculatePropertyDeltas(property);

    const html = `
        <div class="detail-content-with-tabs">
            <button class="back-button" id="backToAgency">← Back to Agency</button>

            <div class="tabs-container">
                <div class="tabs-header">
                    <button class="tab-button active" data-tab="property">Property Detail</button>
                    <button class="tab-button" data-tab="agent">Agent</button>
                    <button class="tab-button" data-tab="delta">Delta</button>
                </div>

                <div class="tabs-content">
                    <div class="tab-pane active" data-pane="property">
                        <div class="detail-header-enhanced">
                            <div class="detail-title-main">${property.address}</div>
                            <div class="detail-price-large">${formatPrice(property.price)}</div>
                            ${property.eircode ? `<div class="detail-eircode">Eircode: ${property.eircode}</div>` : ''}
                        </div>

                        ${property.images && property.images.length > 0 ? `
                            <div class="detail-gallery">
                                <div class="gallery-main">
                                    <img src="${property.images[0]}" alt="Property" class="gallery-main-image">
                                </div>
                                ${property.images.length > 1 ? `
                                    <div class="gallery-thumbnails">
                                        ${property.images.map((img, i) => `
                                            <img src="${img}" alt="Property ${i + 1}" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <div class="property-details-section">
                            <h3 class="section-title">Property Features</h3>
                            <div class="property-details-grid-enhanced">
                                <div class="detail-card">
                                    <div class="detail-icon">🛏️</div>
                                    <div class="detail-info">
                                        <div class="detail-label">Bedrooms</div>
                                        <div class="detail-value-large">${property.bedrooms}</div>
                                    </div>
                                </div>
                                <div class="detail-card">
                                    <div class="detail-icon">🚿</div>
                                    <div class="detail-info">
                                        <div class="detail-label">Bathrooms</div>
                                        <div class="detail-value-large">${property.bathrooms}</div>
                                    </div>
                                </div>
                                <div class="detail-card">
                                    <div class="detail-icon">🏠</div>
                                    <div class="detail-info">
                                        <div class="detail-label">Property Type</div>
                                        <div class="detail-value-large">${property.propertyType}</div>
                                    </div>
                                </div>
                                ${property.coordinates ? `
                                    <div class="detail-card">
                                        <div class="detail-icon">📍</div>
                                        <div class="detail-info">
                                            <div class="detail-label">Location</div>
                                            <div class="detail-value-large">Mapped</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        ${property.description ? `
                            <div class="property-description-section">
                                <h3 class="section-title">About This Property</h3>
                                <div class="description-content">
                                    ${property.description.split('\n').map(para =>
                                        para.trim() ? `<p>${para}</p>` : ''
                                    ).join('')}
                                </div>
                            </div>
                        ` : `
                            <div class="property-description-section">
                                <h3 class="section-title">About This Property</h3>
                                <div class="description-content">
                                    <p>This ${property.propertyType.toLowerCase()} is located in ${property.address}.
                                    It features ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} and
                                    ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''}, offering comfortable
                                    living space for you and your family.</p>

                                    <p>The property is currently listed at ${formatPrice(property.price)} and is available
                                    through ${property.agency.name}. Contact the agency for more information, viewing
                                    arrangements, or to discuss your requirements.</p>

                                    ${property.eircode ? `<p>Location identifier: ${property.eircode}</p>` : ''}
                                </div>
                            </div>
                        `}

                        <div class="property-details-section">
                            <h3 class="section-title">Listing Information</h3>
                            <div class="listing-info-grid">
                                <div class="info-row">
                                    <span class="info-label">Listed by:</span>
                                    <span class="info-value">${property.agency.name}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Property ID:</span>
                                    <span class="info-value">${property.id}</span>
                                </div>
                                ${property.sources && property.sources.length > 0 ? `
                                    <div class="info-row">
                                        <span class="info-label">Available on:</span>
                                        <span class="info-value">${property.sources.length} source${property.sources.length > 1 ? 's' : ''}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane" data-pane="agent">
                        <div class="agent-info-section">
                            ${agency.logo ? `<img src="${agency.logo}" alt="${agency.name}" class="agent-logo">` : ''}
                            <h2>${agency.name || 'Unknown Agency'}</h2>
                            ${agency.office_name ? `<div class="agent-office">${agency.office_name}</div>` : ''}
                            ${agency.address ? `<div class="agent-address">${agency.address}</div>` : ''}
                            ${agency.site ? `<a href="${agency.site}" target="_blank" class="agent-website">${agency.site}</a>` : ''}
                        </div>
                    </div>

                    <div class="tab-pane" data-pane="delta">
                        <div class="delta-section">
                            <h3>Source Comparison</h3>
                            ${property.sources.length > 1 ? `
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
                            ` : '<p>This property is only available from one source.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    detailContainer.innerHTML = html;
    detailContainer.classList.remove('hidden');
    (detailContainer as HTMLElement).style.zIndex = '30000';
    (detailContainer as HTMLElement).style.pointerEvents = 'auto';

    console.log('=== PROPERTY DETAIL CONTAINER DEBUG ===');
    console.log('Property detail container:', detailContainer);
    console.log('Computed styles:', {
        zIndex: getComputedStyle(detailContainer).zIndex,
        pointerEvents: getComputedStyle(detailContainer).pointerEvents,
        display: getComputedStyle(detailContainer).display,
        visibility: getComputedStyle(detailContainer).visibility,
        opacity: getComputedStyle(detailContainer).opacity,
    });

    document.getElementById('backToAgency')?.addEventListener('click', hidePropertyDetailWithTabs);

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = (btn as HTMLElement).dataset.tab;

            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.querySelector(`[data-pane="${tab}"]`)?.classList.add('active');
        });
    });

    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
            const index = Number.parseInt((thumb as HTMLElement).dataset.index || '0');
            const mainImage = document.querySelector('.gallery-main-image') as HTMLImageElement;
            if (mainImage && property.images[index]) {
                mainImage.src = property.images[index];
            }

            document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
    });
}

// Hide property detail with tabs
function hidePropertyDetailWithTabs(): void {
    const detailContainer = document.querySelector('.property-detail-container');
    const agencyContainer = document.querySelector('.agency-detail-container');

    detailContainer?.classList.add('hidden');
    agencyContainer?.classList.remove('hidden');

    currentState = 'agency-detail';
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
