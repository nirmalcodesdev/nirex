declare module 'geoip-lite' {
  interface LookupResult {
    range: [number, number];
    country: string;
    region: string;
    eu: '0' | '1';
    timezone: string;
    city: string;
    ll: [number, number];
    metro: number;
    area: number;
  }

  function lookup(ip: string): LookupResult | null;

  export default { lookup };
}
