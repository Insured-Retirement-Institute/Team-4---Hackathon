const { PDFDocument } = require('pdf-lib');

/**
 * Helper function to get a nested value from an object using dot notation
 * e.g., getNestedValue(obj, 'annuitant.firstName') returns obj.annuitant.firstName
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    // Handle array notation like 'array[0].property'
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2])];
      }
    } else {
      current = current[part];
    }
    
    if (current === undefined || current === null) {
      return undefined;
    }
  }
  
  return current;
}

/**
 * Helper function to parse mapping data type and format into transformed value
 * Handles: date, phone, currency, number, text, radio, checkbox, enum options
 */
function transformFieldValue(value, mapping) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const { dataType, format, options } = mapping;

  // Handle option mappings (radio, checkbox)
  if (options && typeof options === 'object') {
    // Convert boolean values to string keys for lookup
    const lookupValue = value === true ? 'true' : value === false ? 'false' : String(value);
    const mappedValue = options[lookupValue];
    if (mappedValue) {
      return mappedValue;
    }
  }

  // Handle data type transformations
  if (dataType === 'date') {
    if (format && format.includes('split')) {
      // Split date into MM/DD/YYYY parts
      if (typeof value === 'string') {
        const dateObj = new Date(value);
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const year = dateObj.getFullYear();
        return { month, day, year };
      }
    } else {
      // Simple date formatting
      if (typeof value === 'string') {
        const dateObj = new Date(value);
        return dateObj.toLocaleDateString('en-US');
      }
    }
  } else if (dataType === 'phone') {
    if (format && format.includes('split')) {
      // Split 10-digit phone into segments
      const digits = String(value).replace(/\D/g, '');
      if (digits.length >= 10) {
        return {
          part1: digits.substring(0, 3),
          part2: digits.substring(3, 6),
          part3: digits.substring(6, 10)
        };
      }
    }
  } else if (dataType === 'currency') {
    if (format && format.includes('split')) {
      // Split currency into dollars and cents
      const amount = parseFloat(value);
      const dollars = Math.floor(amount);
      const cents = Math.round((amount - dollars) * 100);
      return {
        dollars: String(dollars),
        cents: String(cents).padStart(2, '0')
      };
    }
  } else if (dataType === 'number') {
    return String(value);
  }

  return value;
}

/**
 * Helper function to populate PDF using the new mapping structure
 */
async function populatePDFWithMapping(pdfBuffer, submission, mapping) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();
  
  // Get all form fields in the PDF
  const fields = form.getFields();
  const fieldMap = {};
  fields.forEach(field => {
    fieldMap[field.getName()] = field;
  });
  
  // Flatten the nested mapping structure
  const mappingStructure = mapping.mappingStructure || {};
  const allMappings = [];
  
  Object.values(mappingStructure).forEach(section => {
    if (Array.isArray(section)) {
      allMappings.push(...section);
    }
  });
  
  // Process each mapping
  allMappings.forEach(fieldMapping => {
    // Extract value from submission using the jsonPath
    const fieldValue = getNestedValue(submission, fieldMapping.jsonPath);
    
    if (fieldValue === undefined || fieldValue === null) {
      return; // Skip if no value
    }
    
    // Transform the value based on dataType and options
    const transformedValue = transformFieldValue(fieldValue, fieldMapping);
    
    if (transformedValue === undefined) {
      return; // Skip if transformation resulted in undefined
    }
    
    // Handle single field mapping
    if (typeof fieldMapping.pdfField === 'string' && !fieldMapping.pdfField.includes('Not directly')) {
      const pdfFieldName = fieldMapping.pdfField;
      const field = fieldMap[pdfFieldName];
      
      if (!field) {
        console.warn(`PDF field not found: ${pdfFieldName}`);
        return;
      }
      
      setFieldValue(field, transformedValue, fieldMapping.dataType);
    }
    
    // Handle multiple field mapping (e.g., split date, split phone, etc.)
    if (Array.isArray(fieldMapping.pdfField)) {
      const pdfFields = fieldMapping.pdfField;
      
      // If transformedValue is an object with parts, map them
      if (typeof transformedValue === 'object' && transformedValue !== null) {
        const valueParts = Object.values(transformedValue);
        pdfFields.forEach((pdfFieldName, index) => {
          const field = fieldMap[pdfFieldName];
          if (!field) {
            console.warn(`PDF field not found: ${pdfFieldName}`);
            return;
          }
          if (valueParts[index] !== undefined) {
            setFieldValue(field, valueParts[index], fieldMapping.dataType);
          }
        });
      } else {
        // If single value maps to multiple fields, fill all with same value
        pdfFields.forEach(pdfFieldName => {
          const field = fieldMap[pdfFieldName];
          if (!field) {
            console.warn(`PDF field not found: ${pdfFieldName}`);
            return;
          }
          setFieldValue(field, transformedValue, fieldMapping.dataType);
        });
      }
    }
  });
  
  // Do not flatten the form so the output PDF remains fillable
  return await pdfDoc.save();
}

/**
 * Helper function to set a field value based on field type and dataType
 */
function setFieldValue(field, value, dataType = 'text') {
  const fieldType = field.constructor.name;
  
  try {
    if (fieldType === 'PDFTextField' || fieldType === 'PDFSignature') {
      let text = String(value);

      // Attempt to determine the field max length from several possible locations
      let maxLen;
      try {
        if (typeof field.getMaxLength === 'function') {
          maxLen = field.getMaxLength();
        }
      } catch (e) {}

      try {
        if (maxLen === undefined && typeof field.maxLength === 'number') {
          maxLen = field.maxLength;
        }
      } catch (e) {}

      try {
        // Access lower-level acro field dict (pdf-lib internals)
        if (maxLen === undefined && field.acroField && field.acroField.dict) {
          const maybe = field.acroField.dict.get('MaxLen') || field.acroField.dict.get('maxLen');
          if (maybe !== undefined && maybe !== null) {
            // Try to coerce to number
            const n = Number(maybe);
            if (!Number.isNaN(n)) maxLen = n;
            else if (typeof maybe.asNumber === 'function') {
              maxLen = maybe.asNumber();
            }
          }
        }
      } catch (e) {}

      if (typeof maxLen === 'number' && maxLen > 0 && text.length > maxLen) {
        text = text.substring(0, maxLen);
      }

      field.setText(text);
    } else if (fieldType === 'PDFCheckBox') {
      if (dataType === 'checkbox') {
        // Boolean checkbox
        if (value === true || value === 'true' || value === 1 || value === '1') {
          field.check();
        } else if (value === false || value === 'false' || value === 0 || value === '0') {
          field.uncheck();
        }
      } else if (value === true || value === 'true' || value === 'Yes' || value === 'Yes') {
        field.check();
      } else {
        field.uncheck();
      }
    } else if (fieldType === 'PDFRadioGroup' || fieldType === 'PDFDropdown') {
      field.select(String(value));
    }
  } catch (err) {
    console.warn(`Could not set field value: ${err.message}`);
  }
}

module.exports = {
  populatePDFWithMapping,
  getNestedValue,
  transformFieldValue,
  setFieldValue
};
