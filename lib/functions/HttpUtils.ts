import { fetch } from 'cross-fetch';

export async function post(url: string, body: unknown, bearerToken?: string): Promise<Response> {
  let message = '';
  try {
    const payload: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body),
    };

    if (bearerToken) {
      payload.headers = {
        Authorization: `Bearer ${bearerToken}`,
      };
    }
    const response = await fetch(url, payload);
    if (response && response.status && response.status < 400) {
      return response;
    } else {
      if (response) {
        message = `${response.status}:${response.statusText}, ${await response.text()}`;
      }
    }
  } catch (error) {
    throw new Error(`${(error as Error).message}`);
  }

  throw new Error('unexpected error: ' + message);
}

export function isValidURL(url: string): boolean {
  const urlPattern = new RegExp(
    '^(https:\\/\\/)?' + // validate protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ); // validate fragment locator
  return !!urlPattern.test(url);
}