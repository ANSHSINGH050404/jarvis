/**
 * Memory Repository (Vector Store)
 *
 * Manages semantic memories with vector embeddings.
 */

import type { Database } from "bun:sqlite";
import { createLogger, generateId } from "@jarvis/core";

const logger = createLogger("MemoryRepository");

export interface Memory {
  id: string;
  content: string;
  embedding: number[]; // Stored as BLOB (Float32Array)
  createdAt: number;
  metadata?: Record<string, unknown>;
  score?: number; // Similarity score
}

export class MemoryRepository {
  constructor(private db: Database) {}

  /**
   * Add a semantic memory
   */
  add(
    content: string,
    embedding: number[],
    metadata?: Record<string, unknown>,
  ): void {
    const id = generateId("mem");
    const embeddingBuffer = new Float32Array(embedding).buffer;

    const query = this.db.prepare(`
      INSERT INTO memories (id, content, embedding, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    query.run(
      id,
      content,
      new Uint8Array(embeddingBuffer), // Store as raw bytes
      Date.now(),
      JSON.stringify(metadata || {}),
    );

    logger.debug("Added semantic memory", { id, length: content.length });
  }

  /**
   * Search for similar memories
   */
  search(queryEmbedding: number[], limit: number = 5): Memory[] {
    // 1. Fetch all embeddings (or chunked)
    // Optimization: In real production, use a vector DB or index.
    // For local <10k items, linear scan in JS is fast enough (<10ms).

    const query = this.db.prepare("SELECT * FROM memories");
    const rows = query.all() as any[];

    const queryVec = new Float32Array(queryEmbedding);

    // 2. Calculate cosine similarity
    const scored = rows.map((row) => {
      const embedding = new Float32Array(
        row.embedding.buffer ? row.embedding.buffer : row.embedding,
      ); // Bun SQLite returns Uint8Array for BLOB
      const score = this.cosineSimilarity(queryVec, embedding);

      return {
        id: row.id,
        content: row.content,
        embedding: Array.from(embedding),
        createdAt: row.created_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        score,
      };
    });

    // 3. Sort and limit
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
