"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function CreateCampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    niche: "",
    country: "Brasil",
    city: "",
    radiusKm: "10",
    sizeHint: "micro",
    budgetUsd: "500",
    language: "pt-BR",
    channel: "whatsapp",
    requireNoSite: true,
    maxResults: "50",
    service: "Criação de site profissional",
    priceAnchor: "",
    deadline: "",
    sellerName: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const select = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const campaign = await api.post<{ id: string }>("/campaigns", {
        name: form.name,
        filter: {
          niche: form.niche,
          country: form.country,
          city: form.city,
          radiusKm: Number(form.radiusKm),
          sizeHint: form.sizeHint,
          budgetUsd: Number(form.budgetUsd),
          language: form.language,
          channel: form.channel,
          requireNoSite: form.requireNoSite,
          maxResults: Number(form.maxResults),
          service: form.service || undefined,
          priceAnchor: form.priceAnchor || undefined,
          deadline: form.deadline || undefined,
          sellerName: form.sellerName || undefined,
        },
      });
      await api.post(`/scraper/campaigns/${campaign.id}/start`, {});
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error("Failed to create campaign:", err);
      setError(String(err));
      setLoading(false);
    }
  };

  return (
    <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtro da campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da campanha</Label>
            <Input id="name" placeholder="ex.: Barbearias Curitiba" value={form.name} onChange={set("name")} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input id="niche" data-testid="niche-input" placeholder="ex.: barbearia" value={form.niche} onChange={set("niche")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" data-testid="city-input" placeholder="ex.: Curitiba" value={form.city} onChange={set("city")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" placeholder="ex.: Brasil" value={form.country} onChange={set("country")} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="radius">Raio (km)</Label>
              <Input id="radius" type="number" min={1} max={100} value={form.radiusKm} onChange={set("radiusKm")} />
            </div>
            <div className="space-y-2">
              <Label>Porte</Label>
              <Select value={form.sizeHint} onValueChange={select("sizeHint")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro</SelectItem>
                  <SelectItem value="small">Pequeno</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Orçamento alvo (US$)</Label>
              <Input id="budget" type="number" min={0} value={form.budgetUsd} onChange={set("budgetUsd")} />
            </div>
            <div className="space-y-2">
              <Label>Máx. de leads</Label>
              <Select value={form.maxResults} onValueChange={select("maxResults")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["20", "50", "100", "200"].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Idioma das mensagens</Label>
              <Select value={form.language} onValueChange={select("language")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Canal principal</Label>
              <Select value={form.channel} onValueChange={select("channel")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="require-no-site"
                  checked={form.requireNoSite}
                  onChange={(e) => setForm((p) => ({ ...p, requireNoSite: e.target.checked }))}
                />
                Somente empresas sem site
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Seu serviço (usado nos rascunhos)</Label>
            <Textarea id="service" rows={2} className="resize-none" value={form.service} onChange={set("service")} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço-âncora</Label>
              <Input id="price" placeholder="ex.: a partir de R$ 1.500" value={form.priceAnchor} onChange={set("priceAnchor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo</Label>
              <Input id="deadline" placeholder="ex.: 7 dias" value={form.deadline} onChange={set("deadline")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller">Seu nome</Label>
              <Input id="seller" placeholder="ex.: Ryan" value={form.sellerName} onChange={set("sellerName")} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando...</> : "Iniciar campanha"}
          </Button>
        </CardFooter>
      </Card>
    </motion.form>
  );
}
