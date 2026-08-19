import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { env } from '../common/env';

export interface StoredObject {
  size: number;
  contentType: string | null;
}

/**
 * The only part of the app that talks to object storage.
 *
 * File bytes never pass through this API: the client is handed a signed URL
 * and uploads straight to storage, so a 50 MB upload costs the API one small
 * request instead of tying up a request handler for its whole duration. That
 * also means the service role key stays server-side and the bucket stays
 * private - every read is a short-lived signed URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // Type inferred rather than annotated: createClient's generics carry
  // defaults that a bare SupabaseClient annotation does not reproduce.
  private readonly client = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    // A server-side client has no user session to persist or refresh.
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /** A URL the browser can PUT the file body to, valid for a couple of hours. */
  async createUploadUrl(storageKey: string): Promise<string> {
    const { data, error } = await this.bucket().createSignedUploadUrl(
      storageKey,
      // Upserting makes a retry against the same key idempotent rather than
      // failing because the abandoned first attempt left an object behind.
      { upsert: true },
    );

    if (error || !data) {
      throw new BadGatewayException('Could not start the upload. Try again.');
    }

    return data.signedUrl;
  }

  /** The stored object, or null when the upload never landed. */
  async findObject(storageKey: string): Promise<StoredObject | null> {
    const { data, error } = await this.bucket().info(storageKey);
    if (error || !data) return null;

    return { size: data.size ?? 0, contentType: data.contentType ?? null };
  }

  async createViewUrl(
    storageKey: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.bucket().createSignedUrl(
      storageKey,
      expiresInSeconds,
    );

    if (error || !data) {
      throw new BadGatewayException('Could not open this file. Try again.');
    }

    return data.signedUrl;
  }

  /**
   * Best effort: the database rows are already gone, and failing the request
   * over an orphaned blob would be worse than leaving one behind. Logged so
   * the leak is visible rather than silent.
   */
  async removeMany(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;

    const { error } = await this.bucket().remove(storageKeys);
    if (error) {
      this.logger.warn(
        `Could not delete ${storageKeys.length} object(s) from storage: ${error.message}`,
      );
    }
  }

  private bucket() {
    return this.client.storage.from(env.SUPABASE_BUCKET);
  }
}
