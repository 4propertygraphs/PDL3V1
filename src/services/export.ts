import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { SearchResults } from '../types';
import { formatPrice } from '../utils';

export function exportToPDF(results: SearchResults) {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.text('Property Search Results', 20, yPosition);
    yPosition += 10;

    // Query
    doc.setFontSize(12);
    doc.text(`Search: ${results.query}`, 20, yPosition);
    yPosition += 10;

    // Stats
    doc.setFontSize(10);
    doc.text(`Properties: ${results.properties.length} | Agencies: ${results.agencies.length}`, 20, yPosition);
    yPosition += 15;

    // Properties
    doc.setFontSize(14);
    doc.text('Properties:', 20, yPosition);
    yPosition += 8;

    for (const property of results.properties) {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(property.title, 20, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${property.address}`, 20, yPosition);
        yPosition += 5;
        doc.text(`Price: ${formatPrice(property.price)} | ${property.bedrooms} bed | ${property.bathrooms} bath`, 20, yPosition);
        yPosition += 5;
        doc.text(`Agency: ${property.agency.name}`, 20, yPosition);
        yPosition += 8;
    }

    // Download
    doc.save(`property-search-${Date.now()}.pdf`);
}

export function exportToExcel(results: SearchResults) {
    // Prepare data
    const data = results.properties.map(property => ({
        'Title': property.title,
        'Address': property.address,
        'Eircode': property.eircode || '',
        'Price': property.price,
        'Bedrooms': property.bedrooms,
        'Bathrooms': property.bathrooms,
        'Type': property.propertyType,
        'Agency': property.agency.name,
        'Agency Phone': property.agency.phone || '',
        'Agency Email': property.agency.email || '',
        'Sources': property.sources.map(s => s.source).join(', ')
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 40 }, // Title
        { wch: 35 }, // Address
        { wch: 10 }, // Eircode
        { wch: 12 }, // Price
        { wch: 10 }, // Bedrooms
        { wch: 10 }, // Bathrooms
        { wch: 12 }, // Type
        { wch: 20 }, // Agency
        { wch: 15 }, // Phone
        { wch: 25 }, // Email
        { wch: 20 }  // Sources
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Properties');

    // Download
    XLSX.writeFile(wb, `property-search-${Date.now()}.xlsx`);
}
