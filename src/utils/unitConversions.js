// src/utils/unitConversions.js

// Define Unit Conversion Rates
export const unitConversionRates = {
  'mass': { 'base': 'kg', 'kg': 1, 'g': 0.001, 'ton': 1000, 'lb': 0.453592, 'oz': 0.0283495 },
  'length': { 'base': 'meter', 'meter': 1, 'cm': 0.01, 'mm': 0.001, 'km': 1000, 'feet': 0.3048, 'yard': 0.9144 },
  'volume': { 'base': 'litre', 'litre': 1, 'ml': 0.001, 'gallon': 3.78541 },
  'count': { 'base': 'pcs', 'pcs': 1, 'dozen': 12, 'bundle': 1, 'set': 1, 'pair': 2, 'ream': 500 },
  'area': { 'base': 'sqm', 'sqm': 1, 'sqft': 0.092903 },
  'roll': { 'base': 'roll', 'roll': 1 },
  'sheet': { 'base': 'sheet', 'sheet': 1 },
  'bag': { 'base': 'bag', 'bag': 1 }
};

// Function to find the category of a unit
export const getUnitCategory = (unitName) => {
  for (const category in unitConversionRates) {
    if (unitConversionRates[category][unitName]) {
      return category;
    }
  }
  return null;
};

// Function to convert quantity from one unit to another within the same category
export const convertUnit = (quantity, fromUnit, toUnit) => {
  const category = getUnitCategory(fromUnit);
  if (!category || !unitConversionRates[category][fromUnit] || !unitConversionRates[category][toUnit]) {
    console.warn(`Unit conversion not defined for ${fromUnit} or ${toUnit}. Returning original quantity.`);
    return quantity;
  }
  const quantityInBase = quantity * unitConversionRates[category][fromUnit];
  return quantityInBase / unitConversionRates[category][toUnit];
};