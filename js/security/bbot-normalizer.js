import { createEmptySecurityState } from './model.js';

const DOMAIN_EVENT_TYPES = new Set(['DNS_NAME', 'DNS_NAME_UNRESOLVED']);
const FINDING_EVENT_TYPES = new Set(['FINDING', 'VULNERABILITY']);

function toText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeTags(tags) {
  return Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => toText(tag).toLowerCase()).filter(Boolean)))
    : [];
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  const date = Number.isFinite(number)
    ? new Date(number > 1e12 ? number : number * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestTimestamp(values) {
  const valid = values.map(normalizeTimestamp).filter(Boolean).sort();
  return valid.length ? valid[valid.length - 1] : null;
}

function eventPayload(event) {
  if (event && typeof event.data_json === 'object' && event.data_json !== null) {
    return event.data_json;
  }
  return event?.data;
}

function parseJsonOrJsonl(input) {
  if (typeof input !== 'string') return input;
  const text = input.trim();
  if (!text) throw new Error('O scan de segurança está vazio.');

  try {
    return JSON.parse(text);
  } catch (jsonError) {
    const events = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`JSONL inválido na linha ${index + 1}.`);
        }
      });
    if (!events.length) throw jsonError;
    return events;
  }
}

function eventId(event, index) {
  return toText(event?.uuid) || toText(event?.id) || `event-${index + 1}`;
}

function inferTarget(events = [], explicitTarget) {
  const direct = toText(explicitTarget);
  if (direct) return direct.toLowerCase();

  const targetEvent = events.find((event) => {
    const tags = normalizeTags(event?.tags);
    return (
      DOMAIN_EVENT_TYPES.has(toText(event?.type).toUpperCase()) &&
      (toText(event?.module).toUpperCase() === 'TARGET' || tags.includes('target'))
    );
  });

  const value = toText(eventPayload(targetEvent));
  return value ? value.toLowerCase() : null;
}

function isChildDomain(value, target) {
  const host = toText(value).toLowerCase();
  const root = toText(target).toLowerCase();
  return Boolean(root && host && host !== root && host.endsWith(`.${root}`));
}

function parseHostPort(value, fallbackHost, dataJson) {
  const structuredPort = Number(dataJson?.port);
  if (Number.isInteger(structuredPort) && structuredPort > 0) {
    return { host: toText(dataJson?.host) || toText(fallbackHost), port: structuredPort };
  }

  const raw = toText(value);
  const bracketMatch = raw.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketMatch) {
    return { host: toText(fallbackHost) || bracketMatch[1], port: Number(bracketMatch[2]) };
  }

  const lastColon = raw.lastIndexOf(':');
  if (lastColon > 0) {
    const port = Number(raw.slice(lastColon + 1));
    if (Number.isInteger(port) && port > 0) {
      return { host: toText(fallbackHost) || raw.slice(0, lastColon), port };
    }
  }

  return { host: toText(fallbackHost) || raw, port: null };
}

function protocolFor({ tags = [], port, explicit }) {
  const direct = toText(explicit).toLowerCase().replace(/:$/, '');
  if (direct) return direct;
  if (tags.includes('https') || tags.includes('tls') || port === 443) return 'https';
  if (tags.includes('http') || port === 80) return 'http';
  return null;
}

function addUnique(list, seen, key, item) {
  if (!key || seen.has(key)) return;
  seen.add(key);
  list.push(item);
}

