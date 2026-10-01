/**
 * Developer & Testing Tools Configuration
 * 
 * Set ENABLED to false before production deployment to completely
 * strip and disable the Developer & Testing Panel.
 */
export const TESTING_TOOLS_CONFIG = {
  // Toggle testing tools environment
  ENABLED: true,
  
  // Prefix for test data identification
  TEST_DATA_PREFIX: '[TEST_DATA]',
  
  // Safe guard: allow resetting only test accounts, never real production accounts
  ALLOW_RESET_PRODUCTION: false,
};

export function areTestingToolsEnabled(): boolean {
  return TESTING_TOOLS_CONFIG.ENABLED === true;
}
