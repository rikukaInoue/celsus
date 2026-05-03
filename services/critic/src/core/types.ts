export interface ReviewInput {
  id: string;
  content: string;
  language?: string;
  filePath?: string;
  designContext?: string;
  priorMessages?: Message[];
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
