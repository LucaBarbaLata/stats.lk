import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

// Who can see a user's profile, stats, recent plays and leaderboard spots
// "everyone" means everyone logged in to stats.lk; "public" adds visitors without an account
export const profileVisibility = pgEnum("profile_visibility", ["private", "friends", "everyone", "public"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  spotifyId: text("spotify_id").notNull().unique(),
  // Public handle for profile links (/u/<username>); lowercase, see src/lib/usernames.ts
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Set once the user picks a display name here; logins then stop copying Spotify's
  customDisplayName: boolean("custom_display_name").notNull().default(false),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  visibility: profileVisibility("visibility").notNull().default("private"),
  // Whether people who can see the profile also see what's playing right now
  showNowPlaying: boolean("show_now_playing").notNull().default(true),
  // Preferences. A null timezone means the app default (APP_TIMEZONE).
  timezone: text("timezone"),
  // 1 = Monday, 7 = Sunday
  weekStart: integer("week_start").notNull().default(1),
  defaultRange: text("default_range").notNull().default("4w"),
  defaultSort: text("default_sort").notNull().default("plays"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  // Sync state for the recently-played poller
  lastSyncedAt: timestamptz("last_synced_at"),
  lastPlayedAt: timestamptz("last_played_at"),
  syncError: text("sync_error"),
  // When the worker last stored the user's Spotify top lists
  topListsFetchedAt: timestamptz("top_lists_fetched_at"),
});

// Kept apart from `users` so that selecting a user never pulls tokens along.
// Both tokens are encrypted at rest, see src/lib/crypto.ts.
export const spotifyTokens = pgTable("spotify_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
  scope: text("scope").notNull(),
  // Set when Spotify rejects the refresh token (user revoked access)
  revokedAt: timestamptz("revoked_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie value, so a database leak doesn't leak sessions
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
    // Shown in settings so people can tell their devices apart
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_id").on(t.userId)],
);

export const artists = pgTable(
  "artists",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    // From Last.fm tags (Spotify returns no genres anymore), see src/lib/lastfm.ts
    genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
    genresFetchedAt: timestamptz("genres_fetched_at"),
    // Null until the full artist object (image) has been fetched from Spotify
    detailsFetchedAt: timestamptz("details_fetched_at"),
    // Made from a name in a streaming history export, so the id isn't Spotify's;
    // replaced by the real artist once Spotify returns one (src/lib/import/link.ts)
    imported: boolean("imported").notNull().default(false),
    // When a picture was looked up outside Spotify, see src/lib/pictures.ts
    pictureLookedUpAt: timestamptz("picture_looked_up_at"),
  },
  (t) => [index("artists_lower_name").on(sql`lower(${t.name})`)],
);

export const albums = pgTable(
  "albums",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    albumType: text("album_type"),
    releaseDate: text("release_date"),
    // Same as on artists
    imported: boolean("imported").notNull().default(false),
    pictureLookedUpAt: timestamptz("picture_looked_up_at"),
  },
  (t) => [index("albums_lower_name").on(sql`lower(${t.name})`)],
);

export const albumArtists = pgTable(
  "album_artists",
  {
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.albumId, t.artistId] }),
    index("album_artists_artist_id").on(t.artistId),
  ],
);

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  albumId: text("album_id").references(() => albums.id),
  durationMs: integer("duration_ms"),
  explicit: boolean("explicit"),
  // Streaming history imports only carry names; these hold them until the
  // track has been looked up on Spotify
  importedArtistName: text("imported_artist_name"),
  importedAlbumName: text("imported_album_name"),
  detailsFetchedAt: timestamptz("details_fetched_at"),
});

export const trackArtists = pgTable(
  "track_artists",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.trackId, t.artistId] }),
    index("track_artists_artist_id").on(t.artistId),
  ],
);

export const streamSource = pgEnum("stream_source", ["api", "import"]);

export const streams = pgTable(
  "streams",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id),
    // When playback ended, which is what both the API and the export report
    playedAt: timestamptz("played_at").notNull(),
    // Exact for imports; for API streams the track duration is the best estimate
    msPlayed: integer("ms_played").notNull(),
    source: streamSource("source").notNull(),
  },
  (t) => [
    uniqueIndex("streams_user_played_at_track").on(t.userId, t.playedAt, t.trackId),
    index("streams_user_track").on(t.userId, t.trackId),
    index("streams_track_id").on(t.trackId),
  ],
);

export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted"]);

// One row per pair: the requester asked, the addressee accepts.
export const friendships = pgTable(
  "friendships",
  {
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    index("friendships_addressee_id").on(t.addresseeId),
  ],
);

// What each user is playing, refreshed by the worker. No row (or a null
// track) means nothing is playing.
export const nowPlaying = pgTable("now_playing", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  trackId: text("track_id").references(() => tracks.id),
  isPlaying: boolean("is_playing").notNull().default(false),
  progressMs: integer("progress_ms"),
  fetchedAt: timestamptz("fetched_at").notNull(),
});

export const hiddenItemType = pgEnum("hidden_item_type", ["artist", "track"]);

// Artists and tracks a user hides from everyone else: their profile, the
// friends feed, now playing, leaderboards and share cards. Their own stats
// still include them.
export const hiddenItems = pgTable(
  "hidden_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: hiddenItemType("type").notNull(),
    // Spotify artist or track ID
    itemId: text("item_id").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type, t.itemId] })],
);

// Updated by the worker on every loop, so the admin panel can tell whether
// it is running. A single row.
export const workerHeartbeat = pgTable("worker_heartbeat", {
  id: integer("id").primaryKey().default(1),
  beatAt: timestamptz("beat_at").notNull(),
  // Spotify's rate limit stopped catalog lookups until then; kept here so a
  // restart doesn't ask again too early
  catalogPausedUntil: timestamptz("catalog_paused_until"),
});

export type User = typeof users.$inferSelect;
