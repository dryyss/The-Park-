export interface CollectionItemPhotoView {
  id: string;
  url: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CommunityPhotoView extends CollectionItemPhotoView {
  collectorName: string;
  collectorSlug: string;
  variantLabel: string;
  condition: string;
}
