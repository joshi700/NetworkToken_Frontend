import React from 'react';
import { Link } from 'react-router-dom';

const DEV_DOCS = 'https://developer.mastercard.com/mastercard-gateway/documentation';

// One row per tokenisation model offered through the Mastercard Gateway
const MODELS = [
  {
    name: 'Fully managed',
    tag: 'Gateway does everything',
    tone: 'border-sky-200 bg-sky-50',
    requestor: 'Mastercard Gateway',
    cryptogram: 'Gateway requests it from MDES / VTS / AETS at payment time',
    processor: 'Mastercard Gateway → merchant acquirer',
    merchantHolds: 'Gateway token only',
    calls: ['POST /token', 'PUT /order/{id}/transaction/{id}  (PAY with sourceOfFunds.token)'],
    summary:
      'The merchant only ever sends the gateway token. The gateway provisions the network token, keeps it in sync, uses it with a fresh cryptogram at authorisation, and falls back to the FPAN when no network token is available.',
    flow: { to: '/flow/gateway-pay', label: 'Flow 1' }
  },
  {
    name: 'Token Processing Service',
    tag: 'Gateway as token requestor',
    tone: 'border-emerald-200 bg-emerald-50',
    requestor: 'Mastercard Gateway, for the merchant or PSP',
    cryptogram: 'On request (see Standalone) or at payment time (see Fully managed)',
    processor: 'Gateway or an external PSP',
    merchantHolds: 'Gateway token only',
    calls: ['POST /token', 'GET /token/{id}', 'DELETE /token/{id}'],
    summary:
      'The token service layer underneath the other models. The gateway provisions network tokens for new and existing gateway tokens (ASYNCHRONOUS, ATTEMPT_SYNCHRONOUS or SYNCHRONOUS mode) and manages their lifecycle. Card updates go to the network token, and deleting the gateway token deletes the network token.',
    flow: { to: '/flow/tokenise-only', label: 'Flow 3' }
  },
  {
    name: 'Standalone tokenisation',
    tag: 'Tokenise here, pay elsewhere',
    tone: 'border-purple-200 bg-purple-50',
    requestor: 'Mastercard Gateway',
    cryptogram: 'Generate Payment Data, called before each authorisation',
    processor: 'External PSP / acquirer / other gateway',
    merchantHolds: 'Gateway token; gets the DPAN and cryptogram per transaction',
    calls: ['POST /token', 'POST /token/{id}/paymentData  (SSL certificate auth)'],
    summary:
      'The gateway is the vault and token requestor, but the payment is processed elsewhere. For each transaction the merchant asks the gateway for the network token PAN, expiry, cryptogram (and ECI for VTS), then sends them to another PSP.',
    flow: { to: '/flow/external-pay', label: 'Flow 2' }
  },
  {
    name: 'External Token Processing Service',
    tag: 'Tokens from outside, processing here',
    tone: 'border-amber-200 bg-amber-50',
    requestor: 'Another token requestor (merchant, PSP or wallet)',
    cryptogram: 'Provided by the external token service',
    processor: 'Mastercard Gateway → merchant acquirer',
    merchantHolds: 'Network tokens held by the external token service',
    calls: ['PUT /order/{id}/transaction/{id}  (PAY with sourceOfFunds.type = SCHEME_TOKEN)'],
    summary:
      'Network tokens are provisioned and managed by a token service outside the gateway, such as a merchant integrated directly with MDES or a third-party token vault. The gateway processes the authorisations it receives with those tokens.',
    flow: { to: '/flow/pass-through', label: 'Flow 4' }
  },
  {
    name: 'Pass-through',
    tag: 'Gateway forwards token data',
    tone: 'border-gray-200 bg-gray-50',
    requestor: 'Not the gateway',
    cryptogram: 'Supplied in the PAY / AUTHORIZE request',
    processor: 'Mastercard Gateway → merchant acquirer',
    merchantHolds: 'Network token + cryptogram per transaction',
    calls: ['PUT /order/{id}/transaction/{id}  (SCHEME_TOKEN + provided.card + devicePayment)'],
    summary:
      'The gateway stores nothing about the token. It validates the network token, cryptogram and ECI in the request and passes them to the acquirer. This is the "network token payments" integration in the Mastercard docs.',
    flow: { to: '/flow/pass-through', label: 'Flow 4' }
  }
];

