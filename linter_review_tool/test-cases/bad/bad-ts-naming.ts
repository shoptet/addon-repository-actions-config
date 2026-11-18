// An author-chosen name is still subject to camelCase; an ambient one is not.
declare const shop_runtime_config: { currency_code: string };

export const my_currency = shop_runtime_config.currency_code;