function normalizeMockPayload(payload, { source }) {
  const state = createEmptySecurityState();
  state.scan = {
    target: toText(payload?.scan?.target).toLowerCase() || null,
    timestamp: normalizeTimestamp(payload?.scan?.timestamp),
    source: source || toText(payload?.scan?.source) || 'mock',
    format: 'btc-journal-security-v1',
  };

  const assetSeen = new Set();
  const subdomainSeen = new Set();
  const hostSeen = new Set();
  const serviceSeen = new Set();
  const findingSeen = new Set();

  for (const [index, rawAsset] of (payload?.assets || []).entries()) {
    const type = toText(rawAsset?.type).toLowerCase();
    const value = toText(rawAsset?.value || rawAsset?.host);
    const host = toText(rawAsset?.host || rawAsset?.value);
    const port = Number(rawAsset?.port);
    const protocol = toText(rawAsset?.protocol).toLowerCase() || null;

    if (type === 'service') {
      const service = {
        id: toText(rawAsset?.id) || `mock-service-${index + 1}`,
        host,
        port: Number.isInteger(port) && port > 0 ? port : null,
        protocol,
        status: toText(rawAsset?.status) || null,
        sourceModule: toText(rawAsset?.sourceModule) || 'mock',
        scopeDistance: 0,
        tags: [],
        parentId: null,
        eventId: null,
      };
      const key = `${service.host}:${service.port || ''}:${service.protocol || ''}`;
      addUnique(state.services, serviceSeen, key, service);
      addUnique(state.assets, assetSeen, `service:${key}`, {
        type: 'service',
        value: service.host,
        host: service.host,
        port: service.port,
        protocol: service.protocol,
        sourceModule: service.sourceModule,
        scopeDistance: 0,
        tags: [],
        parentId: null,
        eventId: null,
      });
      continue;
    }

    if (type === 'finding') {
      addUnique(state.findings, findingSeen, value || `finding-${index}`, {
        id: toText(rawAsset?.id) || `mock-finding-${index + 1}`,
        type: 'finding',
        host,
        severity: toText(rawAsset?.severity).toUpperCase() || null,
        description: value,
        sourceModule: toText(rawAsset?.sourceModule) || 'mock',
      });
      continue;
    }

    const normalizedType =
      type === 'domain' || type === 'subdomain' || type === 'host' || type === 'url'
        ? type
        : 'asset';
    const asset = {
      type: normalizedType,
      value,
      host,
      port: null,
      protocol: null,
      sourceModule: toText(rawAsset?.sourceModule) || 'mock',
      scopeDistance: 0,
      tags: [],
      parentId: null,
      eventId: null,
    };
    addUnique(state.assets, assetSeen, `${normalizedType}:${value}`, asset);

    if (normalizedType === 'subdomain') {
      addUnique(state.subdomains, subdomainSeen, value.toLowerCase(), value.toLowerCase());
    }
    if (normalizedType === 'host') {
      addUnique(state.hosts, hostSeen, value.toLowerCase(), value);
    }
  }

  return state;
}

