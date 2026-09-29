import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GosomDriver } from "./drivers/gosom.driver";
import { PlacesApiDriver } from "./drivers/places.driver";
import { MockDriver } from "./drivers/mock.driver";
import { PlaywrightDriver } from "./drivers/playwright.driver";
import { DiscoveredPlace, DiscoveryDriver, DiscoveryQuery } from "./discovery.types";

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private config: ConfigService,
    private gosom: GosomDriver,
    private places: PlacesApiDriver,
    private playwright: PlaywrightDriver,
    private mock: MockDriver,
  ) {}

  /** Driver chosen by DISCOVERY_DRIVER (gosom | places | playwright | mock); default gosom. */
  pickDriver(): DiscoveryDriver {
    const wanted = this.config.get<string>("DISCOVERY_DRIVER", "gosom");
    if (wanted === "places") {
      if (!this.places.enabled) throw new Error("DISCOVERY_DRIVER=places but PLACES_API_KEY is not set");
      return this.places;
    }
    if (wanted === "playwright") return this.playwright;
    if (wanted === "mock") return this.mock;
    return this.gosom;
  }

  async discover(query: DiscoveryQuery): Promise<DiscoveredPlace[]> {
    const driver = this.pickDriver();
    this.logger.log(`Discovering with driver=${driver.name}: ${query.niche} @ ${query.city}, ${query.country}`);
    return driver.discover(query);
  }
}
