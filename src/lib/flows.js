// Step + flow definitions for the Network Token tool.
// Each request step builds its default URL/body from `env` = { base, config, testCard, tokenOptions, vars }
// and extracts values from the gateway response into shared flow variables.

const DOCS = 'https://na-gateway.mastercard.com/api/documentation/apiDocumentation/rest-json/version/100/operation';

export const generateId = (prefix) => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rnd}`.toUpperCase();
};

// Certificate-authenticated requests go to a separate host supplied by the PSP
export const merchantBase = (config, auth = 'password') => {
  const host = auth === 'certificate' && config.certApiBaseUrl ? config.certApiBaseUrl : config.apiBaseUrl;
  return `${host.replace(/\/$/, '')}/api/rest/version/${config.apiVersion}/merchant/${config.merchantId || '{merchantId}'}`;
};

export const isMasked = (value) => typeof value === 'string' && /x/i.test(value);

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ── Request steps ──────────────────────────────────────────────────────

const createToken = {
  id: 'createToken',
  title: 'Create Network Token',
  subtitle: 'Store the card against a gateway token. If your token repository is enabled for scheme tokenization, the gateway also provisions a network token (DPAN) with MDES / VTS.',
  operation: 'Tokenization: Create or Update Token (with system-generated token)',
  docs: `${DOCS}/Tokenization%3a%20%20Create%20or%20Update%20Token%20(with%20system-generated%20token).html`,
  method: 'POST',
  url: ({ base }) => `${base}/token`,
  body: ({ testCard }) => ({
    sourceOfFunds: {
      type: 'CARD',
      provided: {
        card: {
          number: testCard.cardNumber,
          expiry: { month: testCard.expiryMonth, year: testCard.expiryYear },
          ...(testCard.nameOnCard ? { nameOnCard: testCard.nameOnCard } : {})
        }
      }
    }
  }),
  extract: (data) => ({
    gatewayToken: data?.token,
    schemeTokenProvider: get(data, 'schemeToken.provider'),
    schemeTokenStatus: get(data, 'schemeToken.status'),
    tokenStatus: data?.status
  })
};

const retrieveToken = {
  id: 'retrieveToken',
  title: 'Retrieve Token',
  subtitle: 'Check the network token status. If it is still PROVISIONING, wait a few seconds and send this again until it is ACTIVE.',
  operation: 'Tokenization: Retrieve Token',
  docs: `${DOCS}/Tokenization%3a%20%20Retrieve%20Token.html`,
  method: 'GET',
  optional: true,
  requires: ['gatewayToken'],
  url: ({ base, vars }) => `${base}/token/${vars.gatewayToken || '{token}'}`,
  body: null,
  extract: (data) => ({
    schemeTokenProvider: get(data, 'schemeToken.provider'),
    schemeTokenStatus: get(data, 'schemeToken.status'),
    tokenStatus: data?.status
  })
};

const generatePaymentData = {
  id: 'paymentData',
  title: 'Generate Payment Data',
  subtitle: 'Ask the gateway for the network token (DPAN), its expiry, a fresh cryptogram and the ECI to use in an authorization. Uses the API password unless certificate auth is enabled in Settings.',
  operation: 'Tokenization: Generate Payment Data',
  docs: `${DOCS}/Tokenization%3a%20Generate%20Payment%20Data.html`,
  method: 'POST',
  auth: 'certificate', // eligible for certificate auth when Settings scope = paymentData
  requires: ['gatewayToken'],
  url: ({ base, vars }) => `${base}/token/${vars.gatewayToken || '{token}'}/paymentData`,
  body: ({ tokenOptions }) => {
    const body = {};
    if (tokenOptions.preferredCryptogramType) {
      body.schemeToken = { preferredCryptogramType: tokenOptions.preferredCryptogramType };
    }
    if (tokenOptions.sensitiveData) {
      body.responseControls = { sensitiveData: tokenOptions.sensitiveData };
    }
    return body;
  },
  // Illustrative response, shaped like the Generate Payment Data example in the Mastercard developer docs.
  // Used to demo the flow when the merchant isn't set up for certificate authentication.
  sample: ({ vars }) => ({
    repositoryId: 'SAMPLE_REPO',
    result: 'SUCCESS',
    schemeToken: { provider: 'MDES', status: 'ACTIVE', statusTime: new Date().toISOString() },
    sourceOfFunds: {
      provided: {
        card: {
          brand: 'MASTERCARD',
          devicePayment: { onlinePaymentCryptogram: 'AAABBBCCCDDDEEEFFF000111222=' },
          deviceSpecificExpiry: { month: '11', year: '30' },
          deviceSpecificNumber: '5204247750001497',
          expiry: { month: '1', year: '39' },
          fundingMethod: 'CREDIT',
          number: '511111xxxxxx1118',
          scheme: 'MASTERCARD'
        }
      },
      type: 'SCHEME_TOKEN'
    },
    status: 'VALID',
    token: vars.gatewayToken || '5111113656701118'
  }),
  extract: (data) => {
    const card = get(data, 'sourceOfFunds.provided.card') || {};
    return {
      dpan: card.deviceSpecificNumber,
      dpanExpiryMonth: get(card, 'deviceSpecificExpiry.month'),
      dpanExpiryYear: get(card, 'deviceSpecificExpiry.year'),
      cryptogram: get(card, 'devicePayment.onlinePaymentCryptogram'),
      eci: get(card, 'devicePayment.eciIndicator'),
      fpanMasked: card.number,
      cardBrand: card.brand,
      schemeTokenProvider: get(data, 'schemeToken.provider'),
      schemeTokenStatus: get(data, 'schemeToken.status')
    };
  }
};

const payWithPaymentData = {
  id: 'pay',
  title: 'Pay (Gateway)',
  subtitle: 'Authorize and capture through the gateway with the gateway token, plus the network token payment data from the previous step when you have it. With the token only, the gateway picks the network token and gets the cryptogram itself (fully managed).',
  operation: 'Transaction: Pay',
  docs: `${DOCS}/Transaction%3a%20%20Pay.html`,
  method: 'PUT',
  requires: ['gatewayToken'],
  url: ({ base, vars }) => `${base}/order/${vars.orderId}/transaction/${vars.transactionId}`,
  body: ({ config, tokenOptions, vars }) => {
    const card = {};
    if (vars.dpan && !isMasked(vars.dpan)) {
      card.number = vars.dpan;
      if (vars.dpanExpiryMonth) card.expiry = { month: vars.dpanExpiryMonth, year: vars.dpanExpiryYear };
    }
    const devicePayment = {};
    if (vars.cryptogram) devicePayment.onlinePaymentCryptogram = vars.cryptogram;
    if (vars.eci) devicePayment.eciIndicator = vars.eci;
    if (Object.keys(devicePayment).length) card.devicePayment = devicePayment;

    return {
      apiOperation: 'PAY',
      order: {
        amount: vars.amount || config.amount,
        currency: config.currency,
        reference: vars.orderId
      },
      sourceOfFunds: Object.keys(card).length
        ? { type: 'SCHEME_TOKEN', token: vars.gatewayToken || '{token}', provided: { card } }
        : { token: vars.gatewayToken || '{token}' },
      transaction: {
        source: tokenOptions.transactionSource || 'INTERNET',
        reference: vars.transactionId
      }
    };
  },
  extract: (data) => ({
    payResult: data?.result,
    gatewayCode: get(data, 'response.gatewayCode'),
    authorizationCode: get(data, 'transaction.authorizationCode')
  })
};

// Pass-through: the network token and cryptogram come from outside the gateway
const payPassThrough = {
  id: 'payPassThrough',
  title: 'Pay with External Network Token',
  subtitle: 'The merchant (or another token requestor) already has the network token and cryptogram from MDES / VTS. The gateway passes them to the acquirer as a SCHEME_TOKEN payment.',
  operation: 'Transaction: Pay',
  docs: `${DOCS}/Transaction%3a%20%20Pay.html`,
  method: 'PUT',
  url: ({ base, vars }) => `${base}/order/${vars.orderId}/transaction/${vars.transactionId}`,
  body: ({ config, tokenOptions, vars }) => {
    const ext = tokenOptions.externalToken || {};
    const devicePayment = {};
    if (ext.cryptogram) devicePayment.onlinePaymentCryptogram = ext.cryptogram;
    if (ext.eci) devicePayment.eciIndicator = ext.eci;
    return {
      apiOperation: 'PAY',
      order: { amount: vars.amount || config.amount, currency: config.currency, reference: vars.orderId },
      sourceOfFunds: {
        type: 'SCHEME_TOKEN',
        provided: {
          card: {
            number: ext.number,
            expiry: { month: ext.expiryMonth, year: ext.expiryYear },
            ...(Object.keys(devicePayment).length ? { devicePayment } : {})
          }
        }
      },
      transaction: { source: tokenOptions.transactionSource || 'INTERNET', reference: vars.transactionId }
    };
  },
  extract: (data) => ({
    payResult: data?.result,
    gatewayCode: get(data, 'response.gatewayCode'),
    authorizationCode: get(data, 'transaction.authorizationCode')
  })
};

// Not a gateway call: hands the payment data off for an external authorization
const useOutside = {
  id: 'outside',
  type: 'output',
  title: 'Use Payment Data Outside the Gateway',
  subtitle: 'Copy the network token payment data and send it to your own acquirer / processor for authorization.',
  requires: ['cryptogram']
};

// ── Flows ──────────────────────────────────────────────────────────────

export const FLOWS = [
  {
    id: 'gateway-pay',
    number: 1,
    model: 'Fully managed',
    name: 'Tokenise → Payment Data → Pay',
    short: 'Generate a network token, get payment data, and pay through the gateway',
    description: 'End-to-end with the gateway: provision the network token, generate a cryptogram, then send PAY with the token and payment data.',
    steps: [createToken, retrieveToken, generatePaymentData, payWithPaymentData]
  },
  {
    id: 'external-pay',
    number: 2,
    model: 'Standalone tokenisation',
    name: 'Tokenise → Payment Data → Pay Outside',
    short: 'Generate a network token and payment data, then pay outside the gateway',
    description: 'The gateway provisions the token and generates the cryptogram. You take the DPAN, cryptogram and ECI to another processor.',
    steps: [createToken, retrieveToken, generatePaymentData, useOutside]
  },
  {
    id: 'tokenise-only',
    number: 3,
    model: 'Token provisioning',
    name: 'Tokenise Only',
    short: 'Only generate a network token',
    description: 'Provision a network token for the card and check its status. No cryptogram is generated and no payment is made.',
    steps: [createToken, retrieveToken]
  },
  {
    id: 'pass-through',
    number: 4,
    model: 'Pass-through',
    name: 'Pay with External Network Token',
    short: 'Pass a network token and cryptogram from outside the gateway into PAY',
    description: 'You already have the network token and cryptogram from another token requestor. The gateway passes them through to the acquirer. This flow works with the API password.',
    steps: [payPassThrough]
  }
];

export const getFlow = (id) => FLOWS.find(f => f.id === id);

// Which auth method a step is sent with, given the Settings certificate scope
export const authForStep = (step, config) => {
  if (config.certScope === 'all') return 'certificate';
  if (config.certScope === 'paymentData' && step.auth === 'certificate') return 'certificate';
  return 'password';
};

export const VARIABLE_LABELS = {
  orderId: 'Order ID',
  transactionId: 'Transaction ID',
  amount: 'Amount',
  gatewayToken: 'Gateway Token',
  tokenStatus: 'Token Status',
  schemeTokenProvider: 'Scheme Token Provider',
  schemeTokenStatus: 'Network Token Status',
  cardBrand: 'Card Brand',
  fpanMasked: 'FPAN',
  dpan: 'Network Token (DPAN)',
  dpanExpiryMonth: 'DPAN Expiry Month',
  dpanExpiryYear: 'DPAN Expiry Year',
  cryptogram: 'Cryptogram',
  eci: 'ECI',
  payResult: 'Pay Result',
  gatewayCode: 'Gateway Code',
  authorizationCode: 'Auth Code'
};
