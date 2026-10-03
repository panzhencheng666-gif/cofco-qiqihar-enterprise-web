// The free edition exposes no Ion providers, servers, or credential settings.
// Undefined defaults make installed SDK providers fail before implicit requests.
// Keep only the compatibility method used by IonResource and IonGeocoderService;
// actual asset/provider attribution remains the responsibility of those modules.
const disabledIon = Object.freeze({
  defaultAccessToken: undefined,
  defaultServer: undefined,
  getDefaultTokenCredit() {
    return undefined;
  },
});
export default disabledIon;
