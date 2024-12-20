import { Feature, FeatureCollection, Polygon } from 'geojson';

export interface CountryFeature extends Feature<Polygon> {
  properties: {
    name: string;
  };
}

export interface CountryData extends FeatureCollection<Polygon> {
  features: CountryFeature[];
}

// We'll fetch this from a CDN or include it in the project
export const COUNTRIES_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'; 