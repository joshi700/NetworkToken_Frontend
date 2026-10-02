import React from 'react';
import JsonView, { CopyButton } from './JsonView';
import { isMasked, VARIABLE_LABELS } from '../lib/flows';

// Flow 2 final step: hand the network token payment data to an external processor
const PaymentDataOutput = ({ step, index, vars, missing, config }) => {
  const ready = missing.length === 0;

  const rows = [
    ['Network Token (DPAN)', vars.dpan, 'PAN / DE 2'],
    ['Token Expiry', vars.dpanExpiryMonth ? `${vars.dpanExpiryMonth}/${vars.dpanExpiryYear}` : '', 'Expiry / DE 14'],
    ['Cryptogram', vars.cryptogram, 'UCAF (DE 48 SE 43) / TAVV'],
    ['ECI', vars.eci, 'ECI / SLI'],
    ['Token Provider', vars.schemeTokenProvider, ''],
    ['Card Brand', vars.cardBrand, '']
  ];

  const payload = {
    networkToken: vars.dpan,
    tokenExpiry: { month: vars.dpanExpiryMonth, year: vars.dpanExpiryYear },
    cryptogram: vars.cryptogram,
    eci: vars.eci,
    tokenProvider: vars.schemeTokenProvider,
    amount: vars.amount || config.amount,
    currency: config.currency
  };

  return (
    <div className={`card ${ready ? 'border-success-500/40' : ''}`}>
      <div className="flex items-start gap-3 mb-4">
        <span className={`step-indicator shrink-0 ${ready ? 'completed' : 'pending'}`}>{ready ? '✓' : index + 1}</span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">No gateway call</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{step.subtitle}</p>
        </div>
      </div>

      {!ready ? (
        <div className="bg-warning-50 border border-warning-100 text-warning-700 text-sm px-3 py-2 rounded-lg">
          ⏳ Waiting for: {missing.map(m => VARIABLE_LABELS[m] || m).join(', ')}. Run Generate Payment Data first.
        </div>
      ) : (
        <>
          {isMasked(vars.dpan) && (
            <div className="mb-4 bg-warning-50 border border-warning-100 text-warning-700 text-sm px-3 py-2 rounded-lg">
              ⚠️ The gateway returned a masked DPAN. To get the full token PAN, set Sensitive Data Control to <code className="font-mono">UNMASK</code> in Settings
              (<code className="font-mono">responseControls.sensitiveData</code>), if your merchant profile allows it.
            </div>
          )}
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 text-sm mb-4">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2">
                <div className="w-48 shrink-0">
                  <div className="text-gray-700 font-medium">{label}</div>
                  {hint && <div className="text-xs text-gray-400">{hint}</div>}
                </div>
                <span className="font-mono break-all flex-1">{value || <span className="text-gray-400">—</span>}</span>
                {value && <CopyButton text={String(value)} />}
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Payload for your processor</p>
          <JsonView value={payload} />
          <p className="text-xs text-gray-500 mt-3">
            Cryptograms are single-use and expire quickly. Generate new payment data for each authorization.
          </p>
        </>
      )}
    </div>
  );
};

export default PaymentDataOutput;
