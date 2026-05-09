"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LISTING_FLASH_CODE,
  LISTING_MY_LISTINGS_FLASH_STORAGE_KEY,
  type ListingFlashCode,
} from "@/lib/listings/listing-error-codes";

type Props = {
  flashCode?: ListingFlashCode;
};

export function MyListingsFlashRedirect({ flashCode = LISTING_FLASH_CODE.listingNotFound }: Props) {
  const router = useRouter();
  useEffect(() => {
    window.sessionStorage.setItem(LISTING_MY_LISTINGS_FLASH_STORAGE_KEY, flashCode);
    router.replace("/my-listings");
  }, [router, flashCode]);
  return null;
}
