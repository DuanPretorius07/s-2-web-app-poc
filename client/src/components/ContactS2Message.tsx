import React from 'react';

interface ContactS2MessageProps {
  reason: 'rate_limit' | 'hazmat' | 'error' | 'no_rates';
  customMessage?: string;
}

const MESSAGES: Record<ContactS2MessageProps['reason'], { title: string; message: string }> = {
  rate_limit: {
    title: 'Quote Limit Reached',
    message:
      'You have used all 3 of your complimentary quote requests. To get additional quotes or book your shipment, please contact S2 International directly.',
  },
  hazmat: {
    title: 'Hazardous Materials',
    message:
      'Hazardous materials require specialized handling and custom quotes. Please contact S2 International for assistance with your hazmat shipment.',
  },
  error: {
    title: 'Unable to Retrieve Rates',
    message:
      'We encountered an issue retrieving rates for your shipment. Please contact S2 International and our team will provide you with a quote.',
  },
  no_rates: {
    title: 'No Rates Available',
    message:
      'No rates are currently available for this shipping lane. Please contact S2 International for a custom quote.',
  },
};

export default function ContactS2Message({ reason, customMessage }: ContactS2MessageProps) {
  const config = MESSAGES[reason];

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 my-6">
      <h3 className="text-xl font-bold text-blue-900 mb-3">{config.title}</h3>
      <p className="text-blue-800 mb-4">{customMessage || config.message}</p>
      <a
        href="https://www.s-2international.com/contact"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-s2-red text-white px-6 py-3 rounded-lg font-semibold hover:bg-s2-red-dark transition-colors"
      >
        Contact S2 International →
      </a>
    </div>
  );
}

