export const LISTING_DETAILS_SELECT = `
  id,
  title,
  type,
  description,
  price,
  address,
  available_from,
  available_until,
  creator_id,
  is_active,
  listing_images(image_path, order_index),
  cities(name, regions(name)),
  listing_required_tags(tags(id, slug, label_uk, category_id, tag_categories(name))),
  profiles!listings_creator_id_fkey(
    first_name,
    last_name,
    profile_tags(tags(id, slug, label_uk, category_id, tag_categories(name)))
  )
`;
