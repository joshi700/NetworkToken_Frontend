import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { getFlow, generateId, merchantBase, authForStep, VARIABLE_LABELS } from '../lib/flows';
import RequestStep from '../components/RequestStep';
import PaymentDataOutput from '../components/PaymentDataOutput';
import { CopyButton } from '../components/JsonView';

const newIds = () => ({ orderId: generateId('ORD'), transactionId: generateId('TXN') });

const parseJson = (text) => {
  if (!text.trim()) return { value: {}, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

const FlowRunner = ({ flow }) => {
  const navigate = useNavigate();
  const { config, testCard, tokenOptions, isConfigured, backendUrl } = useConfig();

  const [vars, setVars] = useState(() => ({ ...newIds(), amount: config.amount }));
  const [overrides, setOverrides] = useState({}); // stepId -> { url?, bodyText? }
  const [responses, setResponses] = useState({}); // stepId -> response
  const [extracted, setExtracted] = useState({}); // stepId -> extracted vars
  const [loadingStep, setLoadingStep] = useState(null);
  const [history, setHistory] = useState([]);

  const env = useMemo(
    () => ({ base: merchantBase(config), config, testCard, tokenOptions, vars }),
    [config, testCard, tokenOptions, vars]
  );

  // Templates are re-derived from the latest variables unless the user edited them
  const stepView = (step) => {
    const o = overrides[step.id] || {};
    const auth = authForStep(step, config);
    const stepEnv = { ...env, base: merchantBase(config, auth) };
    const defaultBody = step.body ? JSON.stringify(step.body(stepEnv), null, 2) : '';
    const bodyText = o.bodyText ?? defaultBody;
    return {
      auth,
      method: step.method,
      url: o.url ?? step.url(stepEnv),
      bodyText,
      bodyError: step.body ? parseJson(bodyText).error : null,
      edited: o.url != null || o.bodyText != null,
      missing: (step.requires || []).filter(k => !vars[k])
    };
  };

  const setOverride = (stepId, patch) =>
    setOverrides(prev => ({ ...prev, [stepId]: { ...prev[stepId], ...patch } }));

  const resetOverride = (stepId) =>
    setOverrides(prev => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });

  const send = async (step) => {
    const view = stepView(step);
    const body = step.body ? parseJson(view.bodyText).value : undefined;
    setLoadingStep(step.id);
    let result;
    try {
      const res = await fetch(`${backendUrl}/api/gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            merchantId: config.merchantId,
            password: config.password,
            clientCert: config.clientCert || undefined,
            clientKey: config.clientKey || undefined,
            clientKeyPassphrase: config.clientKeyPassphrase || undefined
          },
          auth: view.auth,
          method: view.method,
          url: view.url,
          body
        })
      });
      result = await res.json();
      if (result.status == null) {
        // Proxy-level validation error
        result = { success: false, status: res.status, statusText: 'Proxy Error', data: { error: { explanation: result.error } } };
      }
    } catch (err) {
      result = {
        success: false, status: 0, statusText: 'Network Error',
        data: { error: { explanation: `Cannot reach backend at ${backendUrl}: ${err.message}` } }
      };
    }

    setResponses(prev => ({ ...prev, [step.id]: result }));
    setHistory(prev => [{
      time: new Date().toLocaleTimeString(),
      title: step.title,
      method: view.method,
      status: result.status,
      result: result.data?.result
    }, ...prev]);

    if (result.success && step.extract) {
      const found = Object.fromEntries(
        Object.entries(step.extract(result.data) || {}).filter(([, v]) => v != null && v !== '')
      );
      setExtracted(prev => ({ ...prev, [step.id]: found }));
      setVars(prev => ({ ...prev, ...found }));
    } else {
      setExtracted(prev => ({ ...prev, [step.id]: {} }));
    }
    setLoadingStep(null);
  };

  // Demo aid: show an illustrative response when the live call can't be made
  const loadSample = (step) => {
    const data = step.sample({ vars, config });
    setResponses(prev => ({
      ...prev,
      [step.id]: { success: true, sample: true, status: 200, statusText: 'SAMPLE', durationMs: null, data }
    }));
    setHistory(prev => [{ time: new Date().toLocaleTimeString(), title: `${step.title} (sample)`, method: step.method, status: 'SAMPLE' }, ...prev]);
    const found = Object.fromEntries(
      Object.entries(step.extract(data) || {}).filter(([, v]) => v != null && v !== '')
    );
    setExtracted(prev => ({ ...prev, [step.id]: found }));
    setVars(prev => ({ ...prev, ...found }));
  };

  const resetFlow = () => {
    setVars({ ...newIds(), amount: config.amount });
    setOverrides({});
    setResponses({});
    setExtracted({});
    setHistory([]);
  };

  const editableVars = ['orderId', 'transactionId', 'amount'];
  const derivedVars = Object.entries(vars).filter(([k, v]) => !editableVars.includes(k) && v != null && v !== '');
  const showOrderFields = flow.steps.some(s => ['pay', 'outside', 'payPassThrough'].includes(s.id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button onClick={() => navigate('/home')} className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-2">
            ← All flows
          </button>
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
            Flow {flow.number} · {flow.model}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">{flow.name}</h1>
          <p className="text-gray-600 mt-1">{flow.description}</p>
        </div>
        <button onClick={resetFlow} className="btn-secondary">↺ Reset flow</button>
      </div>

      {!isConfigured && (
        <div className="mb-6 bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="font-medium">⚠️ Configure your merchant credentials before sending requests.</span>
          <button onClick={() => navigate('/settings')} className="btn-primary !py-1.5">Settings</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Steps */}
        <div className="lg:col-span-8 space-y-6">
          {flow.steps.map((step, i) => {
            if (step.type === 'output') {
              const missing = (step.requires || []).filter(k => !vars[k]);
              return <PaymentDataOutput key={step.id} step={step} index={i} vars={vars} missing={missing} config={config} />;
            }
            const view = stepView(step);
            return (
              <RequestStep
                key={step.id}
                step={step}
                index={i}
                {...view}
                response={responses[step.id]}
                extracted={extracted[step.id]}
                loading={loadingStep === step.id}
                merchantId={config.merchantId}
                onUrlChange={(url) => setOverride(step.id, { url })}
                onBodyChange={(bodyText) => setOverride(step.id, { bodyText })}
                onReset={() => resetOverride(step.id)}
                onSend={() => send(step)}
                onLoadSample={step.sample ? () => loadSample(step) : null}
              />
            );
          })}
        </div>

        {/* Variables + history */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Flow Variables</h3>
                {showOrderFields && (
                  <button
                    onClick={() => setVars(prev => ({ ...prev, ...newIds() }))}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    🔄 New IDs
                  </button>
                )}
              </div>
              {showOrderFields && (
                <div className="space-y-2 mb-4">
                  {editableVars.map(k => (
                    <div key={k}>
                      <label className="block text-xs text-gray-500 mb-0.5">{VARIABLE_LABELS[k]}{k === 'amount' ? ` (${config.currency})` : ''}</label>
                      <input
                        className="input-field !py-1.5 font-mono text-xs"
                        value={vars[k] || ''}
                        onChange={(e) => setVars(prev => ({ ...prev, [k]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {derivedVars.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Values from responses (token, DPAN, cryptogram and so on) will show up here.</p>
              ) : (
                <div className="divide-y divide-gray-100 text-xs">
                  {derivedVars.map(([k, v]) => (
                    <div key={k} className="py-1.5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-500">{VARIABLE_LABELS[k] || k}</div>
                        <div className="font-mono break-all text-gray-900">{String(v)}</div>
                      </div>
                      <CopyButton text={String(v)} label="⧉" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-bold text-gray-900 mb-3">History</h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No requests sent yet.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-gray-400 w-16 shrink-0">{h.time}</span>
                      <span className="font-mono font-bold w-10">{h.method}</span>
                      <span className="flex-1 truncate">{h.title}</span>
                      <span className={`font-mono ${h.status === 'SAMPLE' ? 'text-purple-600' : h.status >= 200 && h.status < 300 ? 'text-success-600' : 'text-error-600'}`}>
                        {h.status || 'ERR'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const FlowPage = () => {
  const { flowId } = useParams();
  const flow = getFlow(flowId);
  if (!flow) return <Navigate to="/home" replace />;
  return <FlowRunner key={flow.id} flow={flow} />;
};

export default FlowPage;
