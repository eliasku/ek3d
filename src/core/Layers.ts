/**
 * A layers object assigns an 3D object to 1 or more of 32
 * layers numbered `0` to `31` - internally the layers are stored as a
 * bit mask], and by default all 3D objects are a member of layer `0`.
 *
 * This can be used to control visibility - an object must share a layer with
 * a camera to be visible when that camera's view is
 * rendered.
 *
 * All classes that inherit from {@link Object3D} have an `layers` property which
 * is an instance of this class.
 */
export class Layers {
  mask: number;

  /**
   * Constructs a new layers instance, with membership
   * initially set to layer `0`.
   */
  constructor() {
    /**
     * A bit mask storing which of the 32 layers this layers object is currently
     * a member of.
     *
     */
    this.mask = 1 | 0;
  }
  /**
   * Sets membership to the given layer, and remove membership all other layers.
   *
   * @param layer - The layer to set.
   */
  set(layer: number) {
    this.mask = ((1 << layer) | 0) >>> 0;
  }
  /**
   * Adds membership of the given layer.
   *
   * @param layer - The layer to enable.
   */
  enable(layer: number) {
    this.mask |= (1 << layer) | 0;
  }
  /**
   * Adds membership to all layers.
   */
  enableAll() {
    this.mask = 0xffffffff | 0;
  }
  /**
   * Toggles the membership of the given layer.
   *
   * @param layer - The layer to toggle.
   */
  toggle(layer: number) {
    this.mask ^= (1 << layer) | 0;
  }
  /**
   * Removes membership of the given layer.
   *
   * @param layer - The layer to enable.
   */
  disable(layer: number) {
    this.mask &= ~((1 << layer) | 0);
  }
  /**
   * Removes the membership from all layers.
   */
  disableAll() {
    this.mask = 0;
  }
  /**
   * Returns `true` if this and the given layers object have at least one
   * layer in common.
   *
   * @param layers - The layers to test.
   * @return Whether this and the given layers object have at least one layer in common or not.
   */
  test(layers: Layers): boolean {
    return (this.mask & layers.mask) !== 0;
  }
  /**
   * Returns `true` if the given layer is enabled.
   *
   * @param layer - The layer to test.
   * @return Whether the given layer is enabled or not.
   */
  isEnabled(layer: number): boolean {
    return (this.mask & ((1 << layer) | 0)) !== 0;
  }
}
