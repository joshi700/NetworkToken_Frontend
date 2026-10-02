import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const SectionTitle = ({ n, children }) => (
  <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
    <span className="bg-primary-100 text-primary-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
      {n}
    </span>
    {children}
  </h2>
);

const SettingsPage = () => {
  const navigate = useNavigate();
  const {
    config, updateConfig, testCard, updateTestCard,
    tokenOptions, updateTokenOptions, clearSession, backendUrl
  } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleConfigChange = (field, value) => {
    if (field === 'merchantId') {
      updateConfig({ merchantId: value, username: value ? `merchant.${value}` : '' });
    } else {
      updateConfig({ [field]: value });
    }
  };

  const validateConfig = () => {
    if (!config.merchantId) return 'Merchant ID is required';
    if (!config.password) return 'API Password is required';
    if (!config.apiBaseUrl?.startsWith('https://')) return 'Gateway URL must start with https://';
    if (!config.currency || config.currency.length !== 3) return 'Currency must be a 3-letter ISO code';
    if (!(parseFloat(config.amount) > 0)) return 'Default amount must be greater than 0';
    return null;
  };

  const validateTestCard = () => {
    const n = testCard.cardNumber;
    if (!n || n.length < 13 || n.length > 19 || !/^\d+$/.test(n)) return 'Card number must be 13-19 digits';
    const m = parseInt(testCard.expiryMonth, 10);
    if (!(m >= 1 && m <= 12)) return 'Invalid expiry month';
    if (!/^\d{2}$/.test(testCard.expiryYear)) return 'Expiry year must be 2 digits';
    return null;
  };

  const handleTestConfiguration = async () => {
    const configError = validateConfig();
    if (configError) { setError(configError); setSuccess(null); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${backendUrl}/api/test-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: config.merchantId,
          password: config.password,
          apiBaseUrl: config.apiBaseUrl,
          apiVersion: config.apiVersion
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Credentials verified against the gateway. You can start testing.');
      } else {
        setError(data.error || data.data?.error?.explanation || `Gateway returned HTTP ${data.status}`);
      }
    } catch (err) {
      setError(`Cannot connect to backend at ${backendUrl}. Is it running?`);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    const err = validateConfig() || validateTestCard();
    if (err) { setError(err); setSuccess(null); return; }
    navigate('/home');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Network Tokenisation Testing Tool</h1>
        <p className="text-gray-600">
          Configure your Mastercard Gateway credentials, then run network token flows request by request
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-error-50 border border-error-100 text-error-700 px-4 py-3 rounded-lg">
          <p className="font-medium">⚠️ {error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-success-50 border border-success-100 text-success-700 px-4 py-3 rounded-lg">
          <p className="font-medium">✅ {success}</p>
        </div>
      )}

      {/* 1. Merchant */}
      <div className="card mb-6">
        <SectionTitle n={1}>Merchant Configuration</SectionTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Merchant ID *">
              <input
                type="text" className="input-field" placeholder="e.g., TESTMERCHANT01"
                value={config.merchantId} maxLength={40}
                onChange={(e) => handleConfigChange('merchantId', e.target.value.trim())}
              />
            </Field>
            <Field label="API Username (auto-generated)" hint={`Format: merchant.${config.merchantId || 'MERCHANTID'}`}>
              <input type="text" className="input-field bg-gray-50 cursor-not-allowed" value={config.username} readOnly />
            </Field>
          </div>

          <Field label="API Password *" hint="⚠️ Kept in sessionStorage only, and cleared when you close the tab">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} className="input-field pr-12"
                placeholder="Enter API password" value={config.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Gateway URL *">
              <input
                type="url" className="input-field" list="gateway-urls"
                value={config.apiBaseUrl}
                onChange={(e) => handleConfigChange('apiBaseUrl', e.target.value.trim())}
              />
              <datalist id="gateway-urls">
                <option value="https://mtf.gateway.mastercard.com" />
                <option value="https://na-gateway.mastercard.com" />
                <option value="https://eu-gateway.mastercard.com" />
                <option value="https://ap-gateway.mastercard.com" />
              </datalist>
            </Field>
            <Field label="API Version" hint="Default: 100">
              <input
                type="text" className="input-field" value={config.apiVersion}
                onChange={(e) => handleConfigChange('apiVersion', e.target.value.trim())}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Currency *">
              <input
                type="text" className="input-field" maxLength={3} value={config.currency}
                onChange={(e) => handleConfigChange('currency', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Default Amount *">
              <input
                type="text" className="input-field" value={config.amount}
                onChange={(e) => handleConfigChange('amount', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Certificate auth */}
      <div className="card mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center">
          <span className="bg-purple-100 text-purple-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">🔏</span>
          Certificate Authentication
        </h2>
        <p className="text-sm text-gray-600 mb-4 ml-11">
          Optional. All requests use the API password by default. Some merchant profiles only allow Generate Payment Data with
          SSL client-certificate authentication. If yours does, paste the PEM certificate and private key registered in Merchant Administration.
          If you leave these blank, the backend uses
          <code className="font-mono"> GATEWAY_CLIENT_CERT</code> / <code className="font-mono">GATEWAY_CLIENT_KEY</code> when they are set.
        </p>
        <div className="space-y-4">
          <Field label="Use certificate for">
            <select className="input-field" value={config.certScope} onChange={(e) => handleConfigChange('certScope', e.target.value)}>
              <option value="none">Never (API password for all requests)</option>
              <option value="paymentData">Generate Payment Data only (other requests use the API password)</option>
              <option value="all">All requests</option>
            </select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Client Certificate (PEM)">
              <textarea
                className="input-field font-mono text-xs h-32" spellCheck={false}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={config.clientCert} onChange={(e) => handleConfigChange('clientCert', e.target.value)}
              />
            </Field>
            <Field label="Private Key (PEM)">
              <textarea
                className="input-field font-mono text-xs h-32" spellCheck={false}
                placeholder="-----BEGIN PRIVATE KEY-----"
                value={config.clientKey} onChange={(e) => handleConfigChange('clientKey', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Key Passphrase (if encrypted)">
            <input
              type="password" className="input-field"
              value={config.clientKeyPassphrase} onChange={(e) => handleConfigChange('clientKeyPassphrase', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* 2. Card */}
      <div className="card mb-6">
        <SectionTitle n={2}>Test Card (FPAN)</SectionTitle>
        <div className="space-y-4">
          <Field label="Card Number *" hint="Use a card from your acquirer's network token test range">
            <input
              type="text" className="input-field font-mono" maxLength={19}
              value={testCard.cardNumber}
              onChange={(e) => updateTestCard({ cardNumber: e.target.value.replace(/\s/g, '') })}
            />
          </Field>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Expiry Month *">
              <input type="text" className="input-field font-mono" maxLength={2} value={testCard.expiryMonth}
                onChange={(e) => updateTestCard({ expiryMonth: e.target.value })} />
            </Field>
            <Field label="Expiry Year *">
              <input type="text" className="input-field font-mono" maxLength={2} value={testCard.expiryYear}
                onChange={(e) => updateTestCard({ expiryYear: e.target.value })} />
            </Field>
            <Field label="CVV">
              <input type="text" className="input-field font-mono" maxLength={4} value={testCard.cvv}
                onChange={(e) => updateTestCard({ cvv: e.target.value })} />
            </Field>
            <Field label="Name on Card">
              <input type="text" className="input-field" value={testCard.nameOnCard}
                onChange={(e) => updateTestCard({ nameOnCard: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      {/* 3. Token options */}
      <div className="card mb-6">
        <SectionTitle n={3}>Network Token Options</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Preferred Cryptogram Type" hint="schemeToken.preferredCryptogramType">
            <select
              className="input-field" value={tokenOptions.preferredCryptogramType}
              onChange={(e) => updateTokenOptions({ preferredCryptogramType: e.target.value })}
            >
              <option value="CRYPTOGRAM">CRYPTOGRAM</option>
              <option value="VERIFICATION_CODE">VERIFICATION_CODE</option>
              <option value="">(not sent)</option>
            </select>
          </Field>
          <Field label="Sensitive Data Control" hint="responseControls.sensitiveData. Use UNMASK to get the full DPAN.">
            <select
              className="input-field" value={tokenOptions.sensitiveData}
              onChange={(e) => updateTokenOptions({ sensitiveData: e.target.value })}
            >
              <option value="">(not sent)</option>
              <option value="UNMASK">UNMASK</option>
              <option value="MASK">MASK</option>
            </select>
          </Field>
          <Field label="Transaction Source (Pay)" hint="transaction.source">
            <select
              className="input-field" value={tokenOptions.transactionSource}
              onChange={(e) => updateTokenOptions({ transactionSource: e.target.value })}
            >
              <option value="INTERNET">INTERNET</option>
              <option value="MERCHANT">MERCHANT</option>
              <option value="MOTO">MOTO</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button onClick={handleTestConfiguration} disabled={loading} className="btn-secondary min-w-[200px]">
          {loading ? '⏳ Testing…' : '🧪 Test Configuration'}
        </button>
        <button onClick={handleProceed} className="btn-primary min-w-[200px]">
          Continue to Flows →
        </button>
      </div>
      <div className="text-center mt-4">
        <button onClick={() => { clearSession(); setSuccess(null); setError(null); }} className="text-sm text-gray-500 hover:text-error-600">
          Clear saved settings
        </button>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Important Notes</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Your merchant's token repository must be enabled for scheme (network) tokenization</li>
          <li>The repository must use a system-generated token strategy (Random or Preserve 6.4) for POST /token</li>
          <li>All credentials are kept in sessionStorage. Requests go through the backend proxy at <code className="font-mono">{backendUrl}</code></li>
          <li>Every request URL and body can be edited on the flow page before you send it</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;
