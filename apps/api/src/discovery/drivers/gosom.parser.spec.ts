import { describe, it, expect } from "vitest";
import { parseGosomCsv } from "./gosom.parser";

const csv = `input_id,link,title,category,address,website,phone,review_count,review_rating,latitude,longitude,price_range,images,owner,emails
1,https://maps/x,Padaria Zé,Bakery,"Rua A, 1",,"(11) 99999-8888",42,4.6,-23.5,-46.6,$$,"[{""title"":""a""},{""title"":""b""}]","{""id"":""123"",""name"":""Zé""}",
2,https://maps/y,Loja Bela,Store,Rua B,https://instagram.com/lojabela,,3,5,,,,[],,a@b.com;c@d.com
3,https://maps/z,,Store,Rua C,,,,,,,,,,`;

describe("parseGosomCsv", () => {
  const places = parseGosomCsv(csv);
  it("skips rows without title", () => expect(places).toHaveLength(2));
  it("maps core fields", () => {
    expect(places[0]).toMatchObject({ name: "Padaria Zé", phone: "(11) 99999-8888", website: null, rating: 4.6, reviewCount: 42, source: "gosom" });
    expect(places[0].lat).toBeCloseTo(-23.5);
  });
  it("derives claimed and photoCount", () => {
    expect(places[0].claimed).toBe(true);
    expect(places[0].photoCount).toBe(2);
    expect(places[1].claimed).toBeNull();
  });
  it("splits emails", () => expect(places[1].emails).toEqual(["a@b.com", "c@d.com"]));
});
