import { WEBVIEW_PARAMS_QUERY_KEY } from '../constant.js';

export const attachWebviewParamsOnUrl = (
  url: string,
  params: Record<string, unknown>,
) => {
  const urlObj = new URL(url);
  urlObj.searchParams.set(WEBVIEW_PARAMS_QUERY_KEY, JSON.stringify(params));
  return urlObj.toString();
};

export const getWebviewParamsFromUrl = <T>(url: string) => {
  const urlObj = new URL(url);
  const params = urlObj.searchParams.get(WEBVIEW_PARAMS_QUERY_KEY);
  try {
    return params ? (JSON.parse(params) as T) : null;
  } catch (err) {
    console.warn('Failed to parse webview params:', err);
    return null;
  }
};
