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

declare module "leaflet.heat" {
  import * as L from "leaflet";

  interface HeatOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<string, string>;
  }

  interface HeatLayer extends L.Layer {
    setOptions(options: HeatOptions): void;
    addLatLng(latlng: L.LatLngExpression): void;
    setLatLngs(latlngs: L.LatLngExpression[]): void;
    redraw(): void;
  }

  interface HeatLayerFactory {
    (latlngs: Array<[number, number] | [number, number, number]>, options?: HeatOptions): HeatLayer;
  }

  namespace L {
    let heatLayer: HeatLayerFactory;
  }
}
