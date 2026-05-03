import * as ort from 'onnxruntime-node';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const MODEL_DIR = join(homedir(), '.cache', 'critic-embeddings');
const MODEL_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';
const TOKENIZER_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json';

let session: ort.InferenceSession | null = null;
let tokenizer: any = null;

async function downloadIfNeeded(url: string, destPath: string) {
  if (existsSync(destPath)) return;
  mkdirSync(MODEL_DIR, { recursive: true });
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
  console.log(`Saved to ${destPath}`);
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!session) {
    const modelPath = join(MODEL_DIR, 'model_quantized.onnx');
    await downloadIfNeeded(MODEL_URL, modelPath);
    session = await ort.InferenceSession.create(modelPath);
  }
  return session;
}

async function getTokenizer() {
  if (!tokenizer) {
    const tokenizerPath = join(MODEL_DIR, 'tokenizer.json');
    await downloadIfNeeded(TOKENIZER_URL, tokenizerPath);
    const raw = readFileSync(tokenizerPath, 'utf-8');
    tokenizer = JSON.parse(raw);
  }
  return tokenizer;
}

function simpleTokenize(text: string, vocab: Map<string, number>, maxLen = 128): { inputIds: number[]; attentionMask: number[] } {
  const CLS = vocab.get('[CLS]') ?? 101;
  const SEP = vocab.get('[SEP]') ?? 102;
  const UNK = vocab.get('[UNK]') ?? 100;
  const PAD = vocab.get('[PAD]') ?? 0;

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const tokens: number[] = [CLS];

  for (const word of words) {
    const id = vocab.get(word) ?? UNK;
    tokens.push(id);
    if (tokens.length >= maxLen - 1) break;
  }
  tokens.push(SEP);

  const attentionMask = new Array(maxLen).fill(0);
  for (let i = 0; i < tokens.length; i++) attentionMask[i] = 1;

  while (tokens.length < maxLen) tokens.push(PAD);

  return { inputIds: tokens, attentionMask };
}

let vocabMap: Map<string, number> | null = null;

async function getVocab(): Promise<Map<string, number>> {
  if (!vocabMap) {
    const tok = await getTokenizer();
    vocabMap = new Map<string, number>();
    const model = tok.model;
    if (model?.vocab) {
      for (const [word, id] of Object.entries(model.vocab)) {
        vocabMap.set(word, id as number);
      }
    }
  }
  return vocabMap;
}

function meanPool(lastHidden: Float32Array, attentionMask: number[], seqLen: number, hiddenSize: number): number[] {
  const result = new Array(hiddenSize).fill(0);
  let count = 0;

  for (let i = 0; i < seqLen; i++) {
    if (attentionMask[i] === 1) {
      for (let j = 0; j < hiddenSize; j++) {
        result[j] += lastHidden[i * hiddenSize + j];
      }
      count++;
    }
  }

  let norm = 0;
  for (let j = 0; j < hiddenSize; j++) {
    result[j] /= count;
    norm += result[j] * result[j];
  }
  norm = Math.sqrt(norm);
  for (let j = 0; j < hiddenSize; j++) {
    result[j] /= norm;
  }

  return result;
}

export async function embed(text: string): Promise<number[]> {
  const sess = await getSession();
  const vocab = await getVocab();

  const maxLen = 128;
  const { inputIds, attentionMask } = simpleTokenize(text, vocab, maxLen);

  const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, maxLen]);
  const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, maxLen]);
  const tokenTypeIds = new ort.Tensor('int64', new BigInt64Array(maxLen), [1, maxLen]);

  const results = await sess.run({
    input_ids: inputIdsTensor,
    attention_mask: attentionMaskTensor,
    token_type_ids: tokenTypeIds,
  });

  const output = results['last_hidden_state'] ?? results[Object.keys(results)[0]];
  const data = output.data as Float32Array;
  const hiddenSize = 384;

  return meanPool(data, attentionMask, maxLen, hiddenSize);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

export const EMBEDDING_DIM = 384;
