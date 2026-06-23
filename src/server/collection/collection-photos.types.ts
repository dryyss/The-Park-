export type CollectionPhotoKind = "CARD" | "CERTIFICATE";

export interface CollectionItemPhotoView {
  id: string;
  url: string;
  kind: CollectionPhotoKind;
  sortOrder: number;
  createdAt: Date;
}

export interface CommunityPhotoView extends CollectionItemPhotoView {
  collectorName: string;
  collectorSlug: string;
  variantLabel: string;
  condition: string;
}
