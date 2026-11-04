// Only the fields we use. Spotify removed several fields (popularity,
// followers, ...) for Development Mode apps in February 2026.

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifySimpleArtist {
  id: string;
  name: string;
}

// `genres` is still documented but comes back empty, see src/lib/lastfm.ts
export interface SpotifyArtist extends SpotifySimpleArtist {
  images: SpotifyImage[];
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  images: SpotifyImage[];
  artists: SpotifySimpleArtist[];
}

export interface SpotifyTrack {
  // Null for local files
  id: string | null;
  name: string;
  duration_ms: number;
  explicit: boolean;
  is_local: boolean;
  album: SpotifyAlbum;
  artists: SpotifySimpleArtist[];
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  images: SpotifyImage[];
}

export interface RecentlyPlayed {
  items: { track: SpotifyTrack; played_at: string }[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}
