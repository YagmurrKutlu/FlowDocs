export type FavoritesSort = 'recent' | 'updated' | 'title';

export interface FavoritesSummaryResponse {
  favoriteCount: number;
  workspaceCount: number;
  latestFavoritedAt: string | null;
  recentlyUpdatedCount: number;
}

export interface FavoriteDocumentItem {
  id: string;
  favoriteId: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  previewContent: unknown;
  updatedAt: string;
  favoritedAt: string;
  memberCount: number;
  isFavorite: true;
}

export interface FavoritesListResponse {
  favorites: FavoriteDocumentItem[];
}

export interface FavoritesListParams {
  search?: string;
  workspaceId?: string;
  sort?: FavoritesSort;
}

export interface FavoriteActionResponse {
  message: string;
}
