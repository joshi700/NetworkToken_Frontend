import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { FLOWS } from '../lib/flows';

const STEP_TONE = {
  createToken: 'bg-amber-50 text-amber-700 border-amber-200',
  retrieveToken: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paymentData: 'bg-amber-50 text-amber-700 border-amber-200',
  pay: 'bg-sky-50 text-sky-700 border-sky-200',
  outside: 'bg-purple-50 text-purple-700 border-purple-200'
};

const HomePage = () => {
  const navigate = useNavigate();
  const { config, testCard, isConfigured } = useConfig();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose a Flow</h1>
        <p className="text-gray-600">Each flow runs one API call at a time. You can edit the request before sending it.</p>
      </div>

      {!isConfigured && (
        <div className="mb-6 bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="font-medium">⚠️ Merchant credentials are not configured yet.</span>
          <button onClick={() => navigate('/settings')} className="btn-primary !py-1.5">Go to Settings</button>
        </div>
      )}

      <div className="card mb-6 bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Current Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-600">Merchant ID:</span> <span className="font-mono">{config.merchantId || '—'}</span></div>
          <div><span className="text-gray-600">Gateway:</span> <span className="font-mono">{config.apiBaseUrl}</span></div>
          <div><span className="text-gray-600">API Version:</span> <span className="font-mono">{config.apiVersion}</span></div>
          <div><span className="text-gray-600">Amount:</span> <span className="font-mono">{config.amount} {config.currency}</span></div>
          <div><span className="text-gray-600">Card:</span> <span className="font-mono">{testCard.cardNumber.replace(/^(\d{6})\d+(\d{4})$/, '$1••••••$2')}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FLOWS.map(flow => (
          <button
            key={flow.id}
            onClick={() => navigate(`/flow/${flow.id}`)}
            className="card text-left hover:shadow-md hover:border-primary-300 transition-all flex flex-col"
          >
            <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Flow {flow.number}</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{flow.name}</h3>
            <p className="text-sm text-gray-600 mb-4 flex-1">{flow.description}</p>
            <ol className="space-y-1.5">
              {flow.steps.map((s, i) => (
                <li key={s.id} className={`text-xs border rounded-md px-2 py-1 flex items-center gap-2 ${STEP_TONE[s.id]}`}>
                  <span className="font-mono font-bold w-10">{s.method || '→'}</span>
                  <span className="truncate">{i + 1}. {s.title}{s.optional ? ' (optional)' : ''}</span>
                </li>
              ))}
            </ol>
            <span className="mt-4 text-sm font-medium text-primary-600">Start flow →</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
