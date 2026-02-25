const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function extractPDFFieldMap() {
  try {
    const pdfPath = path.join(__dirname, 'forms', 'midland-national-fixed-annuity-v1.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      process.exit(1);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`Extracting ${fields.length} form fields from PDF...`);
    
    const fieldMap = {
      pdfFile: 'midland-national-fixed-annuity-v1.pdf',
      generatedAt: new Date().toISOString(),
      totalFields: fields.length,
      fields: fields.map(field => ({
        name: field.getName(),
        type: field.constructor.name,
        description: getFieldTypeDescription(field.constructor.name)
      }))
    };

    // Create /maps directory if it doesn't exist
    const mapsDir = path.join(__dirname, 'maps');
    if (!fs.existsSync(mapsDir)) {
      fs.mkdirSync(mapsDir, { recursive: true });
    }

    // Save to file
    const outputPath = path.join(mapsDir, 'midland-national-fixed-annuity-v1_fieldmap.json');
    fs.writeFileSync(outputPath, JSON.stringify(fieldMap, null, 2), 'utf-8');

    console.log(`\n✅ Field map saved to: ${outputPath}\n`);
    console.log(`📊 Summary:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total fields: ${fields.length}`);
    
    // Count by type
    const typeCount = {};
    fieldMap.fields.forEach(field => {
      typeCount[field.type] = (typeCount[field.type] || 0) + 1;
    });
    
    console.log(`\nField types:`);
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    console.log(`\n📝 Fields (${fieldMap.fields.length} total):`);
    fieldMap.fields.forEach((field, index) => {
      console.log(`${index + 1}. "${field.name}" (${field.type})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function getFieldTypeDescription(typeString) {
  const descriptions = {
    'PDFTextField': 'Text input field',
    'PDFCheckBox': 'Checkbox field',
    'PDFRadioGroup': 'Radio button group',
    'PDFDropdown': 'Dropdown/select field',
    'PDFOptionList': 'Option list field',
    'PDFSignature': 'Signature field'
  };
  return descriptions[typeString] || 'Unknown field type';
}

extractPDFFieldMap();
