// This free edition never loads compressed models or Cesium 3D-tile terrain.
// Cesium's optional meshoptimizer barrel eagerly compiles five WASM modules.
// Keep those capabilities unavailable without changing the document CSP.
const unavailable = () =>
  new Error(
    "Compressed models and 3D-tile terrain are not available in this edition",
  );
const reject = () => {
  throw unavailable();
};
export const MeshoptDecoder = Object.freeze({
  supported: false,
  get ready() {
    return Promise.reject(unavailable());
  },
  decodeGltfBuffer: reject,
  decodeVertexBuffer: reject,
  decodeIndexBuffer: reject,
  decodeIndexSequence: reject,
});
