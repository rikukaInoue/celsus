import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface LibrarianStats {
  totalViews: number;
  uniqueEntities: number;
  uniqueUsers: number;
  todayViews: number;
}

export interface PopularEntity {
  entityRef: string;
  viewCount: number;
}

export interface SearchResult {
  entityRef: string;
  kind: string;
  name: string;
  description: string;
  tags: string;
  score: number;
}

export interface EntityRelations {
  entityRef: string;
  relations: { type: string; targetRef: string }[];
  dependedOnBy: string[];
  impactScore: number;
}

export interface SimilarEntity {
  entityRef: string;
  kind: string;
  name: string;
  description: string;
  similarity: number;
}

export interface LibrarianApi {
  getStats(): Promise<LibrarianStats>;
  getPopular(): Promise<PopularEntity[]>;
  search(query: string): Promise<SearchResult[]>;
  getRelations(entityRef: string): Promise<EntityRelations>;
  getSimilar(entityRef: string): Promise<SimilarEntity[]>;
  recordView(entityRef: string): Promise<void>;
}

export const librarianApiRef = createApiRef<LibrarianApi>({
  id: 'plugin.librarian',
});

export class LibrarianClient implements LibrarianApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async baseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('librarian');
  }

  async getStats(): Promise<LibrarianStats> {
    const url = `${await this.baseUrl()}/stats`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getPopular(): Promise<PopularEntity[]> {
    const url = `${await this.baseUrl()}/popular`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async search(query: string): Promise<SearchResult[]> {
    const url = `${await this.baseUrl()}/search?q=${encodeURIComponent(query)}`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getRelations(entityRef: string): Promise<EntityRelations> {
    const url = `${await this.baseUrl()}/relations/${encodeURIComponent(entityRef)}`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getSimilar(entityRef: string): Promise<SimilarEntity[]> {
    const url = `${await this.baseUrl()}/similar/${encodeURIComponent(entityRef)}`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async recordView(entityRef: string): Promise<void> {
    const url = `${await this.baseUrl()}/views`;
    await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityRef }),
    });
  }
}
