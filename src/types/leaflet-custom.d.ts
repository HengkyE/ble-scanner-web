import L from "leaflet";

declare module "leaflet" {
  namespace HeatLayer {
    interface Options {
      minOpacity?: number;
      maxZoom?: number;
      radius?: number;
      blur?: number;
      max?: number;
      gradient?: Record<string, string>;
    }
  }

  function heatLayer(
    latlngs: Array<[number, number, number]> | Array<L.LatLng>,
    options?: HeatLayer.Options
  ): L.Layer;
}

declare module "leaflet.heat";
