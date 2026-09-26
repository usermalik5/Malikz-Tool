export type Session = { email: string; isAdmin: boolean };
export type Feature = { key: string; label: string; description: string; enabled: boolean };
export type RepairRecord = {
  id: string; device: string; issue: string; work: string; outcome: 'open' | 'in_progress' | 'completed'; createdAt: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (response.status === 401) throw new Error('Sign-in is required. Refresh the page after signing in.');
  if (response.status === 403) throw new Error('Your account does not have access to this area.');
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || 'The request could not be completed. Try again.');
  return body as T;
}

export const api = {
  authStatus: () => request<{ initialized: boolean }>('/api/auth/status'),
  session: () => request<{ session: Session; features: Feature[] }>('/api/session'),
  login: (email: string, password: string) => request<{ session: Session; features: Feature[] }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  bootstrap: (email: string, password: string, bootstrapSecret: string) => request<{ session: Session; features: Feature[] }>('/api/auth/bootstrap', { method: 'POST', body: JSON.stringify({ email, password, bootstrapSecret }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  records: () => request<{ records: RepairRecord[] }>('/api/records'),
  createRecord: (record: Pick<RepairRecord, 'device' | 'issue' | 'work' | 'outcome'>) => request<{ record: RepairRecord }>('/api/records', { method: 'POST', body: JSON.stringify(record) }),
  setFeature: (key: string, enabled: boolean) => request<{ feature: Feature }>('/api/admin/features', { method: 'PUT', body: JSON.stringify({ key, enabled }) }),
};

export function readUsbDevices(): Promise<Array<{ name: string; vendorId: number; productId: number }>> {
  type UsbDevice = { productName?: string; manufacturerName?: string; vendorId: number; productId: number };
  type UsbApi = { getDevices(): Promise<UsbDevice[]>; requestDevice(options: { filters: Array<Record<string, number>> }): Promise<UsbDevice> };
  const usb = (navigator as Navigator & { usb?: UsbApi }).usb;
  if (!usb) throw new Error('USB device details are not supported in this browser. Try Chrome or Edge on a computer.');
  return usb.getDevices().then(async (existing) => {
    if (existing.length) return existing.map(device => ({ name: device.productName || device.manufacturerName || 'USB device', vendorId: device.vendorId, productId: device.productId }));
    try {
      const device = await usb.requestDevice({ filters: [] });
      return [{ name: device.productName || device.manufacturerName || 'USB device', vendorId: device.vendorId, productId: device.productId }];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return [];
      throw error;
    }
  });
}

export async function hashFile(file: File, onProgress: (value: number) => void): Promise<string> {
  const { sha256 } = await import('@noble/hashes/sha256');
  const hasher = sha256.create();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
    hasher.update(new Uint8Array(chunk));
    onProgress(Math.min(100, Math.round(((offset + chunk.byteLength) / file.size) * 100)));
  }
  return Array.from(hasher.digest(), byte => byte.toString(16).padStart(2, '0')).join('');
}
