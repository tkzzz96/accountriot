import { Module } from "@nestjs/common";
import { DiscoveryService } from "./discovery.service";
import { GosomDriver } from "./drivers/gosom.driver";
import { PlacesApiDriver } from "./drivers/places.driver";
import { MockDriver } from "./drivers/mock.driver";
import { PlaywrightDriver } from "./drivers/playwright.driver";
import { GoogleMapsScraperService } from "../scraper/google-maps.scraper";

@Module({
  providers: [DiscoveryService, GosomDriver, PlacesApiDriver, PlaywrightDriver, MockDriver, GoogleMapsScraperService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
