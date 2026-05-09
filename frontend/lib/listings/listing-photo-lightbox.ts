export const LISTING_PHOTO_LIGHTBOX_ROOT_SELECTOR = "[data-listing-photo-lightbox-root]";

let photoLightboxLayerOpenCount = 0;

export function registerListingPhotoLightboxLayerMounted(): () => void {
  photoLightboxLayerOpenCount += 1;
  return () => {
    photoLightboxLayerOpenCount = Math.max(0, photoLightboxLayerOpenCount - 1);
  };
}

export function isListingPhotoLightboxLayerOpen(): boolean {
  return photoLightboxLayerOpenCount > 0;
}

export function isListingPhotoLightboxTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    Boolean(target.closest(LISTING_PHOTO_LIGHTBOX_ROOT_SELECTOR))
  );
}
