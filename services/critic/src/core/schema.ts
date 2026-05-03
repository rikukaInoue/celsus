import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['cli', 'slack', 'api']),
  author: z.string(),
  content: z.string().min(1),
  refs: z.array(z.string()).optional(),
  timestamp: z.date(),
  modality: z.enum(['code', 'prose', 'mixed']),
});

export const ExtractorDefSchema = z.object({
  type: z.string(),
  weight: z.number().min(0).max(1),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  display_name: z.string().optional(),
  version: z.number().int().positive(),
  extractors: z.object({
    code: z.array(ExtractorDefSchema),
    prose: z.array(ExtractorDefSchema),
    shared: z.array(ExtractorDefSchema),
  }),
  judgment_axes: z.array(z.string()),
  speech_policy: z.object({
    alpha_weights: z.object({
      relevance: z.number(),
      anomaly: z.number(),
      novelty: z.number(),
    }),
    threshold_low: z.number(),
    threshold_high: z.number(),
  }),
  anchor_strength: z.number().min(0).max(1),
  anisotropy_tolerance: z.enum(['low', 'medium', 'high']),
});

export const FeedbackInputSchema = z.object({
  utteranceId: z.string().uuid(),
  source: z.string(),
  axis: z.string().optional(),
  signal: z.number().min(-1).max(1),
  context: z.record(z.unknown()).optional(),
});

export type MessageInput = z.infer<typeof MessageSchema>;
export type AgentConfigInput = z.infer<typeof AgentConfigSchema>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
