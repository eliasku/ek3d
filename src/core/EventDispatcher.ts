/**
 * This modules allows to dispatch event objects on custom JavaScript objects.
 *
 * Main repository: [eventdispatcher.js](https://github.com/mrdoob/eventdispatcher.js/)
 *
 * Code Example:
 * ```typescript
 * import { EventDispatcher } from 'ek3d/core/EventDispatcher';
 *
 * class Car extends EventDispatcher {
 * 	start() {
 * 	this.dispatchEvent( { type: 'start', message: 'vroom vroom!' } );
 * }
 * };
 *
 * // Using events with the custom object
 * const car = new Car();
 * car.addEventListener( 'start', function ( event ) {
 * 	alert( event.message );
 * } );
 *
 * car.start();
 * ```
 */
export class EventDispatcher {
  _listeners: any;

  /**
   * Adds the given event listener to the given event type.
   *
   * @param type - The type of event to listen to.
   * @param listener - The function that gets called when the event is fired.
   */
  addEventListener(type: string, listener: (...args: any[]) => any) {
    if (this._listeners === undefined) this._listeners = {};
    const listeners = this._listeners;
    if ((listeners as any)[type] === undefined) {
      (listeners as any)[type] = [];
    }
    if ((listeners as any)[type].indexOf(listener) === -1) {
      (listeners as any)[type].push(listener);
    }
  }
  /**
   * Returns `true` if the given event listener has been added to the given event type.
   *
   * @param type - The type of event.
   * @param listener - The listener to check.
   * @return Whether the given event listener has been added to the given event type.
   */
  hasEventListener(type: string, listener: (...args: any[]) => any): boolean {
    const listeners = this._listeners;
    if (listeners === undefined) return false;
    return (listeners as any)[type] !== undefined && (listeners as any)[type].indexOf(listener) !== -1;
  }
  /**
   * Removes the given event listener from the given event type.
   *
   * @param type - The type of event.
   * @param listener - The listener to remove.
   */
  removeEventListener(type: string, listener: (...args: any[]) => any) {
    const listeners = this._listeners;
    if (listeners === undefined) return;
    const listenerArray = (listeners as any)[type];
    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }
  /**
   * Dispatches an event object.
   *
   * @param event - The event that gets fired.
   */
  dispatchEvent(event?: any) {
    const listeners = this._listeners;
    if (listeners === undefined) return;
    const listenerArray = (listeners as any)[event.type];
    if (listenerArray !== undefined) {
      event.target = this;
      // Make a copy, in case listeners are removed while iterating.
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event);
      }
      event.target = null;
    }
  }
}
