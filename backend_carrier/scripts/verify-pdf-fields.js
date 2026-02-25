const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function extractPDFFields() {
  try {
    const pdfPath = path.join(__dirname, 'forms', 'midland-national-fixed-annuity-v1.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found at:', pdfPath);
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`\n✅ Found ${fields.length} form fields in the PDF:\n`);
    
    const fieldNames = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name
    }));

    fieldNames.forEach((field, index) => {
      console.log(`${index + 1}. "${field.name}" (${field.type})`);
    });

    // Now check the mapping file
    const mappingPath = path.join(__dirname, 'maps', 'midland-national-fixed-annuity-v1.json');
    
    if (!fs.existsSync(mappingPath)) {
      console.log('\n❌ Mapping file not found at:', mappingPath);
      return;
    }

    const mappingFile = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    const mappedFieldNames = mappingFile.mappings.map(m => m.pdfFieldName);

    console.log(`\n\n📋 Mapped fields in mapping file (${mappedFieldNames.length} total):\n`);
    
    const pdfFieldNameSet = new Set(fieldNames.map(f => f.name));
    const unmappedInPdf = [];
    const missingInPdf = [];

    mappedFieldNames.forEach((fieldName, index) => {
      const exists = pdfFieldNameSet.has(fieldName);
      const status = exists ? '✅' : '❌';
      console.log(`${status} "${fieldName}"`);
      
      if (!exists) {
        missingInPdf.push(fieldName);
      }
    });

    // Find fields in PDF that are not in mapping
    fieldNames.forEach(field => {
      if (!mappedFieldNames.includes(field.name)) {
        unmappedInPdf.push(field.name);
      }
    });

    console.log('\n\n📊 Verification Summary:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total PDF fields: ${fieldNames.length}`);
    console.log(`Total mapped fields: ${mappedFieldNames.length}`);
    console.log(`Matching fields: ${mappedFieldNames.length - missingInPdf.length}`);
    
    if (missingInPdf.length > 0) {
      console.log(`\n⚠️  Fields in mapping but NOT in PDF (${missingInPdf.length}):`);
      missingInPdf.forEach(field => console.log(`   - "${field}"`));
    }

    if (unmappedInPdf.length > 0) {
      console.log(`\n⚠️  Fields in PDF but NOT in mapping (${unmappedInPdf.length}):`);
      unmappedInPdf.forEach(field => console.log(`   - "${field}"`));
    }

    if (missingInPdf.length === 0 && unmappedInPdf.length === 0) {
      console.log('\n✅ All mapping fields match PDF fields perfectly!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

extractPDFFields();
