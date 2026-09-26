export const WEBHOOK_EVENTS = [
    'card_gate.order.updated',
    'card_gate.chargeback.received',
    'card_gate.fraud_alert.received',
    'card_gate.prevention_alert.received',
    'subscription.updated.v2',
    'alt_gate.order.updated',
    'alt_gate.paypal_dispute.received',
    'card.network_token.created',
    'card.network_token.updated',
    'taxer.tax.calculated'
    // 'alt_gate.recurring_token.cancelled',    // Not Supported Yet
];

export const STORAGE_KEYS = {
    SG_PUBLIC_KEY: 'sgPublicKey',
    SG_SECRET_KEY: 'sgSecretKey',
    SG_WEBHOOK_SUFFIX: 'sgWebhookSuffix',
    SG_EVENT_TYPES: 'sgEventTypes',
    SG_SELECTED_WEBHOOK_ID: 'sgSelectedWebhookId'
};

export const DEFAULT_SETTINGS = {
    SG_PUBLIC_KEY: '',
    SG_SECRET_KEY: '',
    SG_WEBHOOK_SUFFIX: '/webhook-solidgate',
    SG_EVENT_TYPES: WEBHOOK_EVENTS.join(', '),
    SG_SELECTED_WEBHOOK_ID: 'CREATE_NEW',
    DEFAULT_LOCAL_PORT: "8000",
}
