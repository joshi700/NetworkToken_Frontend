import React, { useState } from 'react';
import JsonView, { CopyButton } from './JsonView';
import { VARIABLE_LABELS } from '../lib/flows';

const METHOD_STYLES = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-amber-50 text-amber-700 border-amber-200',
  PUT: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200'
};

const statusStyle = (status) => {
  if (!status) return 'bg-gray-100 text-gray-700';
  if (status >= 200 && status < 300) return 'bg-success-100 text-success-700';
  if (status >= 400 && status < 500) return 'bg-warning-100 text-warning-700';
  return 'bg-error-100 text-error-700';
};

const resultStyle = (result) => {
  if (result === 'SUCCESS') return 'bg-success-100 text-success-700';
  if (result === 'PENDING') return 'bg-warning-100 text-warning-700';
  return 'bg-error-100 text-error-700';
};

const buildCurl = ({ auth, method, url, bodyText, merchantId }) => {
  const lines = [
    `curl -X ${method} '${url}'`,
    auth === 'certificate'
      ? `  --cert client-cert.pem --key client-key.pem`
      : `  -u 'merchant.${merchantId || '{merchantId}'}:{API_PASSWORD}'`,
    `  -H 'Content-Type: application/json'`
  ];
  if (bodyText && method !== 'GET' && method !== 'DELETE') {
    lines.push(`  -d '${bodyText.replace(/'/g, "'\\''")}'`);
  }
  return lines.join(' \\\n');
};

const RequestStep = ({
  step, index, auth, method, url, bodyText, bodyError, edited, response, extracted,
  loading, missing, merchantId, onUrlChange, onBodyChange, onReset, onSend
}) => {
  const [tab, setTab] = useState(step.body === null ? 'headers' : 'body');
  const [respTab, setRespTab] = useState('body');
  const done = response && response.success;
  const failed = response && !response.success;

  return (
    <div className={`card ${done ? 'border-success-500/40' : failed ? 'border-error-500/40' : ''}`}>
      {/* Title */}
      <div className="flex items-start gap-3 mb-4">
        <span className={`step-indicator shrink-0 ${done ? 'completed' : missing.length ? 'pending' : 'active'}`}>
          {done ? '✓' : index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
            {auth === 'certificate' && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">🔏 Certificate auth</span>
            )}
            {step.optional && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Optional</span>
            )}
            <a
              href={step.docs}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary-600 hover:underline ml-auto"
            >
              📘 {step.operation}
            </a>
          </div>
          <p className="text-sm text-gray-600 mt-1">{step.subtitle}</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="mb-4 bg-warning-50 border border-warning-100 text-warning-700 text-sm px-3 py-2 rounded-lg">
          ⏳ Waiting for: {missing.map(m => VARIABLE_LABELS[m] || m).join(', ')}. Run the earlier steps first.
        </div>
      )}

      {/* Request line */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className={`method-badge ${METHOD_STYLES[method]}`}>{method}</div>
        <input
          type="text"
          className="input-field flex-1 font-mono text-sm"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          spellCheck={false}
        />
        <button
          onClick={onSend}
          disabled={loading || !!bodyError}
          className="btn-primary whitespace-nowrap"
        >
          {loading ? '⏳ Sending…' : 'Send ➤'}
        </button>
      </div>

      {/* Request tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-3">
        {step.body !== null && (
          <button className={`tab-btn ${tab === 'body' ? 'active' : ''}`} onClick={() => setTab('body')}>Body</button>
        )}
        <button className={`tab-btn ${tab === 'headers' ? 'active' : ''}`} onClick={() => setTab('headers')}>Headers</button>
        <button className={`tab-btn ${tab === 'curl' ? 'active' : ''}`} onClick={() => setTab('curl')}>cURL</button>
        {edited && (
          <button onClick={onReset} className="ml-auto text-xs text-gray-500 hover:text-gray-800">
            ↺ Reset to template
          </button>
        )}
      </div>

      {tab === 'body' && step.body !== null && (
        <div className="mb-4">
          <textarea
            className={`input-field font-mono text-xs h-56 resize-y ${bodyError ? 'border-error-500 ring-1 ring-error-500' : ''}`}
            value={bodyText}
            onChange={(e) => onBodyChange(e.target.value)}
            spellCheck={false}
          />
          {bodyError && <p className="text-xs text-error-600 mt-1">❌ Invalid JSON: {bodyError}</p>}
        </div>
      )}
      {tab === 'headers' && (
        <div className="mb-4 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-200">
          {auth === 'certificate' ? (
            <div className="flex gap-4 px-3 py-2"><span className="text-gray-500 w-40">TLS client cert</span><span>client certificate + private key (no Authorization header)</span></div>
          ) : (
            <div className="flex gap-4 px-3 py-2"><span className="text-gray-500 w-40">Authorization</span><span>Basic merchant.{merchantId || '{merchantId}'}:••••••••</span></div>
          )}
          <div className="flex gap-4 px-3 py-2"><span className="text-gray-500 w-40">Content-Type</span><span>application/json</span></div>
        </div>
      )}
      {tab === 'curl' && (
        <div className="mb-4">
          <JsonView value={buildCurl({ auth, method, url, bodyText, merchantId })} className="max-h-64" />
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-700">Response</span>
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${statusStyle(response.status)}`}>
              {response.status || 'ERR'} {response.statusText || ''}
            </span>
            {response.data?.result && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${resultStyle(response.data.result)}`}>
                result: {response.data.result}
              </span>
            )}
            {response.durationMs != null && (
              <span className="text-xs text-gray-500">{response.durationMs} ms</span>
            )}
            <div className="ml-auto flex gap-1">
              <button className={`tab-btn ${respTab === 'body' ? 'active' : ''}`} onClick={() => setRespTab('body')}>Body</button>
              <button className={`tab-btn ${respTab === 'extracted' ? 'active' : ''}`} onClick={() => setRespTab('extracted')}>Extracted</button>
            </div>
          </div>

          {response.data?.error?.explanation && (
            <p className="text-sm text-error-700 bg-error-50 border border-error-100 rounded-lg px-3 py-2 mb-2">
              ⚠️ {response.data.error.cause ? `${response.data.error.cause}: ` : ''}{response.data.error.explanation}
              {response.data.error.field ? ` (field: ${response.data.error.field})` : ''}
              {/SSL certificate/i.test(response.data.error.explanation) && (
                <span className="block mt-1 text-gray-700">
                  💡 This merchant profile only allows this call with certificate authentication. Ask your service provider to allow
                  API-password access, or add a client certificate in Settings → Certificate Authentication.
                </span>
              )}
            </p>
          )}

          {respTab === 'body' ? (
            <JsonView value={response.data ?? {}} />
          ) : (
            <ExtractedTable extracted={extracted} />
          )}
        </div>
      )}
    </div>
  );
};

const ExtractedTable = ({ extracted }) => {
  const entries = Object.entries(extracted || {}).filter(([, v]) => v != null && v !== '');
  if (!entries.length) {
    return <p className="text-sm text-gray-500 italic px-1 py-3">No values extracted from this response.</p>;
  }
  return (
    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 px-3 py-2">
          <span className="text-gray-500 w-48 shrink-0">{VARIABLE_LABELS[k] || k}</span>
          <span className="font-mono break-all flex-1">{String(v)}</span>
          <CopyButton text={String(v)} />
        </div>
      ))}
    </div>
  );
};

export default RequestStep;
