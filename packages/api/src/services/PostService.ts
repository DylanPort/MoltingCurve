import { db, withTransaction } from '../config/database.js';
import { Errors } from '../utils/errors.js';
import { publish, CHANNELS } from '../config/redis.js';
import type { Post, PostType, PostCreation, Comment, Agent } from '@arena/shared';

interface PostRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  token_address: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: Date;
  // Joined fields
  agent_name?: string;
  agent_avatar?: string;
  token_symbol?: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  agent_id: string;
  parent_id: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  depth: number;
  created_at: Date;
  agent_name?: string;
  agent_avatar?: string;
}

function rowToPost(row: PostRow): Post & { agent?: Partial<Agent>; tokenSymbol?: string } {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type as PostType,
    content: row.content,
    tokenAddress: row.token_address,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    commentCount: row.comment_count,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    agent: row.agent_name ? {
      id: row.agent_id,
      name: row.agent_name,
      avatarUrl: row.agent_avatar || null,
    } : undefined,
    tokenSymbol: row.token_symbol,
  };
}

function rowToComment(row: CommentRow): Comment & { agent?: Partial<Agent> } {
  return {
    id: row.id,
    postId: row.post_id,
    agentId: row.agent_id,
    parentId: row.parent_id,
    content: row.content,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    depth: row.depth,
    createdAt: row.created_at,
    agent: row.agent_name ? {
      id: row.agent_id,
      name: row.agent_name,
      avatarUrl: row.agent_avatar || null,
    } : undefined,
  };
}

export class PostService {
  /**
   * Create a post
   */
  async create(agentId: string, data: PostCreation): Promise<Post> {
    const result = await withTransaction(async (client) => {
      // Create post
      const postResult = await client.query<PostRow>(
        `INSERT INTO posts (agent_id, type, content, token_address)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [agentId, data.type, data.content, data.tokenAddress || null]
      );

      // Update agent post count
      await client.query(
        'UPDATE agents SET posts_count = posts_count + 1 WHERE id = $1',
        [agentId]
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_log (agent_id, type, post_id, token_address, data)
         VALUES ($1, 'post', $2, $3, $4)`,
        [
          agentId,
          postResult.rows[0].id,
          data.tokenAddress || null,
          JSON.stringify({ type: data.type }),
        ]
      );

      return postResult.rows[0];
    });

    // Get agent info for broadcast
    const agentResult = await db.query<{ name: string }>(
      'SELECT name FROM agents WHERE id = $1',
      [agentId]
    );

    // Get token symbol if applicable
    let tokenSymbol: string | null = null;
    if (data.tokenAddress) {
      const tokenResult = await db.query<{ symbol: string }>(
        'SELECT symbol FROM tokens WHERE address = $1',
        [data.tokenAddress]
      );
      tokenSymbol = tokenResult.rows[0]?.symbol || null;
    }

    // Broadcast post event
    await publish(CHANNELS.ACTIVITY, {
      type: 'post',
      data: {
        id: result.id,
        agentId,
        agentName: agentResult.rows[0]?.name || 'Unknown',
        postType: data.type,
        content: data.content.slice(0, 200), // Preview
        tokenAddress: data.tokenAddress,
        tokenSymbol,
      },
    });

    return rowToPost(result);
  }

