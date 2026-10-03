// This edition exposes no ArcGIS providers or credential/server settings.
// Undefined servers stop every installed SDK basemap variant before a request.
const disabledArcGis = Object.freeze({
  defaultAccessToken: undefined,
  defaultWorldImageryServer: undefined,
  defaultWorldHillshadeServer: undefined,
  defaultWorldOceanServer: undefined,
  getDefaultTokenCredit() {
    return undefined;
  },
});
export default disabledArcGis;
