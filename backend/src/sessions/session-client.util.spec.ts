import { maskIpAddress, parseUserAgent } from './session-client.util';

describe('session-client.util', () => {
  it('parses chrome on windows', () => {
    const parsed = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    );
    expect(parsed.os).toBe('Windows');
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.deviceLabel).toBe('Windows · Chrome');
  });

  it('masks ipv4 addresses', () => {
    expect(maskIpAddress('192.168.1.35')).toBe('192.168.x.x');
  });

  it('maps localhost', () => {
    expect(maskIpAddress('127.0.0.1')).toBe('Localhost');
  });
});