function normalizeBbotEvents(events, { target, timestamp, source }) {
  const state = createEmptySecurityState();
  const inferredTarget = inferTarget(events, target);
  state.scan = {
    target: inferredTarget,
    timestamp: normalizeTimestamp(timestamp) || latestTimestamp(events.map((event) => event?.timestamp)),
    source: source || 'bbot',
    format: 'bbot-event-stream',
  };

  const assetSeen = new Set();
  const subdomainSeen = new Set();
  const hostSeen = new Set();
  const serviceSeen = new Set();
  const findingSeen = new Set();
  const relationSeen = new Set();

  events.forEach((event, index) => {
    if (!event || typeof event !== 'object') return;

    const type = toText(event.type).toUpperCase();
    const tags = normalizeTags(event.tags);
    const data = eventPayload(event);
    const dataText = typeof data === 'string' ? data.trim() : '';
    const id = eventId(event, index);
    const parentId = toText(event.parent) || null;
    const scopeDistance = Number.isFinite(Number(event.scope_distance))
      ? Number(event.scope_distance)
      : null;
    const sourceModule = toText(event.module) || null;
    const hostFromEvent = toText(event.host);

    if (parentId) {
      addUnique(state.relations, relationSeen, `${parentId}->${id}`, {
        from: parentId,
        to: id,
        type: 'discovered',
      });
    }

    if (DOMAIN_EVENT_TYPES.has(type) && dataText) {
      const normalizedHost = dataText.toLowerCase();
      const domainType =
        inferredTarget && normalizedHost === inferredTarget
          ? 'domain'
          : isChildDomain(normalizedHost, inferredTarget) || tags.includes('subdomain')
            ? 'subdomain'
            : 'domain';

      addUnique(state.assets, assetSeen, `${domainType}:${normalizedHost}`, {
        type: domainType,
        value: normalizedHost,
        host: normalizedHost,
        port: null,
        protocol: null,
        sourceModule,
        scopeDistance,
        tags,
        parentId,
        eventId: id,
        resolved: type !== 'DNS_NAME_UNRESOLVED',
      });

      if (domainType === 'subdomain') {
        addUnique(state.subdomains, subdomainSeen, normalizedHost, normalizedHost);
      }
      return;
    }

    if (type === 'IP_ADDRESS' && dataText) {
      addUnique(state.hosts, hostSeen, dataText, dataText);
      addUnique(state.assets, assetSeen, `host:${dataText}`, {
        type: 'host',
        value: dataText,
        host: dataText,
        port: null,
        protocol: null,
        sourceModule,
        scopeDistance,
        tags,
        parentId,
        eventId: id,
      });
      return;
    }

    if (type === 'OPEN_TCP_PORT') {
      const structured = typeof data === 'object' && data !== null ? data : {};
      const { host, port } = parseHostPort(dataText, hostFromEvent, structured);
      const protocol = protocolFor({ tags, port, explicit: structured.protocol });
      const key = `${host}:${port || ''}:${protocol || ''}`;
      const service = {
        id,
        host,
        port,
        protocol,
        status: null,
        sourceModule,
        scopeDistance,
        tags,
        parentId,
        eventId: id,
      };
      addUnique(state.services, serviceSeen, key, service);
      addUnique(state.assets, assetSeen, `service:${key}`, {
        type: 'service',
        value: host,
        host,
        port,
        protocol,
        sourceModule,
        scopeDistance,
        tags,
        parentId,
        eventId: id,
      });
      return;
    }

    if (type === 'URL' && dataText) {
      let parsedUrl = null;
      try {
        parsedUrl = new URL(dataText);
      } catch (error) {}
      const host = parsedUrl?.hostname || hostFromEvent || dataText;
      const protocol = parsedUrl?.protocol?.replace(':', '') || null;
      const port = parsedUrl?.port
        ? Number(parsedUrl.port)
        : protocol === 'https'
          ? 443
          : protocol === 'http'
            ? 80
            : null;

      addUnique(state.assets, assetSeen, `url:${dataText}`, {
        type: 'url',
        value: dataText,
        host,
        port,
        protocol,
        sourceModule,
        scopeDistance,
        tags,
        parentId,
        eventId: id,
      });
      if (host && port) {
        const key = `${host}:${port}:${protocol || ''}`;
        addUnique(state.services, serviceSeen, key, {
          id,
          host,
          port,
          protocol,
          status: null,
          sourceModule,
          scopeDistance,
          tags,
          parentId,
          eventId: id,
        });
      }
      return;
    }

    if (type === 'HTTP_RESPONSE') {
      const structured = typeof data === 'object' && data !== null ? data : {};
      const urlValue = toText(structured.url || structured.input || structured.request_url);
      let parsedUrl = null;
      try {
        parsedUrl = urlValue ? new URL(urlValue) : null;
      } catch (error) {}
      const host = parsedUrl?.hostname || hostFromEvent;
      const protocol = parsedUrl?.protocol?.replace(':', '') || protocolFor({ tags });
      const port = parsedUrl?.port
        ? Number(parsedUrl.port)
        : protocol === 'https'
          ? 443
          : protocol === 'http'
            ? 80
            : null;
      if (host) {
        const key = `${host}:${port || ''}:${protocol || ''}`;
        addUnique(state.services, serviceSeen, key, {
          id,
          host,
          port,
          protocol,
          status: Number.isFinite(Number(structured.status_code))
            ? Number(structured.status_code)
            : null,
          sourceModule,
          scopeDistance,
          tags,
          parentId,
          eventId: id,
        });
      }
      return;
    }

    if (FINDING_EVENT_TYPES.has(type)) {
      const structured = typeof data === 'object' && data !== null ? data : {};
      const description = toText(
        structured.description || structured.name || structured.message || dataText || type
      );
      const host = toText(structured.host) || hostFromEvent || null;
      const severity = toText(structured.severity).toUpperCase() || null;
      addUnique(state.findings, findingSeen, `${type}:${host || ''}:${description}`, {
        id,
        type: type.toLowerCase(),
        host,
        severity,
        description,
        sourceModule,
      });
    }
  });

  state.assets.sort((a, b) =>
    `${a.type}:${a.value}:${a.port || ''}`.localeCompare(
      `${b.type}:${b.value}:${b.port || ''}`
    )
  );
  state.subdomains.sort();
  state.hosts.sort();
  state.services.sort((a, b) =>
    `${a.host}:${a.port || ''}`.localeCompare(`${b.host}:${b.port || ''}`)
  );

  return state;
}

export function normalizeSecurityInput(input, options = {}) {
  const parsed = parseJsonOrJsonl(input);

  if (
    parsed &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.assets) &&
    parsed.scan &&
    typeof parsed.scan === 'object'
  ) {
    return normalizeMockPayload(parsed, options);
  }

  const events = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.events)
      ? parsed.events
      : parsed?.type
        ? [parsed]
        : null;

  if (!events) {
    throw new Error(
      'Formato de scan não reconhecido. Use JSON/JSONL de eventos BBOT ou o mock do Security Center.'
    );
  }

  return normalizeBbotEvents(events, {
    target: options.target || parsed?.scan?.target,
    timestamp: options.timestamp || parsed?.scan?.timestamp,
    source: options.source,
  });
}