const EXTERNAL_PSP_FIELDS = [
  ['Network token PAN', 'sourceOfFunds.provided.card.deviceSpecificNumber', 'Card number / DE 2'],
  ['Token expiry', 'sourceOfFunds.provided.card.deviceSpecificExpiry.month / .year', 'Expiry / DE 14'],
  ['Cryptogram', 'sourceOfFunds.provided.card.devicePayment.onlinePaymentCryptogram', 'UCAF (DE 48 SE 43) for MDES, TAVV for VTS'],
  ['ECI', 'sourceOfFunds.provided.card.devicePayment.eciIndicator', 'ECI. Returned for VTS tokens only'],
  ['Dynamic code', 'sourceOfFunds.provided.card.securityCode', 'DTVV (VTS) or DCSC (AETS), instead of a full cryptogram'],
  ['Token type', 'sourceOfFunds.type = SCHEME_TOKEN', 'Flag the authorisation as a network token transaction']
];

const Box = ({ title, sub, tone = 'bg-white border-gray-200' }) => (
  <div className={`border rounded-lg px-3 py-2 text-center min-w-[120px] ${tone}`}>
    <div className="text-sm font-semibold text-gray-900">{title}</div>
    {sub && <div className="text-[11px] text-gray-500 font-mono">{sub}</div>}
  </div>
);
const Arrow = ({ label }) => (
  <div className="flex flex-col items-center text-gray-400 px-1">
    <span className="text-[10px] text-gray-500 whitespace-nowrap">{label}</span>
    <span className="text-lg leading-none">→</span>
  </div>
);

