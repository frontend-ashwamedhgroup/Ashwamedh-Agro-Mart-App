const parsedBranchId = Number(process.env.EXPO_PUBLIC_BRANCH_ID);

/** The branch whose prices and stock the shop shows (catalog API `branch_id`). */
export const SHOP_BRANCH_ID: number =
  Number.isInteger(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : 1;
