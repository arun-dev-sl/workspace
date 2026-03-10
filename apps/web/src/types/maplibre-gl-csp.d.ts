declare module "maplibre-gl/dist/maplibre-gl-csp" {
  import type maplibregl from "maplibre-gl";

  const maplibreCsp: typeof maplibregl;

  export default maplibreCsp;
}

declare module "maplibre-gl/dist/maplibre-gl-csp-worker.js?url" {
  const workerUrl: string;

  export default workerUrl;
}