const LearnPage = () => (
  <div className="max-w-6xl mx-auto">
    <div className="text-center mb-10">
      <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">Mastercard Gateway</p>
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Unified Tokenisation</h1>
      <p className="text-gray-600 max-w-3xl mx-auto">
        The merchant keeps one gateway token per card. Under it, the gateway can request and manage a network token
        (MDES, VTS, AETS) and use it in different ways: process the payment itself, hand the network token and cryptogram to
        another PSP, or accept network tokens that were created elsewhere.
      </p>
    </div>

    {/* Layer diagram */}
    <div className="card mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">How the pieces fit</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
          <p className="font-semibold text-primary-800 mb-1">1. Gateway token</p>
          <p className="text-gray-700">What the merchant stores. It is PAN-shaped, sits in the gateway vault and points to the FPAN and the network token.</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-800 mb-1">2. Network token</p>
          <p className="text-gray-700">Provisioned by the gateway as token requestor. Issuers keep it up to date, and it carries a dynamic cryptogram per transaction.</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <p className="font-semibold text-purple-800 mb-1">3. Where the payment goes</p>
          <p className="text-gray-700">The gateway's own acquirer (fully managed), or any external PSP using payment data from the gateway (standalone).</p>
        </div>
      </div>
    </div>

    {/* Comparison table */}
    <div className="card mb-8 overflow-x-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Tokenisation models at a glance</h2>
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-3">Model</th>
            <th className="py-2 pr-3">Token requestor</th>
            <th className="py-2 pr-3">Cryptogram from</th>
            <th className="py-2 pr-3">Payment processed by</th>
            <th className="py-2">Try it</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {MODELS.map(m => (
            <tr key={m.name} className="align-top">
              <td className="py-2.5 pr-3 font-semibold text-gray-900">{m.name}</td>
              <td className="py-2.5 pr-3 text-gray-700">{m.requestor}</td>
              <td className="py-2.5 pr-3 text-gray-700">{m.cryptogram}</td>
              <td className="py-2.5 pr-3 text-gray-700">{m.processor}</td>
              <td className="py-2.5"><Link to={m.flow.to} className="text-primary-600 hover:underline whitespace-nowrap">{m.flow.label} →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Model cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {MODELS.map(m => (
        <div key={m.name} className={`rounded-xl border p-5 ${m.tone}`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{m.name}</h3>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.tag}</p>
            </div>
            <Link to={m.flow.to} className="text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 whitespace-nowrap">
              Run {m.flow.label}
            </Link>
          </div>
          <p className="text-sm text-gray-700 mb-3">{m.summary}</p>
          <dl className="text-xs grid grid-cols-[120px_1fr] gap-y-1 mb-3">
            <dt className="text-gray-500">Merchant stores</dt><dd className="text-gray-800">{m.merchantHolds}</dd>
            <dt className="text-gray-500">Processed by</dt><dd className="text-gray-800">{m.processor}</dd>
          </dl>
          <div className="space-y-1">
            {m.calls.map(c => (
              <code key={c} className="block text-[11px] font-mono bg-white/70 border border-gray-200 rounded px-2 py-1 text-gray-800">{c}</code>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* External PSP */}
    <div className="card mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Transacting with an external PSP using network tokens</h2>
      <p className="text-sm text-gray-600 mb-5">
        Standalone tokenisation lets the Mastercard Gateway be the merchant's single token vault and token requestor while
        authorisations are routed to another PSP. The network token is processor-agnostic, so the same token can be used with
        any acquirer.
      </p>

      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Once per card</p>
      <div className="flex flex-wrap items-center gap-1 mb-5">
        <Box title="Merchant" sub="FPAN" />
        <Arrow label="POST /token" />
        <Box title="Mastercard Gateway" sub="gateway token" tone="bg-primary-50 border-primary-200" />
        <Arrow label="provision" />
        <Box title="MDES / VTS / AETS" sub="network token" tone="bg-emerald-50 border-emerald-200" />
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Every transaction</p>
      <div className="flex flex-wrap items-center gap-1 mb-6">
        <Box title="Merchant" sub="gateway token" />
        <Arrow label="paymentData (mTLS)" />
        <Box title="Mastercard Gateway" sub="DPAN + cryptogram" tone="bg-primary-50 border-primary-200" />
        <Arrow label="DPAN, expiry, cryptogram, ECI" />
        <Box title="External PSP" sub="SCHEME_TOKEN auth" tone="bg-purple-50 border-purple-200" />
        <Arrow label="" />
        <Box title="Acquirer → Network" sub="detokenise" />
        <Arrow label="" />
        <Box title="Issuer" sub="approve" />
      </div>

      <h3 className="font-semibold text-gray-800 mb-2">What to send to the external PSP</h3>
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Generate Payment Data response field</th>
              <th className="py-2">In the external authorisation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EXTERNAL_PSP_FIELDS.map(([d, f, use]) => (
              <tr key={d}>
                <td className="py-2 pr-3 font-medium text-gray-900">{d}</td>
                <td className="py-2 pr-3 font-mono text-xs text-gray-700">{f}</td>
                <td className="py-2 text-gray-700">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-warning-50 border border-warning-100 rounded-lg p-4">
          <p className="font-semibold text-warning-700 mb-1">Prerequisites</p>
          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
            <li>Your PSP enables network tokenisation and standalone tokenisation on the merchant profile</li>
            <li>Calls are made with SSL certificate authentication (to the certificate-auth host)</li>
            <li>The network token status is <code className="font-mono">ACTIVE</code> (check with Retrieve Token)</li>
            <li>API version 100 or later</li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-semibold text-blue-900 mb-1">Things to keep in mind</p>
          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
            <li>Cryptograms are single-use. Generate new payment data for each authorisation.</li>
            <li>If the token service provider fails, the call returns <code className="font-mono">result=FAILURE</code>; retry later</li>
            <li>The gateway still manages the token lifecycle: card updates go through, and deleting the gateway token deletes the network token</li>
            <li>The response carries a token PAN, so plan the PCI scope of the system that calls the external PSP</li>
          </ul>
        </div>
      </div>
    </div>

    {/* SSL */}
    <div className="card mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">🔏 Why the website can't run Generate Payment Data live</h2>
      <p className="text-sm text-gray-600 mb-4">
        The gateway returns the network token PAN and cryptogram only over SSL client-certificate (mutual TLS) authentication.
        With the API password it rejects the call with: <em>"You must use SSL certificate authentication … to retrieve payment
        details for a scheme token."</em> To run it live you need:
      </p>
      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-4">
        <li>An X.509 client certificate from a Mastercard-approved CA (for example DigiCert), with <code className="font-mono">clientAuth</code> key usage and the merchant's name in the subject</li>
        <li>The certificate registered on the merchant profile by your PSP in Merchant Manager</li>
        <li>The certificate-auth host name from your PSP. It is different from the API-password host.</li>
        <li>Standalone tokenisation and network tokenisation enabled, and a test card that provisions an <code className="font-mono">ACTIVE</code> network token</li>
      </ol>
      <div className="flex flex-wrap gap-3">
        <Link to="/settings" className="btn-primary !py-2 text-sm">Add certificate in Settings</Link>
        <Link to="/flow/external-pay" className="btn-secondary !py-2 text-sm">Demo Flow 2 with a sample response</Link>
      </div>
    </div>

    <div className="text-xs text-gray-500 mb-4">
      <p className="mb-1">
        Sources:{' '}
        <a className="text-primary-600 hover:underline" href={`${DEV_DOCS}/security-and-fraud/tokenization/network-tokenization/`} target="_blank" rel="noreferrer">Network Tokenization</a>
        {' · '}
        <a className="text-primary-600 hover:underline" href={`${DEV_DOCS}/security-and-fraud/tokenization/gw-tokenization/`} target="_blank" rel="noreferrer">Gateway Tokenization</a>
        {' · '}
        <a className="text-primary-600 hover:underline" href={`${DEV_DOCS}/security-and-fraud/secure-int-pw-cert/`} target="_blank" rel="noreferrer">Passwords or Certificates</a>
      </p>
      <p>
        The Mastercard developer docs describe standalone tokenisation, network tokenisation for gateway tokens (fully managed) and
        network token payments (pass-through). The other model names come from Mastercard Gateway product positioning.
      </p>
    </div>
  </div>
);

export default LearnPage;
