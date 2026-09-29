// Maps free-text niches (pt/en) to canonical keys used by the curated reference table.
const ALIASES: Record<string, string[]> = {
  barbershop: ["barbearia", "barbershop", "barber", "barbeiro"],
  restaurant: ["restaurante", "restaurant", "lanchonete", "pizzaria", "hamburgueria", "bar", "bistro", "churrascaria", "comida"],
  cafe: ["cafe", "cafeteria", "coffee", "padaria", "bakery", "confeitaria"],
  dentist: ["dentista", "dentist", "odontologia", "dental", "ortodontia"],
  clinic: ["clinica", "clinic", "medico", "saude", "fisioterapia", "psicologo", "nutricionista", "estetica"],
  gym: ["academia", "gym", "fitness", "crossfit", "pilates", "personal", "musculacao"],
  salon: ["salao", "salon", "cabeleireiro", "beleza", "beauty", "manicure", "spa", "estudio"],
  lawyer: ["advogado", "advocacia", "lawyer", "law", "juridico", "escritorio"],
  petshop: ["pet", "petshop", "veterinario", "veterinaria", "vet", "banho e tosa"],
  automotive: ["oficina", "mecanica", "automotive", "auto", "car", "lava jato", "funilaria"],
  realestate: ["imobiliaria", "imovel", "real estate", "corretor"],
  store: ["loja", "store", "boutique", "varejo", "shop", "moda"],
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function canonicalNiche(niche: string): string {
  const n = strip(niche);
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((a) => n === a || n.includes(a))) return key;
  }
  return "generic";
}
