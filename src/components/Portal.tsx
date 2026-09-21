"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Nothing to subscribe to: this only ever answers "are we on the client yet". */
const noop = () => () => {};

/**
 * Put a full-screen overlay at the top of the document, whatever opened it.
 *
 * `position: fixed` means "relative to the viewport" only while no ancestor
 * has a transform, a filter or a backdrop-filter. Any of those makes that
 * element the containing block instead, and a `fixed inset-0` overlay then
 * sizes itself to *it* — which is how the settings panel, opened from a
 * translucent app bar 64px tall, ended up pinned to the top of the screen with
 * most of itself scrolled out of reach and no way to get at it.
 *
 * Rendering into `document.body` puts the overlay beyond the reach of whatever
 * chrome it was opened from. It mounts on the client only, because there is no
 * body to portal into while the page is being rendered on the server.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  // False while rendering on the server, true once hydrated — without a state
  // update in an effect, which would cost a second render of the whole overlay.
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  return onClient ? createPortal(children, document.body) : null;
}
