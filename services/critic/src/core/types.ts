// Domain-agnostic pipeline input. Every domain (librarian, o11y, ...) feeds the
// pipeline through this shape; domain-specific fields live on extensions of it.
export interface DomainInput {
  id: string;
  domainId: string;
  content: string;
  source: 'cli' | 'slack' | 'api' | 'webhook';
  payload?: Record<string, unknown>;
  priorMessages?: Message[];
}

// Librarian-specific input. Generalised over DomainInput so the base pipeline
// stays domain-agnostic while the librarian extractors keep their code fields.
export interface ReviewInput extends DomainInput {
  language?: string;
  filePath?: string;
  designContext?: string;
}

export interface Message {
  id: string;
  source: 'cli' | 'slack' | 'api';
  author: string;
  content: string;
  refs?: string[];
  timestamp: Date;
  modality: 'code' | 'prose' | 'mixed';
}

export interface ExtractedContext {
  extractorId: string;
  type: 'code' | 'prose' | 'shared';
  content: string;
  metadata: {
    sourceLines?: [number, number];
    symbols?: string[];
    relevanceHint?: number;
  };
  tokenEstimate: number;
}

export interface Extractor {
  readonly id: string;
  readonly type: 'code' | 'prose' | 'shared';
  readonly weight: number;
  extract(input: ReviewInput): Promise<ExtractedContext | null>;
}

export interface AgentContext {
  agentId: string;
  extractions: ExtractedContext[];
  totalTokens: number;
  relevanceScore: number;
}

export interface AgentConfig {
  id: string;
  displayName?: string;
  version: number;
  extractors: {
    code: ExtractorDef[];
    prose: ExtractorDef[];
    shared: ExtractorDef[];
  };
  judgmentAxes: string[];
  speechPolicy: {
    alphaWeights: { relevance: number; anomaly: number; novelty: number };
    thresholdLow: number;
    thresholdHigh: number;
  };
  anchorStrength: number;
  anisotropyTolerance: 'low' | 'medium' | 'high';
  voiceSamples: VoiceSample[];
}

export interface VoiceSample {
  context: string;
  utterance: string;
}

export interface ExtractorDef {
  type: string;
  weight: number;
}

export interface ScoredDraft {
  agentId: string;
  content: string;
  alpha: number;
  components: { relevance: number; anomaly: number; novelty: number };
}

export interface Utterance {
  id: string;
  agentId: string;
  configVersion: number;
  turnId: string;
  parentMsgId?: string;
  content: string;
  embedding?: number[];
  viewContext?: Record<string, unknown>;
  createdAt: Date;
}

export interface Feedback {
  id: string;
  utteranceId: string;
  source: string;
  axis?: string;
  signal: number;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export type PipelineState =
  | 'idle'
  | 'receiving'
  | 'extracting'
  | 'drafting'
  | 'scoring'
  | 'refining'
  | 'outputting'
  | 'awaiting_feedback';
