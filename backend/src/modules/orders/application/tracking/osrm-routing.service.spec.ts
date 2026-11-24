import { OsrmRoutingService } from './osrm-routing.service';

describe('OsrmRoutingService', () => {
  const originalUrl = process.env.OSRM_URL;
  const originalFetch = global.fetch;
  const origin = { latitude: 21.02, longitude: 105.85 };
  const destination = { latitude: 21.03, longitude: 105.86 };
  const service = new OsrmRoutingService();

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.OSRM_URL;
    else process.env.OSRM_URL = originalUrl;
    global.fetch = originalFetch;
  });

  it('does not call a public routing service when OSRM is not configured', async () => {
    delete process.env.OSRM_URL;
    global.fetch = jest.fn();
    expect(await service.getRoute(origin, destination)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a real street route using OSRM GeoJSON geometry', async () => {
    process.env.OSRM_URL = 'http://osrm:5000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [
            {
              distance: 1700,
              duration: 360,
              geometry: {
                coordinates: [
                  [105.85, 21.02],
                  [105.855, 21.025],
                  [105.86, 21.03],
                ],
              },
            },
          ],
        }),
    });

    const route = await service.getRoute(origin, destination);
    expect(route).toMatchObject({ distanceMeters: 1700, durationSeconds: 360 });
    expect(route?.coordinates).toHaveLength(3);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain(
      '/route/v1/driving/105.85,21.02;105.86,21.03?overview=full&geometries=geojson',
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails closed on a malformed route response', async () => {
    process.env.OSRM_URL = 'http://osrm:5000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [{ distance: 100, geometry: { coordinates: [] } }],
        }),
    });
    expect(await service.getRoute(origin, destination)).toBeNull();
  });
});
