import React, { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext();

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
};

export const DEFAULT_CONFIG = {
  merchantId: '',
  username: '',
  password: '',
  apiBaseUrl: 'https://mtf.gateway.mastercard.com',
  apiVersion: '100',
  currency: 'USD',
  amount: '10.00',
  // API password is used by default; certificate auth is optional
  certScope: 'none', // none | paymentData | all
  clientCert: '',
  clientKey: '',
  clientKeyPassphrase: ''
};

export const DEFAULT_TEST_CARD = {
  cardNumber: '5123450000000008',
  expiryMonth: '12',
  expiryYear: '39',
  cvv: '100',
  nameOnCard: 'Test Cardholder'
};

export const DEFAULT_TOKEN_OPTIONS = {
  preferredCryptogramType: 'CRYPTOGRAM', // CRYPTOGRAM | VERIFICATION_CODE | '' (omit)
  sensitiveData: '',                      // responseControls.sensitiveData — blank to omit
  transactionSource: 'INTERNET'
};

const load = (key, fallback) => {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(() => load('ntMerchantConfig', DEFAULT_CONFIG));
  const [testCard, setTestCard] = useState(() => load('ntTestCard', DEFAULT_TEST_CARD));
  const [tokenOptions, setTokenOptions] = useState(() => load('ntTokenOptions', DEFAULT_TOKEN_OPTIONS));

  const [backendUrl] = useState(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3006');

  useEffect(() => { sessionStorage.setItem('ntMerchantConfig', JSON.stringify(config)); }, [config]);
  useEffect(() => { sessionStorage.setItem('ntTestCard', JSON.stringify(testCard)); }, [testCard]);
  useEffect(() => { sessionStorage.setItem('ntTokenOptions', JSON.stringify(tokenOptions)); }, [tokenOptions]);

  const updateConfig = (c) => setConfig(prev => ({ ...prev, ...c }));
  const updateTestCard = (c) => setTestCard(prev => ({ ...prev, ...c }));
  const updateTokenOptions = (c) => setTokenOptions(prev => ({ ...prev, ...c }));

  const clearSession = () => {
    ['ntMerchantConfig', 'ntTestCard', 'ntTokenOptions'].forEach(k => sessionStorage.removeItem(k));
    setConfig(DEFAULT_CONFIG);
    setTestCard(DEFAULT_TEST_CARD);
    setTokenOptions(DEFAULT_TOKEN_OPTIONS);
  };

  const isConfigured = Boolean(config.merchantId && config.password && config.apiBaseUrl);

  return (
    <ConfigContext.Provider value={{
      config, updateConfig,
      testCard, updateTestCard,
      tokenOptions, updateTokenOptions,
      clearSession, isConfigured, backendUrl
    }}>
      {children}
    </ConfigContext.Provider>
  );
};
