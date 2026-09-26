'use client';

// ProductForm — create/edit with specifications repeater, image repeater (preview),
// variant/SKU repeater with attribute key-value pairs and stock editing (server diffs
// stock through the audited movement path on edit; seeds inventory on create).

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/components/admin/api';

export interface PickerOption {
  id: string;
  name: string;
}

export interface ProductFormInitial {
  id?: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  shortDesc: string;
  description: string;
  modelNumber: string;
  isActive: boolean;
  isFeatured: boolean;
  isCodAllowed: boolean;
  warrantyMonths: string;
  specifications: { key: string; value: string }[];
  images: { url: string; altText: string }[];
  variants: {
    id?: string;
    name: string;
    attributes: { key: string; value: string }[];
    skuCode: string;
    barcode: string;
    mrpRupees: string;
    sellingRupees: string;
    weightGrams: string;
    stock: string;
    lowStockThreshold: string;
  }[];
}

const EMPTY: ProductFormInitial = {
  name: '',
  slug: '',
  brandId: '',
  categoryId: '',
  shortDesc: '',
  description: '',
  modelNumber: '',
  isActive: true,
  isFeatured: false,
  isCodAllowed: true,
  warrantyMonths: '12',
  specifications: [],
  images: [],
  variants: [
    {
      name: '',
      attributes: [],
      skuCode: '',
      barcode: '',
      mrpRupees: '',
      sellingRupees: '',
      weightGrams: '500',
      stock: '0',
      lowStockThreshold: '5',
    },
  ],
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ProductForm({
  categories,
  brands,
  initial,
}: {
  categories: PickerOption[];
  brands: PickerOption[];
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [brandId, setBrandId] = useState(initial?.brandId ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [shortDesc, setShortDesc] = useState(initial?.shortDesc ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [modelNumber, setModelNumber] = useState(initial?.modelNumber ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [isCodAllowed, setIsCodAllowed] = useState(initial?.isCodAllowed ?? true);
  const [warrantyMonths, setWarrantyMonths] = useState(initial?.warrantyMonths ?? '12');
  const [specifications, setSpecifications] = useState(initial?.specifications ?? []);
  const [images, setImages] = useState(initial?.images ?? (initial ? [] : [{ url: '', altText: '' }]));
  const [variants, setVariants] = useState(initial?.variants ?? EMPTY.variants);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveSlug = useMemo(() => (slugTouched ? slug : slugify(name)), [slug, slugTouched, name]);

  function onNameChange(v: string) {
    setName(v);
  }

  function updateVariant(idx: number, patch: Partial<ProductFormInitial['variants'][number]>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function updateAttr(vIdx: number, aIdx: number, patch: Partial<{ key: string; value: string }>) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === vIdx ? { ...v, attributes: v.attributes.map((a, j) => (j === aIdx ? { ...a, ...patch } : a)) } : v
      )
    );
  }

  function validate(): string | null {
    if (name.trim().length < 3) return 'Product name must be at least 3 characters';
    if (!brandId) return 'Select a brand';
    if (!categoryId) return 'Select a category';
    if (description.trim().length < 10) return 'Description must be at least 10 characters';
    if (variants.length === 0) return 'At least one variant/SKU is required';
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.name.trim()) return `Variant ${i + 1}: name is required`;
      if (!/^[A-Za-z0-9_-]{2,40}$/.test(v.skuCode.trim())) return `Variant ${i + 1}: SKU code must be 2-40 chars (letters, digits, - _)`;
      const mrp = Number(v.mrpRupees);
      const sell = Number(v.sellingRupees);
      if (!Number.isFinite(mrp) || mrp <= 0) return `Variant ${i + 1}: MRP (₹) must be a positive number`;
      if (!Number.isFinite(sell) || sell <= 0) return `Variant ${i + 1}: Selling price (₹) must be a positive number`;
      if (sell > mrp) return `Variant ${i + 1}: selling price cannot exceed MRP`;
      if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) return `Variant ${i + 1}: stock must be a whole number ≥ 0`;
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const problem = validate();
    if (problem) {
      setFormError(problem);
      toast({ title: 'Check the form', description: problem, variant: 'destructive' });
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      slug: effectiveSlug || undefined,
      brandId,
      categoryId,
      shortDesc: shortDesc.trim(),
      description: description.trim(),
      modelNumber: modelNumber.trim(),
      isActive,
      isFeatured,
      isCodAllowed,
      warrantyMonths: Math.max(0, Math.round(Number(warrantyMonths) || 0)),
      specifications: specifications.filter((s) => s.key.trim() && s.value.trim()),
      images: images.filter((i) => i.url.trim()).map((i) => ({ url: i.url.trim(), altText: i.altText.trim() })),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        attributes: Object.fromEntries(v.attributes.filter((a) => a.key.trim()).map((a) => [a.key.trim(), a.value.trim()])),
        sku: {
          code: v.skuCode.trim().toUpperCase(),
          barcode: v.barcode.trim() || undefined,
          mrp: Math.round(Number(v.mrpRupees) * 100),
          sellingPrice: Math.round(Number(v.sellingRupees) * 100),
          weightGrams: Math.max(1, Math.round(Number(v.weightGrams) || 500)),
          stock: Math.max(0, Math.round(Number(v.stock) || 0)),
          lowStockThreshold: Math.max(0, Math.round(Number(v.lowStockThreshold) || 0)),
        },
      })),
    };

    try {
      if (isEdit && initial?.id) {
        await api(`/api/admin/products/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast({ title: 'Product updated', description: payload.name });
      } else {
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: 'Product created', description: payload.name });
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      const issues = err instanceof ApiError ? err.issues : undefined;
      const detail = issues?.map((i) => `${i.path}: ${i.message}`).join(' · ');
      setFormError(detail ? `${message} — ${detail}` : message);
      toast({ title: 'Save failed', description: detail || message, variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-md border border-border bg-card p-5 space-y-4">
            <h2 className="font-display text-lg">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-name">Product name *</Label>
                <Input id="pf-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. CP Plus 2MP IR Dome Camera" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-slug">Slug</Label>
                <Input id="pf-slug" value={effectiveSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} placeholder="auto-from-name" />
                <p className="text-[11px] text-muted-foreground">Auto-generated from the name — edit to override.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-model">Model number</Label>
                <Input id="pf-model" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} placeholder="CP-USC-DA24L2" />
              </div>
              <div className="space-y-1.5">
                <Label>Brand *</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger aria-label="Brand">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger aria-label="Category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-short">Short description</Label>
                <Input id="pf-short" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} maxLength={220} placeholder="One-liner for cards & search results" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-desc">Description *</Label>
                <Textarea id="pf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Full product description (min 10 characters)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-warranty">Warranty (months)</Label>
                <Input id="pf-warranty" type="number" min={0} max={120} value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Specifications */}
          <section className="rounded-md border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Specifications</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setSpecifications((p) => [...p, { key: '', value: '' }])}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add spec
              </Button>
            </div>
            {specifications.length === 0 && <p className="text-xs text-muted-foreground">No specifications yet — e.g. Resolution / 2MP, Lens / 3.6mm.</p>}
            <div className="space-y-2">
              {specifications.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s.key} onChange={(e) => setSpecifications((p) => p.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} placeholder="Key (e.g. Resolution)" className="h-9" aria-label={`Specification ${i + 1} key`} />
                  <Input value={s.value} onChange={(e) => setSpecifications((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Value (e.g. 2MP)" className="h-9" aria-label={`Specification ${i + 1} value`} />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setSpecifications((p) => p.filter((_, j) => j !== i))} aria-label={`Remove specification ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Images */}
          <section className="rounded-md border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Images</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setImages((p) => [...p, { url: '', altText: '' }])}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add image
              </Button>
            </div>
            {images.length === 0 && <p className="text-xs text-muted-foreground">No images — cards and the PDP degrade gracefully.</p>}
            <div className="space-y-2">
              {images.map((img, i) => (
                <div key={i} className="flex items-center gap-2">
                  {img.url ? (
                    <img src={img.url} alt={img.altText || 'preview'} className="h-11 w-11 shrink-0 rounded-md object-cover border border-border" />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-md bg-muted border border-border" aria-hidden />
                  )}
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Input value={img.url} onChange={(e) => setImages((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://… image URL" className="h-9" aria-label={`Image ${i + 1} URL`} />
                    <Input value={img.altText} onChange={(e) => setImages((p) => p.map((x, j) => (j === i ? { ...x, altText: e.target.value } : x)))} placeholder="Alt text" className="h-9" aria-label={`Image ${i + 1} alt text`} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setImages((p) => p.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Variants */}
          <section className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg">Variants &amp; SKUs</h2>
                <p className="text-xs text-muted-foreground">Each variant resolves to one SKU with its own stock ledger.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setVariants((p) => [...p, { name: '', attributes: [], skuCode: '', barcode: '', mrpRupees: '', sellingRupees: '', weightGrams: '500', stock: '0', lowStockThreshold: '5' }])}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add variant
              </Button>
            </div>
            <div className="space-y-4">
              {variants.map((v, vi) => (
                <div key={vi} className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variant {vi + 1}{v.id ? ' · existing' : ''}</p>
                    {!v.id && variants.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setVariants((p) => p.filter((_, j) => j !== vi))} aria-label={`Remove variant ${vi + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {v.id && <span className="text-[10px] text-muted-foreground">Existing variants cannot be removed (order integrity)</span>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-name-${vi}`}>Variant name *</Label>
                      <Input id={`v-name-${vi}`} value={v.name} onChange={(e) => updateVariant(vi, { name: e.target.value })} placeholder="2MP · 3.6mm · Dome" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-sku-${vi}`}>SKU code *</Label>
                      <Input id={`v-sku-${vi}`} value={v.skuCode} onChange={(e) => updateVariant(vi, { skuCode: e.target.value })} placeholder="CPP-B01-2MP-36" className="h-9 font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-mrp-${vi}`}>MRP (₹) *</Label>
                      <Input id={`v-mrp-${vi}`} type="number" min={0} step="0.01" value={v.mrpRupees} onChange={(e) => updateVariant(vi, { mrpRupees: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-sell-${vi}`}>Selling price (₹, GST incl.) *</Label>
                      <Input id={`v-sell-${vi}`} type="number" min={0} step="0.01" value={v.sellingRupees} onChange={(e) => updateVariant(vi, { sellingRupees: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-stock-${vi}`}>Stock {isEdit ? '(edits are audited)' : ''}</Label>
                      <Input id={`v-stock-${vi}`} type="number" min={0} value={v.stock} onChange={(e) => updateVariant(vi, { stock: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-thr-${vi}`}>Low-stock threshold</Label>
                      <Input id={`v-thr-${vi}`} type="number" min={0} value={v.lowStockThreshold} onChange={(e) => updateVariant(vi, { lowStockThreshold: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-wt-${vi}`}>Weight (grams)</Label>
                      <Input id={`v-wt-${vi}`} type="number" min={1} value={v.weightGrams} onChange={(e) => updateVariant(vi, { weightGrams: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`v-bc-${vi}`}>Barcode</Label>
                      <Input id={`v-bc-${vi}`} value={v.barcode} onChange={(e) => updateVariant(vi, { barcode: e.target.value })} className="h-9" />
                    </div>
                  </div>
                  {/* attribute pairs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Attributes (e.g. Resolution → 2MP)</p>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateVariant(vi, { attributes: [...v.attributes, { key: '', value: '' }] })}>
                        <Plus className="h-3 w-3" aria-hidden /> Attribute
                      </Button>
                    </div>
                    {v.attributes.map((a, ai) => (
                      <div key={ai} className="flex gap-2">
                        <Input value={a.key} onChange={(e) => updateAttr(vi, ai, { key: e.target.value })} placeholder="Attribute" className="h-8 text-xs" aria-label={`Variant ${vi + 1} attribute ${ai + 1} key`} />
                        <Input value={a.value} onChange={(e) => updateAttr(vi, ai, { value: e.target.value })} placeholder="Value" className="h-8 text-xs" aria-label={`Variant ${vi + 1} attribute ${ai + 1} value`} />
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateVariant(vi, { attributes: v.attributes.filter((_, j) => j !== ai) })} aria-label={`Remove attribute ${ai + 1}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <section className="rounded-md border border-border bg-card p-5 space-y-4">
            <h2 className="font-display text-lg">Publishing</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pf-active">Active (live on storefront)</Label>
                <p className="text-[11px] text-muted-foreground">Hidden products disappear from listings.</p>
              </div>
              <Switch id="pf-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pf-featured">Featured</Label>
                <p className="text-[11px] text-muted-foreground">Highlighted on the home page.</p>
              </div>
              <Switch id="pf-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pf-cod">COD allowed</Label>
                <p className="text-[11px] text-muted-foreground">ADR-004 selective COD flag.</p>
              </div>
              <Switch id="pf-cod" checked={isCodAllowed} onCheckedChange={setIsCodAllowed} />
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-5 space-y-3 sticky top-20">
            <h2 className="font-display text-lg">Save</h2>
            {formError && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => router.push('/admin/products')} disabled={busy}>
              Cancel
            </Button>
          </section>
        </div>
      </div>
    </form>
  );
}
