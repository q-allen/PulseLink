'use client';
import { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, Check, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';

const PSGC = 'https://psgc.gitlab.io/api';

interface PsgcItem { code: string; name: string; }
interface NominatimResult {
  place_id: number; display_name: string; lat: string; lon: string;
  address: { road?: string; suburb?: string; village?: string; neighbourhood?: string; postcode?: string; };
}

const emptyForm = {
  fullName: '', mobile: '', houseUnit: '', street: '',
  barangay: '', city: '', province: '', zipCode: '', notes: '',
};

export default function DeliveryAddressForm() {
  const { savedAddresses, selectedAddressId, setSelectedAddress, addAddress } = usePharmacyStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const hasAddresses = savedAddresses.length > 0;
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, fullName: user?.name ?? '', mobile: user?.phone ?? '' });
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({});

  const [provinces, setProvinces] = useState<PsgcItem[]>([]);
  const [cities, setCities] = useState<PsgcItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAddFormDerived = !hasAddresses || showAddForm;

  useEffect(() => {
    setLoadingProvinces(true);
    fetch(`${PSGC}/provinces/`)
      .then((r) => r.json())
      .then((data: PsgcItem[]) => setProvinces(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => toast({ title: 'Failed to load provinces', variant: 'destructive' }))
      .finally(() => setLoadingProvinces(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProvinceCode) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`${PSGC}/provinces/${selectedProvinceCode}/cities-municipalities/`)
      .then((r) => r.json())
      .then((data: PsgcItem[]) => setCities(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => toast({ title: 'Failed to load cities', variant: 'destructive' }))
      .finally(() => setLoadingCities(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvinceCode]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: val, format: 'json', addressdetails: '1', limit: '5', countrycodes: 'ph' });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'en' } });
        setSuggestions(await res.json());
      } finally { setSearching(false); }
    }, 400);
  };

  const handleSelectSuggestion = (r: NominatimResult) => {
    setSuggestions([]);
    setSearchQuery(r.display_name);
    const addr = r.address;
    setForm((f) => ({
      ...f,
      street: addr.road ?? f.street,
      barangay: addr.suburb ?? addr.village ?? addr.neighbourhood ?? f.barangay,
      zipCode: addr.postcode ?? f.zipCode,
    }));
  };

  const validate = () => {
    const e: Partial<typeof emptyForm> = {};
    if (!form.fullName.trim()) e.fullName = 'Required';
    if (!form.mobile.trim()) {
      e.mobile = 'Required';
    } else if (!/^(\+63|0)9\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) {
      e.mobile = 'Use PH format: 09XX-XXX-XXXX';
    }
    if (!form.houseUnit.trim()) e.houseUnit = 'Required';
    if (!form.street.trim()) e.street = 'Required';
    if (!form.barangay.trim()) e.barangay = 'Required';
    if (!form.city.trim()) e.city = 'Select city';
    if (!form.province.trim()) e.province = 'Select province';
    if (!form.zipCode.trim()) {
      e.zipCode = 'Required';
    } else if (!/^\d{4}$/.test(form.zipCode.trim())) {
      e.zipCode = 'Must be 4 digits';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    addAddress(form);
    setShowAddForm(false);
    setForm({ ...emptyForm, fullName: user?.name ?? '', mobile: user?.phone ?? '' });
    setSearchQuery('');
    toast({ title: 'Address saved', description: 'New delivery address has been added.' });
  };

  return (
    <div className="space-y-4">
      {savedAddresses.map((addr) => (
        <Card
          key={addr.id}
          className={cn('cursor-pointer transition-all border-2', selectedAddressId === addr.id ? 'border-primary' : 'border-border hover:border-primary/40')}
          onClick={() => setSelectedAddress(addr.id)}
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div className={cn('mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', selectedAddressId === addr.id ? 'bg-primary border-primary' : 'border-muted-foreground')}>
              {selectedAddressId === addr.id && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground text-sm">{addr.fullName}</p>
                {addr.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{addr.mobile}</p>
              <p className="text-sm text-foreground mt-1">
                {addr.houseUnit} {addr.street}, {addr.barangay}, {addr.city}, {addr.province} {addr.zipCode}
              </p>
              {addr.notes && <p className="text-xs text-muted-foreground mt-1 italic">{addr.notes}</p>}
            </div>
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}

      {!showAddFormDerived ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add New Address
        </Button>
      ) : (
        <Card className="border-primary/40">
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium text-foreground">
              {hasAddresses && showAddForm ? 'New Delivery Address' : 'Enter Your Delivery Address'}
            </h4>

            {/* Address search */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Search className="h-3 w-3" /> Search Address (auto-fill)
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search your address in the Philippines…"
                  className="pl-8 pr-8 h-9 text-sm"
                />
                {searching ? (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                ) : searchQuery ? (
                  <button type="button" onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                {suggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-background border border-border rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((r) => (
                      <li key={r.place_id}>
                        <button type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                          onClick={() => handleSelectSuggestion(r)}>
                          <MapPin className="inline h-3 w-3 mr-1.5 text-primary shrink-0" />
                          {r.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                <Input placeholder="Juan Dela Cruz" value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={cn('h-9 text-sm', errors.fullName && 'border-destructive')} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>

              {/* Mobile */}
              <div className="space-y-1">
                <Label className="text-xs">Mobile Number <span className="text-red-500">*</span></Label>
                <Input placeholder="09XX-XXX-XXXX" value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  className={cn('h-9 text-sm', errors.mobile && 'border-destructive')} />
                {errors.mobile && <p className="text-xs text-destructive">{errors.mobile}</p>}
              </div>

              {/* House/Unit */}
              <div className="space-y-1">
                <Label className="text-xs">House/Unit # <span className="text-red-500">*</span></Label>
                <Input placeholder="Unit 1A or 123" value={form.houseUnit}
                  onChange={(e) => setForm((f) => ({ ...f, houseUnit: e.target.value }))}
                  className={cn('h-9 text-sm', errors.houseUnit && 'border-destructive')} />
                {errors.houseUnit && <p className="text-xs text-destructive">{errors.houseUnit}</p>}
              </div>

              {/* Street */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Street <span className="text-red-500">*</span></Label>
                <Input placeholder="Rizal Street" value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  className={cn('h-9 text-sm', errors.street && 'border-destructive')} />
                {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
              </div>

              {/* Barangay */}
              <div className="space-y-1">
                <Label className="text-xs">Barangay <span className="text-red-500">*</span></Label>
                <Input placeholder="Brgy. San Antonio" value={form.barangay}
                  onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value }))}
                  className={cn('h-9 text-sm', errors.barangay && 'border-destructive')} />
                {errors.barangay && <p className="text-xs text-destructive">{errors.barangay}</p>}
              </div>

              {/* Province */}
              <div className="space-y-1">
                <Label className="text-xs">Province <span className="text-red-500">*</span></Label>
                <Select value={form.province}
                  onValueChange={(v) => {
                    const name = provinces.find((p) => p.code === v)?.name ?? '';
                    setSelectedProvinceCode(v);
                    setForm((f) => ({ ...f, province: name, city: '' }));
                  }}
                  disabled={loadingProvinces}>
                  <SelectTrigger className={cn('h-9 text-sm', errors.province && 'border-destructive')}>
                    {loadingProvinces
                      ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
                      : <SelectValue placeholder="Select province" />}
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
              </div>

              {/* City */}
              <div className="space-y-1">
                <Label className="text-xs">City/Municipality <span className="text-red-500">*</span></Label>
                <Select
                  value={cities.find((c) => c.name === form.city)?.code ?? ''}
                  key={selectedProvinceCode}
                  onValueChange={(v) => {
                    const name = cities.find((c) => c.code === v)?.name ?? '';
                    setForm((f) => ({ ...f, city: name }));
                  }}
                  disabled={!form.province || loadingCities}>
                  <SelectTrigger className={cn('h-9 text-sm', errors.city && 'border-destructive')}>
                    {loadingCities
                      ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
                      : <SelectValue placeholder={form.province ? 'Select city' : 'Select province first'} />}
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
              </div>

              {/* ZIP Code */}
              <div className="space-y-1">
                <Label className="text-xs">ZIP Code <span className="text-red-500">*</span></Label>
                <Input placeholder="1200" value={form.zipCode}
                  onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                  maxLength={4}
                  className={cn('h-9 text-sm', errors.zipCode && 'border-destructive')} />
                {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode}</p>}
              </div>

              {/* Notes */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Delivery Notes (Optional)</Label>
                <Textarea placeholder="Landmarks, gate color, etc." value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="h-20 text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save Address</Button>
              {hasAddresses && (
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
