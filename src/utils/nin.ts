/** Keeps digits only, at most 11. The NIN is never saved on the phone. */
export const formatNin = (v: string) => v.replace(/\D/g, '').slice(0, 11);
export const isNin = (v: string) => /^\d{11}$/.test(v);