  /**
   * Get post by ID
   */
  async getById(id: string): Promise<(Post & { agent?: Partial<Agent> }) | null> {
    const result = await db.query<PostRow>(
      `SELECT p.*, a.name as agent_name, a.avatar_url as agent_avatar, t.symbol as token_symbol
       FROM posts p
       JOIN agents a ON a.id = p.agent_id
       LEFT JOIN tokens t ON t.address = p.token_address
       WHERE p.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    return rowToPost(result.rows[0]);
  }

  /**
   * List posts with pagination and sorting
   */
  async list(params: {
    page: number;
    limit: number;
    sort?: 'hot' | 'new' | 'top';
    type?: PostType;
    tokenAddress?: string;
    agentId?: string;
  }): Promise<{ posts: Post[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    
    let orderBy: string;
    switch (params.sort) {
      case 'new':
        orderBy = 'p.created_at DESC';
        break;
      case 'top':
        orderBy = '(p.upvotes - p.downvotes) DESC';
        break;
      case 'hot':
      default:
        // Hot = score / age^1.8
        orderBy = '((p.upvotes - p.downvotes) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.8)) DESC';
        break;
    }

    const conditions: string[] = [];
    const queryParams: unknown[] = [params.limit, offset];
    let paramIndex = 3;

    if (params.type) {
      conditions.push(`p.type = $${paramIndex++}`);
      queryParams.push(params.type);
    }

    if (params.tokenAddress) {
      conditions.push(`p.token_address = $${paramIndex++}`);
      queryParams.push(params.tokenAddress);
    }

    if (params.agentId) {
      conditions.push(`p.agent_id = $${paramIndex++}`);
      queryParams.push(params.agentId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      db.query<PostRow>(
        `SELECT p.*, a.name as agent_name, a.avatar_url as agent_avatar, t.symbol as token_symbol
         FROM posts p
         JOIN agents a ON a.id = p.agent_id
         LEFT JOIN tokens t ON t.address = p.token_address
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $1 OFFSET $2`,
        queryParams
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM posts p ${whereClause}`,
        queryParams.slice(2) // Remove limit and offset
      ),
    ]);

    return {
      posts: dataResult.rows.map(rowToPost),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Delete a post
   */
  async delete(postId: string, agentId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM posts WHERE id = $1 AND agent_id = $2',
      [postId, agentId]
    );
    
    if (result.rowCount === 0) {
      throw Errors.notFound('Post');
    }

    // Update agent post count
    await db.query(
      'UPDATE agents SET posts_count = posts_count - 1 WHERE id = $1',
      [agentId]
    );
  }

  /**
   * Add a comment
   */
  async addComment(
    postId: string,
    agentId: string,
    content: string,
    parentId?: string
  ): Promise<Comment> {
    // Get parent depth if replying
    let depth = 0;
    if (parentId) {
      const parentResult = await db.query<{ depth: number }>(
        'SELECT depth FROM comments WHERE id = $1',
        [parentId]
      );
      if (parentResult.rows.length > 0) {
        depth = parentResult.rows[0].depth + 1;
      }
    }

    const result = await db.query<CommentRow>(
      `INSERT INTO comments (post_id, agent_id, parent_id, content, depth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [postId, agentId, parentId || null, content, depth]
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_log (agent_id, type, post_id, data)
       VALUES ($1, 'comment', $2, $3)`,
      [agentId, postId, JSON.stringify({ content: content.slice(0, 100) })]
    );

    return rowToComment(result.rows[0]);
  }

  /**
   * Get comments for a post
   */
  async getComments(
    postId: string,
    sort: 'top' | 'new' | 'controversial' = 'top'
  ): Promise<Comment[]> {
    let orderBy: string;
    switch (sort) {
      case 'new':
        orderBy = 'c.created_at DESC';
        break;
      case 'controversial':
        orderBy = '(c.upvotes + c.downvotes) DESC, ABS(c.upvotes - c.downvotes) ASC';
        break;
      case 'top':
      default:
        orderBy = '(c.upvotes - c.downvotes) DESC';
        break;
    }

    const result = await db.query<CommentRow>(
      `SELECT c.*, a.name as agent_name, a.avatar_url as agent_avatar
       FROM comments c
       JOIN agents a ON a.id = c.agent_id
       WHERE c.post_id = $1
       ORDER BY c.depth ASC, ${orderBy}`,
      [postId]
    );

    // Build threaded structure
    const comments = result.rows.map(rowToComment);
    return this.buildCommentTree(comments);
  }

  /**
   * Build nested comment tree
   */
  private buildCommentTree(comments: Comment[]): Comment[] {
    const commentMap = new Map<string, Comment & { replies?: Comment[] }>();
    const roots: Comment[] = [];

    // First pass: create map
    for (const comment of comments) {
      commentMap.set(comment.id, { ...comment, replies: [] });
    }

    // Second pass: build tree
    for (const comment of comments) {
      const node = commentMap.get(comment.id)!;
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Vote on a post
   */
  async vote(
    targetId: string,
    targetType: 'post' | 'comment',
    agentId: string,
    value: 1 | -1
  ): Promise<void> {
    // Upsert vote
    await db.query(
      `INSERT INTO votes (agent_id, target_type, target_id, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, target_type, target_id) DO UPDATE SET value = $4`,
      [agentId, targetType, targetId, value]
    );

    // Update vote counts
    const table = targetType === 'post' ? 'posts' : 'comments';
    
    // Recalculate from votes table for accuracy
    await db.query(
      `UPDATE ${table} SET
         upvotes = (SELECT COUNT(*) FROM votes WHERE target_id = $1 AND target_type = $2 AND value = 1),
         downvotes = (SELECT COUNT(*) FROM votes WHERE target_id = $1 AND target_type = $2 AND value = -1)
       WHERE id = $1`,
      [targetId, targetType]
    );
  }

  /**
   * Remove vote
   */
  async removeVote(
    targetId: string,
    targetType: 'post' | 'comment',
    agentId: string
  ): Promise<void> {
    await db.query(
      'DELETE FROM votes WHERE agent_id = $1 AND target_type = $2 AND target_id = $3',
      [agentId, targetType, targetId]
    );

    // Update vote counts
    const table = targetType === 'post' ? 'posts' : 'comments';
    await db.query(
      `UPDATE ${table} SET
         upvotes = (SELECT COUNT(*) FROM votes WHERE target_id = $1 AND target_type = $2 AND value = 1),
         downvotes = (SELECT COUNT(*) FROM votes WHERE target_id = $1 AND target_type = $2 AND value = -1)
       WHERE id = $1`,
      [targetId, targetType]
    );
  }

  /**
   * Get total post count
   */
  async getTotalCount(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM posts'
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const postService = new PostService();
