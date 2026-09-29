// Starter seed of well-known, real websites used as *design references* (link + thumbnail by URL only).
// This is a STARTING POINT: replace/extend with your own taste via POST /references or by editing this file.
export interface SeedRef {
  niche: string;
  url: string;
  title: string;
}

export const CURATED_SEED: SeedRef[] = [
  // barbershop
  { niche: "barbershop", url: "https://www.murdocklondon.com", title: "Murdock London" },
  { niche: "barbershop", url: "https://www.rudysbarbershop.com", title: "Rudy's Barbershop" },
  { niche: "barbershop", url: "https://www.blindbarber.com", title: "The Blind Barber" },
  { niche: "barbershop", url: "https://www.schorem.com", title: "Schorem Barbers" },
  // restaurant
  { niche: "restaurant", url: "https://www.elevenmadisonpark.com", title: "Eleven Madison Park" },
  { niche: "restaurant", url: "https://www.gramercytavern.com", title: "Gramercy Tavern" },
  { niche: "restaurant", url: "https://noma.dk", title: "Noma" },
  { niche: "restaurant", url: "https://www.osteriafrancescana.it", title: "Osteria Francescana" },
  { niche: "restaurant", url: "https://www.nobu.com", title: "Nobu" },
  // cafe / bakery
  { niche: "cafe", url: "https://bluebottlecoffee.com", title: "Blue Bottle Coffee" },
  { niche: "cafe", url: "https://www.stumptowncoffee.com", title: "Stumptown Coffee" },
  { niche: "cafe", url: "https://www.intelligentsia.com", title: "Intelligentsia" },
  { niche: "cafe", url: "https://www.tartinebakery.com", title: "Tartine Bakery" },
  // dentist
  { niche: "dentist", url: "https://www.aspendental.com", title: "Aspen Dental" },
  { niche: "dentist", url: "https://www.smiledirectclub.com", title: "SmileDirectClub" },
  { niche: "dentist", url: "https://www.invisalign.com", title: "Invisalign" },
  // clinic
  { niche: "clinic", url: "https://www.mayoclinic.org", title: "Mayo Clinic" },
  { niche: "clinic", url: "https://www.clevelandclinic.org", title: "Cleveland Clinic" },
  { niche: "clinic", url: "https://www.onemedical.com", title: "One Medical" },
  // gym
  { niche: "gym", url: "https://www.equinox.com", title: "Equinox" },
  { niche: "gym", url: "https://www.crossfit.com", title: "CrossFit" },
  { niche: "gym", url: "https://www.orangetheory.com", title: "Orangetheory" },
  { niche: "gym", url: "https://www.planetfitness.com", title: "Planet Fitness" },
  // salon / beauty
  { niche: "salon", url: "https://www.drybarshops.com", title: "Drybar" },
  { niche: "salon", url: "https://www.toniandguy.com", title: "Toni&Guy" },
  { niche: "salon", url: "https://www.aveda.com", title: "Aveda" },
  // lawyer
  { niche: "lawyer", url: "https://www.sullcrom.com", title: "Sullivan & Cromwell" },
  { niche: "lawyer", url: "https://www.cravath.com", title: "Cravath" },
  { niche: "lawyer", url: "https://www.legalzoom.com", title: "LegalZoom" },
  // pet shop / vet
  { niche: "petshop", url: "https://www.banfield.com", title: "Banfield Pet Hospital" },
  { niche: "petshop", url: "https://www.petco.com", title: "Petco" },
  { niche: "petshop", url: "https://www.chewy.com", title: "Chewy" },
  // automotive
  { niche: "automotive", url: "https://www.jiffylube.com", title: "Jiffy Lube" },
  { niche: "automotive", url: "https://www.firestonecompleteautocare.com", title: "Firestone Complete Auto Care" },
  { niche: "automotive", url: "https://www.carmax.com", title: "CarMax" },
  // real estate
  { niche: "realestate", url: "https://www.compass.com", title: "Compass" },
  { niche: "realestate", url: "https://www.sothebysrealty.com", title: "Sotheby's Realty" },
  { niche: "realestate", url: "https://www.zillow.com", title: "Zillow" },
  // store / boutique
  { niche: "store", url: "https://www.everlane.com", title: "Everlane" },
  { niche: "store", url: "https://www.allbirds.com", title: "Allbirds" },
  { niche: "store", url: "https://www.glossier.com", title: "Glossier" },
  // generic small-business fallback (clean, conversion-oriented sites)
  { niche: "generic", url: "https://www.squarespace.com", title: "Squarespace" },
  { niche: "generic", url: "https://www.mailchimp.com", title: "Mailchimp" },
  { niche: "generic", url: "https://www.stripe.com", title: "Stripe" },
  { niche: "generic", url: "https://www.airbnb.com", title: "Airbnb" },
  { niche: "generic", url: "https://www.notion.so", title: "Notion" },
];
