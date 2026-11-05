const CARE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const LIGHT_LEVELS = ['Low', 'Medium', 'High'];
const GROWTH_RATES = ['Slow', 'Moderate', 'Fast'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveNumber(value) {
  if (value === '' || value === undefined || value === null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function buildSpecifications(category, body = {}) {
  if (category === 'Aquatic Life') {
    return {
      lifespan: cleanText(body.lifespan),
      minimumTankSizeGallons: parsePositiveNumber(body.minimumTankSizeGallons),
      adultSize: cleanText(body.adultSize),
      careLevel: CARE_LEVELS.includes(body.careLevel) ? body.careLevel : undefined
    };
  }

  if (category === 'Plants') {
    return {
      lightRequirement: LIGHT_LEVELS.includes(body.lightRequirement) ? body.lightRequirement : undefined,
      growthRate: GROWTH_RATES.includes(body.growthRate) ? body.growthRate : undefined,
      maxHeight: cleanText(body.maxHeight),
      careLevel: CARE_LEVELS.includes(body.careLevel) ? body.careLevel : undefined
    };
  }

  return {
    productSize: cleanText(body.productSize),
    details: cleanText(body.productDetails)
  };
}

function validateSpecifications(category, body = {}) {
  const errors = [];

  if (category === 'Aquatic Life' && body.minimumTankSizeGallons) {
    if (!parsePositiveNumber(body.minimumTankSizeGallons)) {
      errors.push('Minimum tank size must be a number greater than 0');
    }
  }

  if (category === 'Aquatic Life' && body.careLevel && !CARE_LEVELS.includes(body.careLevel)) {
    errors.push('Please choose a valid care level');
  }

  if (category === 'Plants' && body.lightRequirement && !LIGHT_LEVELS.includes(body.lightRequirement)) {
    errors.push('Please choose a valid light requirement');
  }

  if (category === 'Plants' && body.growthRate && !GROWTH_RATES.includes(body.growthRate)) {
    errors.push('Please choose a valid growth rate');
  }

  if (category === 'Plants' && body.careLevel && !CARE_LEVELS.includes(body.careLevel)) {
    errors.push('Please choose a valid care level');
  }

  return errors;
}

module.exports = {
  buildSpecifications,
  validateSpecifications,
  CARE_LEVELS,
  LIGHT_LEVELS,
  GROWTH_RATES
};
