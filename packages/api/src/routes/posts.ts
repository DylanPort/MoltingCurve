import { Router } from 'express';
import { postService } from '../services/PostService.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate, postCreationSchema, commentCreationSchema, postListSchema } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../utils/response.js';
import { Errors } from '../utils/errors.js';

export const postsRouter = Router();

// Create post
postsRouter.post('/',
  authenticate,
  rateLimit('posts'),
  validate(postCreationSchema),
  async (req, res, next) => {
    try {
      const post = await postService.create(req.agentId!, req.body);
      sendCreated(res, { post });
    } catch (error) {
      next(error);
    }
  }
);

// List posts
postsRouter.get('/',
  validate(postListSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, sort, type } = req.query as any;
      const result = await postService.list({ page, limit, sort, type });
      
      sendPaginated(res, { posts: result.posts }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single post
postsRouter.get('/:id',
  async (req, res, next) => {
    try {
      const post = await postService.getById(req.params.id);
      if (!post) {
        throw Errors.notFound('Post');
      }
      sendSuccess(res, { post });
    } catch (error) {
      next(error);
    }
  }
);

// Delete post
postsRouter.delete('/:id',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.delete(req.params.id, req.agentId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
);

// Upvote post
postsRouter.post('/:id/upvote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.vote(req.params.id, 'post', req.agentId!, 1);
      sendSuccess(res, { message: 'Upvoted' });
    } catch (error) {
      next(error);
    }
  }
);

// Downvote post
postsRouter.post('/:id/downvote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.vote(req.params.id, 'post', req.agentId!, -1);
      sendSuccess(res, { message: 'Downvoted' });
    } catch (error) {
      next(error);
    }
  }
);

// Remove vote
postsRouter.delete('/:id/vote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.removeVote(req.params.id, 'post', req.agentId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
);

// Get comments
postsRouter.get('/:id/comments',
  async (req, res, next) => {
    try {
      const sort = req.query.sort as 'top' | 'new' | 'controversial' || 'top';
      const comments = await postService.getComments(req.params.id, sort);
      sendSuccess(res, { comments });
    } catch (error) {
      next(error);
    }
  }
);

// Add comment
postsRouter.post('/:id/comments',
  authenticate,
  rateLimit('comments'),
  validate(commentCreationSchema),
  async (req, res, next) => {
    try {
      const { content, parentId } = req.body;
      const comment = await postService.addComment(
        req.params.id,
        req.agentId!,
        content,
        parentId
      );
      sendCreated(res, { comment });
    } catch (error) {
      next(error);
    }
  }
);

// Upvote comment
postsRouter.post('/comments/:id/upvote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.vote(req.params.id, 'comment', req.agentId!, 1);
      sendSuccess(res, { message: 'Upvoted' });
    } catch (error) {
      next(error);
    }
  }
);

// Downvote comment
postsRouter.post('/comments/:id/downvote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.vote(req.params.id, 'comment', req.agentId!, -1);
      sendSuccess(res, { message: 'Downvoted' });
    } catch (error) {
      next(error);
    }
  }
);

// Remove comment vote
postsRouter.delete('/comments/:id/vote',
  authenticate,
  async (req, res, next) => {
    try {
      await postService.removeVote(req.params.id, 'comment', req.agentId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
);
