/**
 * R1d diagnostic is intentionally disabled for the R1f test.
 *
 * R1d proved that the app can still reload during a mobile drag even when
 * _renderViewport2D() is suppressed. R1f restores normal rendering so the
 * next test isolates only the second Scene store write / deep clone.
 */
