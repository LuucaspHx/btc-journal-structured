export const SECURITY_MODEL_VERSION = 1;

export function createEmptySecurityState() {
  return {
    modelVersion: SECURITY_MODEL_VERSION,
    scan: {
      target: null,
      timestamp: null,
      source: null,
      format: null,
    },
    assets: [],
    subdomains: [],
    hosts: [],
    services: [],
    findings: [],
    relations: [],
    history: [],
  };
}

export function summarizeSecurityState(state = createEmptySecurityState()) {
  return {
    target: state?.scan?.target || null,
    lastScan: state?.scan?.timestamp || null,
    assetsDiscovered: Array.isArray(state?.assets) ? state.assets.length : 0,
    subdomains: Array.isArray(state?.subdomains) ? state.subdomains.length : 0,
    publicServices: Array.isArray(state?.services) ? state.services.length : 0,
    findings: Array.isArray(state?.findings) ? state.findings.length : 0,
    relations: Array.isArray(state?.relations) ? state.relations.length : 0,
    newAssets: null,
  };
}
