export const getParamString = (param: unknown): string => {
  if (typeof param === 'string') return param;
  if (Array.isArray(param)) return String(param[0] || '');
  return '';
};
